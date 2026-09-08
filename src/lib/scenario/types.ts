export type BackgroundMode = "image" | "url";

export type ScenarioCharacterData = {
  id?: string;
  name?: string;
  affiliation?: string;
  spriteUrl: string;
  filename?: string;
  timestamp?: number;
  x: number;
  y: number;
  scale: number;
  darken?: boolean;
  hologram?: boolean;
  silhouette?: boolean;
  silhouetteColor?: number;
  blur?: boolean;
  /** Sprite URLs registered per expression name (used by the script CHARA_EXPR command). */
  expressions?: Record<string, string>;
  selectedExpression?: string;
};

export type ScenarioFontData = {
  label: string;
  family: string;
  nameY?: number;
  affiliationY?: number;
};

export type ScenarioContentConfig = {
  characterName?: string;
  affiliation?: string;
  dialogue?: string;
  scene?: string;
};

export type ScenarioBackgroundConfig = {
  mode?: BackgroundMode;
  url?: string | null;
  image?: string | null;
  scale?: number;
  xOffset?: number;
  yOffset?: number;
  blur?: boolean;
};

export type ScenarioElementsConfig = {
  displayButtons?: boolean;
  autoEnabled?: boolean;
  displayLine?: boolean;
  displayGradient?: boolean;
  displayTriangle?: boolean;
  transparentBackground?: boolean;
};

export type ScenarioBehaviorConfig = {
  type?: "default" | "chat_image";
  markdown?: boolean;
  scrollSpeed?: number;
  animate?: boolean;
  duration?: number;
  fps?: number;
  speed?: "slow" | "normal" | "fast" | number | string;
};

export type ScenarioOutputConfig = {
  type?: "image" | "animation";
  mode?: "normal" | "chat";
  format?: "png" | "gif";
};

export type ScenarioConfig = {
  content?: ScenarioContentConfig;
  background?: ScenarioBackgroundConfig;
  characters?: ScenarioCharacterData[];
  font?: ScenarioFontData;
  fontSize?: number;
  elements?: ScenarioElementsConfig;
  behavior?: ScenarioBehaviorConfig;
  output?: ScenarioOutputConfig;
  script?: string;
  speed?: "slow" | "normal" | "fast" | number | string;
  gifSpeed?: "slow" | "normal" | "fast" | number | string;
  format?: "png" | "gif";
};

export type ScenarioGenerationResult = {
  success: boolean;
  type: "image" | "animation";
  id: string;
  url: string;
  dataUrl?: string;
  markdown?: string;
  width: number;
  height: number;
  sizeBytes?: number;
  durationMs?: number;
  emotion?: string;
  speed?: string;
  character?: {
    name: string;
    id: string;
    emotion: string;
    spriteUrl: string;
    x: number;
    y: number;
    scale: number;
  };
  characters?: ScenarioCharacterData[];
  background?: {
    name: string;
    url: string;
    x: number;
    y: number;
    scale: number;
  };
  error?: {
    code: string;
    message: string;
  };
};

export type AssetType = "character" | "background" | "element" | "effect" | "font" | "custom";

export type ScenarioAssetMetadata = {
  id: string;
  name: string;
  type: AssetType;
  category: string;
  source: "library" | "upload" | "url" | "gdrive";
  url: string;
  thumbnail?: string;
  school?: string;
  club?: string;
  metadata?: Record<string, unknown>;
};
