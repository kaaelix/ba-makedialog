import { ServerScenarioRenderer } from "@/lib/scenario/renderer/server-renderer";
import type {
  ScenarioConfig,
  ScenarioGenerationResult,
} from "@/lib/scenario/types";
import { findGeneratedScenarioFile } from "@/lib/scenario/storage";

export class ScenarioEngine {
  /**
   * Direct headless generation of a still scenario image (PNG).
   * No queues, immediate execution.
   */
  async generate(
    config: ScenarioConfig,
    baseUrl = "",
  ): Promise<ScenarioGenerationResult> {
    this.validate(config);
    if (config.output?.format === "gif" || (config as any).format === "gif") {
      return ServerScenarioRenderer.generateGIF(config, baseUrl);
    }
    return ServerScenarioRenderer.generatePNG(config, baseUrl);
  }

  /**
   * Direct headless generation of an animated scenario (GIF).
   * No queues, immediate execution.
   */
  async animate(
    config: ScenarioConfig,
    baseUrl = "",
  ): Promise<ScenarioGenerationResult> {
    this.validate(config);
    return ServerScenarioRenderer.generateGIF(config, baseUrl);
  }

  /**
   * Validates the configuration before executing render.
   */
  validate(config: ScenarioConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config) {
      errors.push("Missing scenario configuration object.");
    }

    if (config.characters) {
      for (let i = 0; i < config.characters.length; i++) {
        const c = config.characters[i];
        if (!c.spriteUrl && !c.id) {
          errors.push(`Character at index ${i} requires a spriteUrl or valid id.`);
        }
      }
    }

    if (config.fontSize && (config.fontSize < 10 || config.fontSize > 120)) {
      errors.push("Font size must be between 10 and 120.");
    }

    if (errors.length > 0) {
      const err: any = new Error(errors.join(" "));
      err.code = "INVALID_CONFIGURATION";
      err.errors = errors;
      throw err;
    }

    return { valid: true, errors: [] };
  }

  /**
   * Retrieves an existing generation result by id.
   */
  getGeneration(id: string, baseUrl = ""): ScenarioGenerationResult | null {
    const file = findGeneratedScenarioFile(id);
    if (!file) return null;

    const url = baseUrl
      ? `${baseUrl}/api/generation/${id}/result`
      : `/api/generation/${id}/result`;

    if (file.type === "png") {
      return {
        success: true,
        type: "image",
        id,
        url,
        markdown: `![${id}](${url})`,
        width: 1920,
        height: 1080,
        sizeBytes: file.size,
      };
    }

    if (file.type === "gif") {
      return {
        success: true,
        type: "animation",
        id,
        url,
        markdown: `![${id}](${url})`,
        width: 960,
        height: 540,
        sizeBytes: file.size,
      };
    }

    return null;
  }
}

export const scenarioEngine = new ScenarioEngine();
