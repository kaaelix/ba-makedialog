import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { findUploadedFile } from "@/lib/scenario/storage";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    const { filename } = await params;
    const filePath = findUploadedFile(filename);
    if (!filePath) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "File not found" } },
        { status: 404 },
      );
    }
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filename).toLowerCase();
    const contentType =
      ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".gif"
        ? "image/gif"
        : ext === ".webp"
        ? "image/webp"
        : "image/png";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "SERVE_FAILED", message: error.message } },
      { status: 500 },
    );
  }
}
