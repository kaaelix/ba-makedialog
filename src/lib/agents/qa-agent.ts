import type { ScenarioConfig } from "@/lib/scenario/types";

export type QAResult = {
  valid: boolean;
  warnings: string[];
  errors: string[];
};

export class QAAgent {
  /**
   * Pre-flight validation of the Scenario configuration before invoking the engine.
   */
  validate(config: ScenarioConfig): QAResult {
    const warnings: string[] = [];
    const errors: string[] = [];

    if (!config.content?.dialogue) {
      warnings.push("Dialogue text is empty; scenario will render without text.");
    }

    if (!config.characters || config.characters.length === 0) {
      warnings.push("No character assigned; only background will be displayed.");
    } else {
      config.characters.forEach((char, i) => {
        if (!char.spriteUrl) {
          errors.push(`Character [${i}] is missing a spriteUrl.`);
        }
      });
    }

    if (!config.background?.url && !config.background?.image) {
      warnings.push("No background URL or image specified; default dark backdrop used.");
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors,
    };
  }
}

export const qaAgent = new QAAgent();
