import { NextResponse } from "next/server";
import { scenarioEngine } from "@/lib/scenario/engine";
import { normalizeScenarioInput } from "@/lib/scenario/script/normalizer";
import {
  findGeneratedScenarioFile,
  getScenarioBuffer,
} from "@/lib/scenario/storage";
import fs from "fs";

export async function POST(request: Request) {
  try {
    const origin = new URL(request.url).origin;
    const body = await request.json().catch(() => ({}));
    const config = normalizeScenarioInput(body);
    config.output = { type: "animation", mode: "chat", format: "gif" };
    config.behavior = { ...config.behavior, animate: true };

    const result = await scenarioEngine.animate(config, origin);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || "ANIMATION_FAILED",
          message: error.message || "Scenario animation generation failed.",
          details: error.errors || undefined,
        },
      },
      { status: 400 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const origin = url.origin;
    const params = Object.fromEntries(url.searchParams.entries());

    const config = normalizeScenarioInput(params);
    config.output = { type: "animation", mode: "chat", format: "gif" };
    config.behavior = { ...config.behavior, animate: true };

    const result = await scenarioEngine.animate(config, origin);

    // If client requested direct binary GIF
    if (
      params.format === "gif" ||
      request.headers.get("accept")?.includes("image/gif") ||
      request.headers.get("accept")?.includes("image/*")
    ) {
      const inMem = getScenarioBuffer(result.id);
      if (inMem) {
        return new NextResponse(new Uint8Array(inMem.buffer), {
          status: 200,
          headers: {
            "Content-Type": "image/gif",
            "Content-Length": String(inMem.buffer.length),
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }

      const stored = findGeneratedScenarioFile(result.id);
      if (stored && fs.existsSync(stored.filePath)) {
        const buffer = fs.readFileSync(stored.filePath);
        return new NextResponse(new Uint8Array(buffer), {
          status: 200,
          headers: {
            "Content-Type": "image/gif",
            "Content-Length": String(buffer.length),
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || "ANIMATION_FAILED",
          message: error.message || "Scenario animation generation failed.",
          details: error.errors || undefined,
        },
      },
      { status: 400 },
    );
  }
}
