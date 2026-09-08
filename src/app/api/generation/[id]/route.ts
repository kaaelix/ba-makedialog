import { NextResponse } from "next/server";
import { scenarioEngine } from "@/lib/scenario/engine";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const origin = new URL(request.url).origin;
    const generation = scenarioEngine.getGeneration(id, origin);

    if (!generation) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "GENERATION_NOT_FOUND",
            message: `Generation with ID '${id}' does not exist.`,
          },
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: generation,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "LOOKUP_FAILED",
          message: error.message || "Failed to lookup generation.",
        },
      },
      { status: 500 },
    );
  }
}
