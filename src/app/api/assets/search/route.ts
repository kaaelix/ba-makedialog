import { NextResponse } from "next/server";
import { assetCatalog } from "@/lib/assets/catalog";
import type { AssetType } from "@/lib/scenario/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const type = (searchParams.get("type") as AssetType | "all") || undefined;

    const results = assetCatalog.searchAssets({
      query,
      type,
    });

    return NextResponse.json({
      success: true,
      query,
      total: results.length,
      data: results,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SEARCH_FAILED",
          message: error.message || "Asset search failed.",
        },
      },
      { status: 500 },
    );
  }
}
