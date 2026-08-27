import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  checkRateLimit,
  clientKey,
  isOriginAllowed,
  tooManyRequests,
} from "@/lib/auth/route-security";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export async function POST(req: NextRequest) {
  if (!(await isOriginAllowed(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!checkRateLimit(`console-ad-upload:${clientKey(req)}`, 30, 60_000)) {
    return tooManyRequests();
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 2 MB)." }, { status: 413 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (ext !== ".html") {
      return NextResponse.json({ error: "Only .html files are allowed." }, { status: 415 });
    }
    const mime = (file.type || "").toLowerCase();
    if (mime !== "text/html") {
      return NextResponse.json({ error: "File contents are not text/html." }, { status: 415 });
    }
    if (file.name.includes("/") || file.name.includes("\\") || file.name.includes("..")) {
      return NextResponse.json({ error: "Unsupported file name." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 2 MB)." }, { status: 413 });
    }

    const stem = file.name.replace(/\.html$/i, "");
    const safeStem = stem.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "ad";
    const filename = `ad-${safeStem}-${Date.now()}.html`;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import("@vercel/blob");
      const blob = await put(filename, buffer, {
        access: "public",
        contentType: "text/html",
      });
      return NextResponse.json({ url: blob.url });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), buffer);
    return NextResponse.json({ url: `/uploads/${filename}` });
    } catch (err) {
      console.error("Console ad upload error:", err);
      return NextResponse.json(
        { error: "Upload failed. Please try again." },
        { status: 500 },
      );
    }
}
