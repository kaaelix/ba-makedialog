import { NextResponse } from "next/server";
import { scenarioOrchestrator } from "@/lib/agents/orchestrator";

export async function POST(request: Request) {
  try {
    const origin = new URL(request.url).origin;
    const body = await request.json();

    if (!body.prompt && !body.config) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Missing 'prompt' or 'config' in request body.",
          },
        },
        { status: 400 },
      );
    }

    const { config, qa } = scenarioOrchestrator.prepareConfig({
      prompt: body.prompt,
      config: body.config,
      outputType: body.outputType || (body.prompt && /gif|animat/i.test(body.prompt) ? "animation" : "image"),
      baseUrl: origin,
    });

    let result = null;
    if (body.generate) {
      result = await scenarioOrchestrator.execute({
        prompt: body.prompt,
        config,
        outputType: config.output?.type || "image",
        baseUrl: origin,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        config,
        qa,
        result,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || "PLANNING_FAILED",
          message: error.message || "Multi-agent planning failed.",
          details: error.errors || undefined,
        },
      },
      { status: 400 },
    );
  }
}
