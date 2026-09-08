import { NextResponse } from "next/server";
import { assetCatalog } from "@/lib/assets/catalog";
import type { AssetType, ScenarioAssetMetadata } from "@/lib/scenario/types";
import { getUploadsOutputDir } from "@/lib/scenario/storage";
import fs from "fs";
import path from "path";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let fileBuffer: Buffer;
    let fileName = `upload_${Date.now()}`;
    let assetType: AssetType = "character";
    let assetName = "Custom Asset";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "UPLOAD_FAILED",
              message: "No file provided in form data.",
            },
          },
          { status: 400 },
        );
      }
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      fileName = file.name || fileName;
      assetName = (formData.get("name") as string) || file.name;
      assetType = ((formData.get("type") as AssetType) || "character");
    } else {
      const body = await request.json();
      if (!body.data) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "UPLOAD_FAILED",
              message: "Missing 'data' base64 payload.",
            },
          },
          { status: 400 },
        );
      }
      const base64Data = body.data.replace(/^data:image\/\w+;base64,/, "");
      fileBuffer = Buffer.from(base64Data, "base64");
      assetName = body.name || assetName;
      assetType = body.type || assetType;
      fileName = body.filename || `${fileName}.png`;
    }

    // Validate size (max 20MB)
    if (fileBuffer.length > 20 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UPLOAD_FAILED",
            message: "File size exceeds 20MB limit.",
          },
        },
        { status: 400 },
      );
    }

    const uploadDir = getUploadsOutputDir();
    const ext = path.extname(fileName) || ".png";
    const fileId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const savedFileName = `${fileId}${ext}`;
    const filePath = path.join(uploadDir, savedFileName);

    fs.writeFileSync(filePath, fileBuffer);

    const publicUrl = `/api/assets/uploads/${savedFileName}`;

    const metadata: ScenarioAssetMetadata = {
      id: fileId,
      name: assetName,
      type: assetType,
      category: "custom",
      source: "upload",
      url: publicUrl,
      thumbnail: publicUrl,
      metadata: {
        sizeBytes: fileBuffer.length,
        originalName: fileName,
      },
    };

    assetCatalog.registerCustomAsset(metadata);

    return NextResponse.json({
      success: true,
      data: metadata,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UPLOAD_FAILED",
          message: error.message || "File upload failed.",
        },
      },
      { status: 500 },
    );
  }
}
