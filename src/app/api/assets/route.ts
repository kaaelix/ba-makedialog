import { NextResponse } from "next/server";
import { assetCatalog } from "@/lib/assets/catalog";
import type { AssetType } from "@/lib/scenario/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? undefined;
    const type = (searchParams.get("type") as AssetType | "all") ?? undefined;
    const school = searchParams.get("school") ?? undefined;
    const category = searchParams.get("category") ?? undefined;

    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "100", 10), 1),
      500,
    );
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    const assets = assetCatalog.searchAssets({
      query,
      type,
      school,
      category,
    });

    const paginated = assets.slice(offset, offset + limit).map((a) => {
      const sprites = (a.metadata as any)?.sprites;
      return {
        id: a.id,
        name: a.name,
        type: a.type,
        school: a.school,
        club: a.club,
        category: a.category,
        url: a.url,
        thumbnail: a.thumbnail,
        sprites: Array.isArray(sprites)
          ? sprites.map((s: any) => ({
              name: s.name,
              fileName: s.fileName,
              url: s.url,
            }))
          : undefined,
      };
    });

    return NextResponse.json({
      success: true,
      total: assets.length,
      limit,
      offset,
      data: paginated,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ASSET_FETCH_FAILED",
          message: error.message || "Failed to retrieve assets.",
        },
      },
      { status: 500 },
    );
  }
}
