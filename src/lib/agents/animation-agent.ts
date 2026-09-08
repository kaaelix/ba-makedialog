import type { ScenarioConfig } from "@/lib/scenario/types";

export class AnimationAgent {
  /**
   * Configures timing, frame count, and behaviors for animated scenarios.
   */
  configureAnimation(config: ScenarioConfig): ScenarioConfig {
    const isAnim =
      config.output?.type === "animation" || config.behavior?.animate === true;

    if (!isAnim) {
      return config;
    }

    const dialogueLength = config.content?.dialogue?.length ?? 20;
    const duration = Math.max(1500, Math.min(dialogueLength * 60, 6000));

    return {
      ...config,
      behavior: {
        ...config.behavior,
        animate: true,
        duration,
        fps: 15,
      },
      output: {
        ...config.output,
        type: "animation",
        format: "gif",
      },
    };
  }
}

export const animationAgent = new AnimationAgent();
