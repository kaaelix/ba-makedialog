import type { ScenarioCharacterData, ScenarioConfig } from "@/lib/scenario/types";

export class CompositionAgent {
  /**
   * Applies deterministic layout, spacing, and scaling to characters.
   */
  compose(config: ScenarioConfig): ScenarioConfig {
    if (!config.characters || config.characters.length === 0) {
      return config;
    }

    const count = config.characters.length;
    let characters: ScenarioCharacterData[] = [...config.characters];

    if (count === 1) {
      // Centered single character
      characters[0] = {
        ...characters[0],
        x: characters[0].x ?? 0,
        y: characters[0].y ?? 0,
        scale: characters[0].scale ?? 1.0,
      };
    } else if (count === 2) {
      // Two characters: side-by-side
      characters[0] = {
        ...characters[0],
        x: characters[0].x !== 0 ? characters[0].x : -320,
        y: characters[0].y ?? 0,
        scale: characters[0].scale ?? 0.95,
      };
      characters[1] = {
        ...characters[1],
        x: characters[1].x !== 0 ? characters[1].x : 320,
        y: characters[1].y ?? 0,
        scale: characters[1].scale ?? 0.95,
      };
    } else if (count >= 3) {
      // Three or more: distributed
      const spacing = 1200 / (count - 1);
      characters = characters.map((c, idx) => ({
        ...c,
        x: c.x !== 0 ? c.x : -600 + idx * spacing,
        y: c.y ?? 0,
        scale: c.scale ?? 0.88,
      }));
    }

    return {
      ...config,
      characters,
    };
  }
}

export const compositionAgent = new CompositionAgent();
