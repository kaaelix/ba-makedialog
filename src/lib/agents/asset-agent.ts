import { assetCatalog } from "@/lib/assets/catalog";
import type { ScenarioAssetMetadata } from "@/lib/scenario/types";

export type MatchedAssets = {
  characterAsset?: ScenarioAssetMetadata;
  backgroundAsset?: ScenarioAssetMetadata;
  elementAssets: ScenarioAssetMetadata[];
};

export class AssetAgent {
  /**
   * Matches and validates character, background, and element assets from the catalog.
   */
  match(characterName: string, sceneDescription: string): MatchedAssets {
    // 1. Character Matching
    let characterAsset = assetCatalog.findCharacterByName(characterName);
    if (!characterAsset) {
      // Fallback to Hoshino
      characterAsset = assetCatalog.findCharacterByName("Hoshino");
    }

    // 2. Background Matching
    let backgroundAsset = assetCatalog.findBackgroundByNameOrLocation(sceneDescription);
    if (!backgroundAsset) {
      // Fallback to classroom sunset
      backgroundAsset = assetCatalog.findBackgroundByNameOrLocation("Classroom (Sunset)");
    }

    // 3. Elements
    const elementAssets = assetCatalog.getElements();

    return {
      characterAsset,
      backgroundAsset,
      elementAssets,
    };
  }

  validateAsset(url: string): boolean {
    return !!url && url.length > 0;
  }
}

export const assetAgent = new AssetAgent();
