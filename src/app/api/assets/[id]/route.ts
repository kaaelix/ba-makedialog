import { NextResponse } from "next/server";
import { assetCatalog } from "@/lib/assets/catalog";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const asset = assetCatalog.getAssetById(id);

    if (!asset) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ASSET_NOT_FOUND",
            message: `Asset with ID '${id}' was not found.`,
          },
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: asset,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ASSET_LOOKUP_FAILED",
          message: error.message || "Failed to lookup asset.",
        },
      },
      { status: 500 },
    );
  }
}
