import catalogData from "@/lib/assets/data/catalog-data.json";
import type { AssetType, ScenarioAssetMetadata } from "@/lib/scenario/types";

export type AssetFilterOptions = {
  type?: AssetType | "all";
  school?: string;
  category?: string;
  query?: string;
};

class AssetCatalogService {
  private customAssets: Map<string, ScenarioAssetMetadata> = new Map();

  private getProcessedCharacters(): ScenarioAssetMetadata[] {
    const raw = (catalogData.characters || []) as any[];
    return raw.map((c) => ({
      ...c,
      school: c.school || c.metadata?.school || "Kivotos",
      club: c.club || c.metadata?.club || "General",
    }));
  }

  private getProcessedBackgrounds(): ScenarioAssetMetadata[] {
    return (catalogData.backgrounds || []) as ScenarioAssetMetadata[];
  }

  getAllAssets(): ScenarioAssetMetadata[] {
    const defaultAssets: ScenarioAssetMetadata[] = [
      ...this.getProcessedCharacters(),
      ...this.getProcessedBackgrounds(),
      ...(((catalogData as any).elements || []) as ScenarioAssetMetadata[]),
      ...(((catalogData as any).effects || []) as ScenarioAssetMetadata[]),
      ...(((catalogData as any).fonts || []) as ScenarioAssetMetadata[]),
    ];

    const custom = Array.from(this.customAssets.values());
    return [...custom, ...defaultAssets];
  }

  getCharacters(): ScenarioAssetMetadata[] {
    return [
      ...Array.from(this.customAssets.values()).filter((a) => a.type === "character"),
      ...this.getProcessedCharacters(),
    ];
  }

  getBackgrounds(): ScenarioAssetMetadata[] {
    return [
      ...Array.from(this.customAssets.values()).filter((a) => a.type === "background"),
      ...this.getProcessedBackgrounds(),
    ];
  }

  getElements(): ScenarioAssetMetadata[] {
    return ((catalogData as any).elements || []) as ScenarioAssetMetadata[];
  }

  getEffects(): ScenarioAssetMetadata[] {
    return ((catalogData as any).effects || []) as ScenarioAssetMetadata[];
  }

  getFonts(): ScenarioAssetMetadata[] {
    return ((catalogData as any).fonts || []) as ScenarioAssetMetadata[];
  }

  getGDriveSources(): Array<{ id: string; name: string; folderId: string; url: string; count?: number }> {
    const src = (catalogData as any).sourceFolders || {};
    return [
      {
        id: "gdrive_backgrounds",
        name: "Blue Archive Backgrounds Collection",
        folderId: src.backgrounds?.folderId || "1lZSWYJAQ_jHVsxksC21zyL0g8YoqmYwm",
        url: src.backgrounds?.url || "https://drive.google.com/drive/u/0/mobile/folders/1lZSWYJAQ_jHVsxksC21zyL0g8YoqmYwm",
        count: src.backgrounds?.count || 830,
      },
      {
        id: "gdrive_characters",
        name: "Blue Archive Character Sprites & Diorama Collection",
        folderId: src.characters?.folderId || "1nlfhqo-laGOEbbPHDhG43fw8mQQZ1iHF",
        url: src.characters?.url || "https://drive.google.com/drive/folders/1nlfhqo-laGOEbbPHDhG43fw8mQQZ1iHF",
        count: src.characters?.count || 819,
      },
    ];
  }

  getAssetById(id: string): ScenarioAssetMetadata | undefined {
    if (this.customAssets.has(id)) {
      return this.customAssets.get(id);
    }
    return this.getAllAssets().find(
      (a) =>
        a.id === id ||
        a.id === `chara_${id}` ||
        (a.metadata?.folderName && String(a.metadata.folderName).toLowerCase() === id.toLowerCase()),
    );
  }

  findCharacterByName(name: string): ScenarioAssetMetadata | undefined {
    const q = name.trim().toLowerCase();
    const chars = this.getCharacters();

    // Exact match
    const exact = chars.find(
      (c) =>
        c.name.toLowerCase() === q ||
        (c.metadata?.folderName && String(c.metadata.folderName).toLowerCase() === q) ||
        (c as any).devName?.toLowerCase() === q,
    );
    if (exact) return exact;

    // Starts with match
    const starts = chars.find((c) => c.name.toLowerCase().startsWith(q));
    if (starts) return starts;

    // Contains match
    return chars.find((c) => c.name.toLowerCase().includes(q));
  }

  getCharacterSprites(charIdOrName: string): Array<{ name: string; fileName: string; driveFileId: string; url: string }> {
    const char = this.getAssetById(charIdOrName) || this.findCharacterByName(charIdOrName);
    if (char && char.metadata && Array.isArray((char.metadata as any).sprites)) {
      return (char.metadata as any).sprites;
    }
    return [];
  }

  findBackgroundByNameOrLocation(query: string): ScenarioAssetMetadata | undefined {
    const q = query.trim().toLowerCase();
    const bgs = this.getBackgrounds();

    const exact = bgs.find(
      (b) =>
        b.name.toLowerCase() === q ||
        (b.metadata?.location && String(b.metadata.location).toLowerCase() === q),
    );
    if (exact) return exact;

    return bgs.find(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.metadata?.location && String(b.metadata.location).toLowerCase().includes(q)) ||
        b.category.toLowerCase().includes(q),
    );
  }

  searchAssets(options: AssetFilterOptions): ScenarioAssetMetadata[] {
    let assets = this.getAllAssets();

    if (options.type && options.type !== "all") {
      assets = assets.filter((a) => a.type === options.type);
    }

    if (options.school) {
      const schoolLower = options.school.toLowerCase();
      assets = assets.filter(
        (a) => a.school && a.school.toLowerCase() === schoolLower,
      );
    }

    if (options.category) {
      const categoryLower = options.category.toLowerCase();
      assets = assets.filter(
        (a) => a.category && a.category.toLowerCase() === categoryLower,
      );
    }

    if (options.query) {
      const q = options.query.trim().toLowerCase();
      assets = assets.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q) ||
          (a.metadata?.folderName && String(a.metadata.folderName).toLowerCase().includes(q)) ||
          (a.school && a.school.toLowerCase().includes(q)) ||
          (a.club && a.club.toLowerCase().includes(q)) ||
          a.category.toLowerCase().includes(q),
      );
    }

    return assets;
  }

  registerCustomAsset(asset: ScenarioAssetMetadata): void {
    this.customAssets.set(asset.id, asset);
  }
}

export const assetCatalog = new AssetCatalogService();
