import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = path.extname(file.name).toLowerCase();
  const name = file.name.replace(ext, "").replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `${name}-${Date.now()}${ext}`;

  // Use Vercel Blob when BLOB_READ_WRITE_TOKEN is set (online/production)
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(filename, buffer, { access: "public" });
    return NextResponse.json({ url: blob.url });
  }

  // Fallback: local filesystem (local development)
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), buffer);

  const url = `/uploads/${filename}`;
  return NextResponse.json({ url });
}
