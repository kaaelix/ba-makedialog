import { SCENARIO_FONT_EN } from "@/lib/scenario/fonts";
import { SCENARIO_TEXT_FONT_SIZE, SCENARIO_TEXT_SCROLL_SPEED } from "@/lib/scenario/constants";
import type { ScenarioConfig } from "@/lib/scenario/types";
import type { PlannedScenarioIntent } from "@/lib/agents/scenario-planner";
import type { MatchedAssets } from "@/lib/agents/asset-agent";

export class ConfigAgent {
  /**
   * Assembles a complete, compliant ScenarioConfig from intent and matched assets.
   */
  createConfig(
    intent: PlannedScenarioIntent,
    assets: MatchedAssets,
    overrides?: Partial<ScenarioConfig>,
  ): ScenarioConfig {
    const charAsset = assets.characterAsset;
    const bgAsset = assets.backgroundAsset;

    const baseConfig: ScenarioConfig = {
      content: {
        characterName: intent.characterName || charAsset?.name || "Hoshino",
        affiliation: intent.affiliation || charAsset?.school || "Abydos High School",
        dialogue: intent.dialogue,
        scene: intent.sceneDescription,
      },
      background: {
        mode: "url",
        url: bgAsset?.url ?? "https://raw.githubusercontent.com/SchaleDB/SchaleDB/main/images/background/BG_ClassRoom_Sunset.jpg",
        scale: 1.0,
        xOffset: 0,
        yOffset: 0,
      },
      characters: charAsset
        ? [
            {
              id: charAsset.id,
              name: charAsset.name,
              spriteUrl: charAsset.url,
              filename: `${charAsset.name.toLowerCase()}.png`,
              timestamp: Date.now(),
              x: 0,
              y: 0,
              scale: 1.0,
              darken: false,
              hologram: false,
              silhouette: false,
            },
          ]
        : [],
      font: SCENARIO_FONT_EN,
      fontSize: SCENARIO_TEXT_FONT_SIZE,
      elements: {
        displayButtons: true,
        autoEnabled: false,
        displayLine: true,
        displayGradient: true,
        displayTriangle: true,
        transparentBackground: false,
      },
      behavior: {
        type: "chat_image",
        markdown: true,
        scrollSpeed: SCENARIO_TEXT_SCROLL_SPEED,
        animate: intent.isAnimation ?? false,
      },
      output: {
        type: intent.isAnimation ? "animation" : "image",
        mode: "chat",
        format: intent.isAnimation ? "gif" : "png",
      },
    };

    return {
      ...baseConfig,
      ...overrides,
      content: {
        ...baseConfig.content,
        ...overrides?.content,
      },
      background: {
        ...baseConfig.background,
        ...overrides?.background,
      },
      elements: {
        ...baseConfig.elements,
        ...overrides?.elements,
      },
      behavior: {
        ...baseConfig.behavior,
        ...overrides?.behavior,
      },
      output: {
        ...baseConfig.output,
        ...overrides?.output,
      },
    };
  }
}

export const configAgent = new ConfigAgent();
