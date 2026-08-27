import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getCurrentUser } from "@/lib/auth/current-user";
import { sanitizeSvg } from "@/lib/sanitize";
import {
  checkRateLimit,
  clientKey,
  isOriginAllowed,
  tooManyRequests,
} from "@/lib/auth/route-security";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Validates the file's actual bytes (magic numbers) against its extension —
 * not just the client-supplied MIME header.
 */
export function bufferMatchesType(buffer: Buffer, ext: string): boolean {
  switch (ext) {
    case ".png":
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    case ".jpg":
    case ".jpeg":
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case ".webp":
      return (
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer.length > 11 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
      );
    case ".gif":
      return buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38;
    case ".pdf":
      return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
    case ".svg": {
      const head = buffer.toString("utf8", 0, 1024).toLowerCase();
      return head.includes("<svg") || head.startsWith("<?xml");
    }
    default:
      return false;
  }
}

// Allowlisted extensions + the MIME types we accept for each.
const ALLOWED: Record<string, string[]> = {
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".webp": ["image/webp"],
  ".gif": ["image/gif"],
  ".svg": ["image/svg+xml"],
  ".pdf": ["application/pdf"],
};

export async function POST(req: NextRequest) {
  // 0. Cross-site request forgery defence-in-depth.
  if (!(await isOriginAllowed(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 1. Authentication — only authenticated users with school scope (or
  //    platform super users) may upload. Prevents anonymous abuse / malware
  //    hosting on the public endpoint.
  const user = await getCurrentUser();
  const canUpload =
    user &&
    (user.schoolId !== null || user.role === "super_admin" || user.role === "platform_owner");
  if (!canUpload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Per-IP rate limit to blunt automated abuse.
  if (!checkRateLimit(`upload:${clientKey(req)}`, 60, 60_000)) {
    return tooManyRequests();
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });

    // 3. Size cap (check declared size AND actual bytes).
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 5 MB)." }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 5 MB)." }, { status: 413 });
    }

    // 4. Extension allowlist + MIME validation.
    const ext = path.extname(file.name).toLowerCase();
    const allowedTypes = ALLOWED[ext];
    if (!allowedTypes) {
      return NextResponse.json(
        { error: "File type not allowed." },
        { status: 415 },
      );
    }
    const mime = (file.type || "").toLowerCase();
    if (!allowedTypes.includes(mime)) {
      return NextResponse.json(
        { error: "File contents do not match its extension." },
        { status: 415 },
      );
    }

    // 4b. Magic-byte validation — confirm the bytes actually match the type.
    if (!bufferMatchesType(buffer, ext)) {
      return NextResponse.json(
        { error: "File contents do not match its type." },
        { status: 415 },
      );
    }

    // 4c. SVG: sanitize to strip embedded scripts / event handlers.
    let storeBuffer = buffer;
    if (ext === ".svg") {
      const cleaned = sanitizeSvg(buffer.toString("utf8"));
      if (!/<svg/i.test(cleaned)) {
        return NextResponse.json({ error: "Invalid SVG content." }, { status: 415 });
      }
      storeBuffer = Buffer.from(cleaned, "utf8");
    }

    // Reject path-traversal attempts. Other characters (spaces, etc.) are
    // sanitized into the final filename below, so they are allowed.
    if (
      file.name.includes("/") ||
      file.name.includes("\\") ||
      file.name.includes("..")
    ) {
      return NextResponse.json({ error: "Unsupported file name." }, { status: 400 });
    }

    const stem = file.name.replace(/\.(png|jpe?g|webp|gif|svg|pdf)$/i, "");
    const safeStem = stem.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "file";
    const filename = `${safeStem}-${Date.now()}${ext}`;

    // Production: Vercel Blob
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import("@vercel/blob");
      const blob = await put(filename, storeBuffer, {
        access: "public",
        contentType: mime,
      });
      return NextResponse.json({ url: blob.url });
    }

    // Local: filesystem
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), storeBuffer);
    return NextResponse.json({ url: `/uploads/${filename}` });
    } catch (err) {
      console.error("Upload error:", err);
      return NextResponse.json(
        { error: "Upload failed. Please try again." },
        { status: 500 },
      );
    }
}