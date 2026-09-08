import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  const spec = {
    openapi: "3.0.3",
    info: {
      title: "Blue Archive Scenario Image Generator API",
      version: "1.0.0",
      description:
        "API-first Blue Archive Visual Novel Scenario Image Generator and Chat Renderer. Provides deterministic PNG still rendering, animated GIF generation, ChatImageBehavior producing directly embeddable markdown syntax ![](URL), an asset catalog containing all characters and backgrounds, and a multi-agent orchestration pipeline without any queues.",
      contact: {
        name: "Blue Archive Tools API",
        url: "https://github.com/jozsefsallai/ba-tools",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: origin,
        description: "Current Server Instance",
      },
    ],
    paths: {
      "/api/scenario/generate": {
        post: {
          summary: "Direct Scenario Image Generation (PNG)",
          description:
            "Directly composites and generates a high-resolution 1920x1080 Blue Archive visual novel dialogue still without queues. Supports ChatImageBehavior emitting markdown image embeds.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ScenarioGenerationRequest",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Successful generation",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ScenarioGenerationResponse",
                  },
                },
              },
            },
            "400": {
              description: "Invalid configuration or rendering failure",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/scenario/animate": {
        post: {
          summary: "Direct Scenario Animation Generation (GIF)",
          description:
            "Generates an animated GIF sequence with typewriter dialogue reveal and bobbing prompt triangle indicator without queuing.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ScenarioGenerationRequest",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Successful animation generation",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ScenarioGenerationResponse",
                  },
                },
              },
            },
          },
        },
        get: {
          summary: "Direct Animated GIF Stream (GET)",
          description:
            "Generates and streams an animated GIF binary directly (Content-Type: image/gif) via URL query parameters without queues.",
          parameters: [
            { name: "character", in: "query", schema: { type: "string" }, description: "Character name or ID" },
            { name: "dialogue", in: "query", schema: { type: "string" }, description: "Dialogue subtitle text" },
            { name: "background", in: "query", schema: { type: "string" }, description: "Background scene ID or URL" },
            { name: "speed", in: "query", schema: { type: "string", enum: ["slow", "normal", "fast"] }, description: "Typewriter playback speed" },
            { name: "bgBlur", in: "query", schema: { type: "boolean" }, description: "Enable background bokeh blur" },
            { name: "char1", in: "query", schema: { type: "string" }, description: "First character for multi-character scene" },
            { name: "char2", in: "query", schema: { type: "string" }, description: "Second character for multi-character scene" },
            { name: "format", in: "query", schema: { type: "string", default: "gif" } },
          ],
          responses: {
            "200": {
              description: "Direct binary animated GIF stream",
              content: {
                "image/gif": {
                  schema: { type: "string", format: "binary" },
                },
              },
            },
          },
        },
      },
      "/api/assets": {
        get: {
          summary: "List Asset Catalog",
          description:
            "Retrieves all Blue Archive assets with optional filtering by query, type, school, or category.",
          parameters: [
            {
              name: "q",
              in: "query",
              description: "Search keyword",
              schema: { type: "string" },
            },
            {
              name: "type",
              in: "query",
              description: "Asset type",
              schema: {
                type: "string",
                enum: ["all", "character", "background", "element", "effect", "font", "custom"],
              },
            },
            {
              name: "school",
              in: "query",
              description: "Filter characters by academy / school",
              schema: { type: "string" },
            },
            {
              name: "category",
              in: "query",
              description: "Filter assets by category",
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "List of assets",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      total: { type: "integer" },
                      data: {
                        type: "array",
                        items: { $ref: "#/components/schemas/AssetMetadata" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/assets/search": {
        get: {
          summary: "Search Assets",
          parameters: [
            {
              name: "q",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Search results",
            },
          },
        },
      },
      "/api/assets/{id}": {
        get: {
          summary: "Get Asset by ID",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Asset metadata",
            },
            "404": {
              description: "Asset not found",
            },
          },
        },
      },
      "/api/assets/upload": {
        post: {
          summary: "Upload Custom Asset",
          description: "Uploads a custom character sprite or background image.",
          responses: {
            "200": {
              description: "Uploaded asset metadata",
            },
          },
        },
      },
      "/api/generation/{id}": {
        get: {
          summary: "Get Generation Details",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Generation record",
            },
          },
        },
      },
      "/api/generation/{id}/result": {
        get: {
          summary: "Download Rendered Result Binary",
          description: "Streams the raw PNG or GIF image binary directly.",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Binary image stream (image/png or image/gif)",
            },
          },
        },
      },
      "/api/agents/plan": {
        post: {
          summary: "Multi-Agent Planning and Orchestration",
          description:
            "Coordinates Scenario Planner, Asset Agent, Config Agent, Composition Agent, and QA Agent.",
          responses: {
            "200": {
              description: "Planned scenario configuration and QA verdict",
            },
          },
        },
      },
    },
    components: {
      schemas: {
        ScenarioGenerationRequest: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description:
                "Optional natural language prompt to be resolved by the Multi-Agent system (e.g. 'Hoshino asking Sensei in classroom')",
            },
            content: {
              type: "object",
              properties: {
                characterName: { type: "string", example: "Hoshino" },
                affiliation: { type: "string", example: "Abydos High School" },
                dialogue: {
                  type: "string",
                  example: "Sensei, are you still awake? Working this late isn't good for your health, you know~",
                },
                scene: { type: "string", example: "Classroom (Sunset)" },
              },
            },
            background: {
              type: "object",
              properties: {
                url: { type: "string" },
                scale: { type: "number", default: 1.0 },
                xOffset: { type: "number", default: 0 },
                yOffset: { type: "number", default: 0 },
                blur: { type: "boolean", default: false, description: "Enable background bokeh blur" },
              },
            },
            characters: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  spriteUrl: { type: "string" },
                  x: { type: "number", default: 0 },
                  y: { type: "number", default: 0 },
                  scale: { type: "number", default: 1.0 },
                  darken: { type: "boolean" },
                  hologram: { type: "boolean" },
                  silhouette: { type: "boolean" },
                  blur: { type: "boolean", default: false, description: "Enable soft out-of-focus blur" },
                },
              },
            },
            behavior: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["default", "chat_image"], default: "chat_image" },
                markdown: { type: "boolean", default: true },
              },
            },
            output: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["image", "animation"], default: "image" },
                mode: { type: "string", enum: ["normal", "chat"], default: "chat" },
              },
            },
          },
        },
        ScenarioGenerationResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            type: { type: "string", enum: ["image", "animation"] },
            id: { type: "string", example: "scenario_1725791234_abc" },
            url: { type: "string", example: "https://domain.com/generated/scenario/abc.png" },
            markdown: { type: "string", example: "![](https://domain.com/generated/scenario/abc.png)" },
            width: { type: "integer", example: 1920 },
            height: { type: "integer", example: 1080 },
            sizeBytes: { type: "integer", example: 345120 },
            durationMs: { type: "integer", example: 420 },
          },
        },
        AssetMetadata: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            type: { type: "string", enum: ["character", "background", "element", "effect", "font", "custom"] },
            category: { type: "string" },
            source: { type: "string", enum: ["library", "upload", "url", "gdrive"] },
            url: { type: "string" },
            thumbnail: { type: "string" },
            school: { type: "string" },
            club: { type: "string" },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: {
              type: "object",
              properties: {
                code: { type: "string", example: "GENERATION_FAILED" },
                message: { type: "string" },
              },
            },
          },
        },
      },
    },
  };

  return NextResponse.json(spec);
}
