import clientData from "@/lib/assets/data/client-catalog-index.json";
import type { AssetType, ScenarioAssetMetadata } from "@/lib/scenario/types";

export type ClientAssetFilterOptions = {
  type?: AssetType | "all";
  school?: string;
  category?: string;
  query?: string;
};

export type SpriteData = {
  name: string;
  fileName: string;
  driveFileId?: string;
  url: string;
};

class ClientAssetCatalogService {
  private customAssets: Map<string, ScenarioAssetMetadata> = new Map();
  private spriteCache: Map<string, SpriteData[]> = new Map();
  private spriteFetchPromises: Map<string, Promise<SpriteData[]>> = new Map();

  constructor() {
    // Populate default sprite cache for known characters with defaultSprite
    for (const char of clientData.characters) {
      if (char.defaultSprite) {
        this.spriteCache.set(char.id, [char.defaultSprite]);
        this.spriteCache.set(char.name.toLowerCase(), [char.defaultSprite]);
      }
    }
  }

  getCharacters(): ScenarioAssetMetadata[] {
    const custom = Array.from(this.customAssets.values()).filter(
      (a) => a.type === "character",
    );
    const standard = clientData.characters as unknown as ScenarioAssetMetadata[];
    return [...custom, ...standard];
  }

  getBackgrounds(): ScenarioAssetMetadata[] {
    const custom = Array.from(this.customAssets.values()).filter(
      (a) => a.type === "background",
    );
    const standard = clientData.backgrounds as unknown as ScenarioAssetMetadata[];
    return [...custom, ...standard];
  }

  getAllAssets(): ScenarioAssetMetadata[] {
    return [...this.getCharacters(), ...this.getBackgrounds()];
  }

  getAssetById(id: string): ScenarioAssetMetadata | undefined {
    if (this.customAssets.has(id)) {
      return this.customAssets.get(id);
    }
    const cleanId = id.toLowerCase();
    return this.getAllAssets().find(
      (a) =>
        a.id.toLowerCase() === cleanId ||
        a.id.toLowerCase() === `chara_${cleanId}`,
    );
  }

  findCharacterByName(name: string): ScenarioAssetMetadata | undefined {
    const q = name.trim().toLowerCase();
    const chars = this.getCharacters();

    const exact = chars.find((c) => c.name.toLowerCase() === q);
    if (exact) return exact;

    const starts = chars.find((c) => c.name.toLowerCase().startsWith(q));
    if (starts) return starts;

    return chars.find((c) => c.name.toLowerCase().includes(q));
  }

  findBackgroundByNameOrLocation(query: string): ScenarioAssetMetadata | undefined {
    const q = query.trim().toLowerCase();
    const bgs = this.getBackgrounds();

    const exact = bgs.find((b) => b.name.toLowerCase() === q);
    if (exact) return exact;

    return bgs.find(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.category && b.category.toLowerCase().includes(q)),
    );
  }

  getCharacterSprites(charIdOrName: string): SpriteData[] {
    const key = charIdOrName.trim().toLowerCase();
    if (this.spriteCache.has(key)) {
      return this.spriteCache.get(key)!;
    }

    const char = this.getAssetById(charIdOrName) || this.findCharacterByName(charIdOrName);
    if (char) {
      if (this.spriteCache.has(char.id)) {
        return this.spriteCache.get(char.id)!;
      }
      const defaultSp = (char as any).defaultSprite;
      if (defaultSp) {
        return [defaultSp];
      }
    }

    return [];
  }

  async fetchCharacterSprites(charIdOrName: string): Promise<SpriteData[]> {
    const key = charIdOrName.trim().toLowerCase();
    const existing = this.spriteCache.get(key);
    if (existing && existing.length > 1) {
      return existing;
    }

    const char = this.getAssetById(charIdOrName) || this.findCharacterByName(charIdOrName);
    const lookupId = char?.id || charIdOrName;

    if (this.spriteFetchPromises.has(lookupId)) {
      return this.spriteFetchPromises.get(lookupId)!;
    }

    const fetchPromise = (async () => {
      try {
        const res = await fetch(`/api/assets/${encodeURIComponent(lookupId)}`);
        if (!res.ok) return existing || [];
        const json = await res.json();
        if (json.success && json.data?.metadata?.sprites) {
          const sprites: SpriteData[] = json.data.metadata.sprites.map((s: any) => ({
            name: s.name,
            fileName: s.fileName,
            driveFileId: s.driveFileId,
            url: s.url,
          }));
          this.spriteCache.set(lookupId.toLowerCase(), sprites);
          if (char) {
            this.spriteCache.set(char.name.toLowerCase(), sprites);
          }
          return sprites;
        }
      } catch (err) {
        console.warn(`Failed to dynamically fetch sprites for ${lookupId}:`, err);
      }
      return existing || [];
    })();

    this.spriteFetchPromises.set(lookupId, fetchPromise);
    return fetchPromise;
  }

  registerCustomAsset(asset: ScenarioAssetMetadata): void {
    this.customAssets.set(asset.id, asset);
  }
}

export const clientAssetCatalog = new ClientAssetCatalogService();
