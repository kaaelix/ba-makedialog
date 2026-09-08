import { NextResponse } from "next/server";
import fs from "fs";
import {
  findGeneratedScenarioFile,
  getScenarioBuffer,
} from "@/lib/scenario/storage";
import {
  decodeScenarioId,
  normalizeScenarioInput,
} from "@/lib/scenario/script/normalizer";
import { ServerScenarioRenderer } from "@/lib/scenario/renderer/server-renderer";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);

    // 1. Check in-memory serverless cache
    const inMem = getScenarioBuffer(id);
    if (inMem) {
      const contentType = inMem.type === "gif" ? "image/gif" : "image/png";
      return new NextResponse(new Uint8Array(inMem.buffer), {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(inMem.buffer.length),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // 2. Check disk storage
    const file = findGeneratedScenarioFile(id);
    if (file) {
      const fileBuffer = fs.readFileSync(file.filePath);
      const contentType = file.type === "gif" ? "image/gif" : "image/png";
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(fileBuffer.length),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // 3. Stateless On-Demand Recovery: Decode config from self-contained ID
    const decodedConfig = decodeScenarioId(id);
    if (decodedConfig) {
      const isGif = id.startsWith("sc_gif_");
      if (isGif) {
        const gifResult = await ServerScenarioRenderer.generateGIF(
          decodedConfig,
          url.origin,
        );
        const cachedGif = getScenarioBuffer(gifResult.id);
        if (cachedGif) {
          return new NextResponse(new Uint8Array(cachedGif.buffer), {
            status: 200,
            headers: {
              "Content-Type": "image/gif",
              "Content-Length": String(cachedGif.buffer.length),
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        }
      } else {
        const pngResult = await ServerScenarioRenderer.generatePNG(
          decodedConfig,
          url.origin,
        );
        const cachedPng = getScenarioBuffer(pngResult.id);
        if (cachedPng) {
          return new NextResponse(new Uint8Array(cachedPng.buffer), {
            status: 200,
            headers: {
              "Content-Type": "image/png",
              "Content-Length": String(cachedPng.buffer.length),
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        }
      }
    }

    // 4. Query Params Fallback: If user provides search parameters to result URL
    const qParams = Object.fromEntries(url.searchParams.entries());
    if (qParams.dialogue || qParams.name || qParams.characterId || qParams.text) {
      const config = normalizeScenarioInput(qParams);
      const isGif = qParams.format === "gif" || id.startsWith("sc_gif_");
      if (isGif) {
        const gifResult = await ServerScenarioRenderer.generateGIF(config, url.origin);
        const cachedGif = getScenarioBuffer(gifResult.id);
        if (cachedGif) {
          return new NextResponse(new Uint8Array(cachedGif.buffer), {
            status: 200,
            headers: {
              "Content-Type": "image/gif",
              "Content-Length": String(cachedGif.buffer.length),
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        }
      } else {
        const pngResult = await ServerScenarioRenderer.generatePNG(config, url.origin);
        const cachedPng = getScenarioBuffer(pngResult.id);
        if (cachedPng) {
          return new NextResponse(new Uint8Array(cachedPng.buffer), {
            status: 200,
            headers: {
              "Content-Type": "image/png",
              "Content-Length": String(cachedPng.buffer.length),
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        }
      }
    }

    // 5. Image Request Fallback: Return a default Kivotos scene rather than a broken image for img tags
    const accept = request.headers.get("accept") || "";
    if (accept.includes("image/png") || accept.includes("image/*")) {
      const defaultConf = normalizeScenarioInput({});
      const pngResult = await ServerScenarioRenderer.generatePNG(defaultConf, url.origin);
      const cachedPng = getScenarioBuffer(pngResult.id);
      if (cachedPng) {
        return new NextResponse(new Uint8Array(cachedPng.buffer), {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "Content-Length": String(cachedPng.buffer.length),
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "GENERATION_NOT_FOUND",
          message: `Generation file with ID '${id}' was not found on storage.`,
        },
      },
      { status: 404 },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RESULT_SERVE_FAILED",
          message: error.message || "Failed to serve generation result.",
        },
      },
      { status: 500 },
    );
  }
}
