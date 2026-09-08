import {
  SCENARIO_LINE_HEIGHT,
  SCENARIO_LINE_WIDTH,
  SCENARIO_VIEW_HEIGHT,
  SCENARIO_VIEW_WIDTH,
} from "@/lib/scenario/constants";
import {
  type ScenarioState,
  selectBackground,
} from "@/lib/scenario/store";
import type { ScenarioCharacterData } from "@/lib/scenario/types";
import {
  formatDialogueLines,
  isCharacterSpeaking,
  revealFormattedLines,
  type FormattedLine,
} from "@/lib/scenario/dialogue-formatter";
import { AdjustmentFilter, CRTFilter, ColorOverlayFilter } from "pixi-filters";
import {
  Application,
  Assets,
  BlurFilter,
  CanvasTextMetrics,
  Container,
  type Filter,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  Texture,
  type Ticker,
} from "pixi.js";

const TEXT_X = (SCENARIO_VIEW_WIDTH - SCENARIO_LINE_WIDTH) / 2;
const CHARACTER_BASE_X = SCENARIO_VIEW_WIDTH / 2;
const CHARACTER_BASE_Y = 50;
const GRADIENT_HEIGHT = 410;

const TRIANGLE_MAX_DISTANCE = 10;
const TRIANGLE_SPEED = 0.7;
const TRIANGLE_IDLE_MS = 800;

let fontsPromise: Promise<void> | null = null;

function loadScenarioFonts(): Promise<void> {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      try {
        Assets.addBundle("scenario-fonts", [
          {
            alias: "Noto Sans",
            src: "/assets/fonts/noto-sans/NotoSans-Regular.ttf",
            data: { family: "Noto Sans" },
          },
          {
            alias: "GyeonggiTitle",
            src: "/assets/fonts/gyeonggi/Gyeonggi-Medium.woff",
            data: { family: "GyeonggiTitle" },
          },
          {
            alias: "ShinMGoUpr",
            src: "/assets/fonts/shinmgoupr/U-OTF-ShinMGoUpr-Medium.otf",
            data: { family: "ShinMGoUpr" },
          },
        ]);
        await Assets.loadBundle("scenario-fonts");
      } catch (err) {
        console.warn("Failed to load scenario font bundle, falling back to system fonts:", err);
      }
    })();
  }
  return fontsPromise;
}

class LruTextureCache {
  private readonly max: number;
  private readonly map = new Map<string, { promise: Promise<Texture>; texture?: Texture }>();

  constructor(max = 35) {
    this.max = max;
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  get(key: string): Promise<Texture> | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    // Refresh LRU recency
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.promise;
  }

  set(key: string, promise: Promise<Texture>): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.max) {
      // Evict oldest texture
      const oldestKey = this.map.keys().next().value;
      if (oldestKey) {
        const item = this.map.get(oldestKey);
        if (item?.texture && item.texture !== Texture.EMPTY) {
          try {
            item.texture.destroy(true);
          } catch {
            // ignore
          }
        }
        this.map.delete(oldestKey);
      }
    }

    const entry = { promise, texture: undefined as Texture | undefined };
    promise
      .then((tex) => {
        entry.texture = tex;
      })
      .catch(() => {
        this.map.delete(key);
      });

    this.map.set(key, entry);
  }

  delete(key: string): void {
    const item = this.map.get(key);
    if (item?.texture && item.texture !== Texture.EMPTY) {
      try {
        item.texture.destroy(true);
      } catch {
        // ignore
      }
    }
    this.map.delete(key);
  }
}

const textureCache = new LruTextureCache(35);

export function loadScenarioTexture(url: string): Promise<Texture> {
  if (!url) return Promise.resolve(Texture.EMPTY);
  if (textureCache.has(url)) {
    return textureCache.get(url)!;
  }

  const promise = (async () => {
    // Attempt 1: PixiJS Assets.load with explicit loadTextures parser
    try {
      const tex = await Assets.load<Texture>({
        src: url,
        loadParser: "loadTextures",
      });
      if (tex && tex.width > 0) return tex;
    } catch {
      // Continue to fetch fallback
    }

    // Attempt 2: Fetch blob and create object URL
    try {
      if (typeof window !== "undefined" && typeof window.fetch === "function") {
        const res = await fetch(url, { mode: "cors" });
        if (res.ok) {
          const blob = await res.blob();
          const objectUrl = URL.createObjectURL(blob);
          const tex = await Assets.load<Texture>({
            src: objectUrl,
            loadParser: "loadTextures",
          });
          if (tex && tex.width > 0) return tex;
        }
      }
    } catch {
      // Continue to HTMLImageElement fallback
    }

    // Attempt 3: Standard HTMLImageElement with crossOrigin
    return new Promise<Texture>((resolve, reject) => {
      if (typeof window === "undefined") {
        reject(new Error("Window is not available"));
        return;
      }

      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const tex = Texture.from(img);
          resolve(tex);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => {
        reject(new Error(`Failed to load texture: ${url}`));
      };
      img.src = url;
    });
  })();

  // Do not hold onto failed promises
  promise.catch(() => {
    textureCache.delete(url);
  });

  textureCache.set(url, promise);
  return promise;
}

function createGradientTexture(): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = SCENARIO_VIEW_WIDTH;
  canvas.height = GRADIENT_HEIGHT;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, GRADIENT_HEIGHT);
  gradient.addColorStop(0, "rgba(17, 37, 54, 0)");
  gradient.addColorStop(0.33, "rgba(17, 37, 54, 0.75)");
  gradient.addColorStop(0.55, "rgba(17, 37, 54, 0.86)");
  gradient.addColorStop(1, "rgba(17, 37, 54, 0.86)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SCENARIO_VIEW_WIDTH, GRADIENT_HEIGHT);

  return Texture.from(canvas);
}

function buildCharacterFilters(
  character: ScenarioCharacterData,
  isInactiveSpeaker = false,
): Filter[] {
  const filters: Filter[] = [];

  if (character.silhouette) {
    filters.push(
      new ColorOverlayFilter({
        color: character.silhouetteColor ?? 0x000000,
        alpha: 1,
      }),
    );
  }

  if (character.darken || isInactiveSpeaker) {
    filters.push(
      new AdjustmentFilter({
        brightness: 0.72,
        saturation: 0.45,
        contrast: 0.95,
      }),
      new ColorOverlayFilter({
        color: 0x1e2638,
        alpha: 0.22,
      }),
    );
  }

  if (character.hologram) {
    filters.push(
      new ColorOverlayFilter({ color: 0x71c5ff, alpha: 0.35 }),
      new AdjustmentFilter({
        contrast: 1.1,
        saturation: 0.6,
        brightness: 1.1,
        gamma: 0.8,
      }),
      new CRTFilter({
        lineWidth: 3.6,
        vignetting: 0,
        lineContrast: 0.15,
      }),
    );
  }

  if (character.blur) {
    filters.push(new BlurFilter({ strength: 6, quality: 3 }));
  }

  return filters;
}

let measureCanvas: HTMLCanvasElement | null = null;
let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!measureCanvas) {
    measureCanvas = document.createElement("canvas");
    measureCtx = measureCanvas.getContext("2d");
  }
  return measureCtx;
}

function measureTextChunk(
  text: string,
  isAction: boolean,
  fontSize: number,
  fontFamily: string,
): number {
  if (!text) return 0;
  const ctx = getMeasureCtx();
  if (ctx) {
    ctx.font = `${isAction ? "italic " : ""}${fontSize}px ${fontFamily}, "Noto Sans", sans-serif`;
    return ctx.measureText(text).width;
  }
  return CanvasTextMetrics.measureText(
    text,
    new TextStyle({
      fontFamily,
      fontSize,
      fontStyle: isAction ? "italic" : "normal",
      letterSpacing: 0.4,
    }),
  ).width;
}

type CharacterSlot = {
  sprite: Sprite;
  character: ScenarioCharacterData | null;
  spriteUrl: string | null;
  filterKey: string;
  loadToken: number;
};

type ActiveTween = {
  elapsed: number;
  duration: number;
  apply: (progress: number) => void;
  resolve: () => void;
};

export class ScenarioRenderer {
  private readonly app: Application;
  private lastState: ScenarioState | null = null;

  private sceneBackground: Graphics;
  private backgroundSprite: Sprite;
  private backgroundUrl: string | null = null;
  private backgroundLoadToken = 0;
  private backgroundBlurFilter: BlurFilter;

  private characterLayer: Container;
  private characterSlots: CharacterSlot[] = [];

  private gradientSprite: Sprite;
  private buttonsSprite: Sprite;
  private triangleSprite: Sprite;
  private lineGraphics: Graphics;
  private nameText: Text;
  private affiliationText: Text;
  private dialogueContainer: Container;
  private dialoguePool: Text[] = [];
  private currentDialogueFontSize = 41;
  private currentDialogueLineHeight = Math.round(1.35 * 41);
  private currentDialogueFontFamily = "Noto Sans, sans-serif";
  private fadeOverlay: Graphics;

  private readonly triangleTexture: Texture;
  private readonly buttonsAutoOnTexture: Texture;
  private readonly buttonsAutoOffTexture: Texture;

  private typewriter = {
    active: false,
    progress: 0,
    formattedLines: [] as FormattedLine[],
    length: 0,
    complete: true,
  };
  private typewriterKey: string | null = null;

  private triangleYOffset = 0;
  private triangleDirection = 1;
  private triangleIdleCounter = 0;

  private tweens: ActiveTween[] = [];
  private dialogueWaiters: (() => void)[] = [];
  private clickWaitCancels = new Set<() => void>();

  static async create(host?: HTMLElement): Promise<ScenarioRenderer> {
    const app = new Application();

    await app.init({
      width: SCENARIO_VIEW_WIDTH,
      height: SCENARIO_VIEW_HEIGHT,
      backgroundColor: 0x000000,
      backgroundAlpha: 0,
      preserveDrawingBuffer: true,
      autoDensity: true,
      resolution: 1,
    });

    const [, triangleTexture, buttonsAutoOnTexture, buttonsAutoOffTexture] =
      await Promise.all([
        loadScenarioFonts(),
        Assets.load<Texture>(
          "/assets/ui/scenario-viewer/scennario-triangle.png",
        ).catch(() => Texture.WHITE),
        Assets.load<Texture>(
          "/assets/ui/scenario-viewer/buttons_auto_on.png",
        ).catch(() => Texture.WHITE),
        Assets.load<Texture>(
          "/assets/ui/scenario-viewer/buttons_auto_off.png",
        ).catch(() => Texture.WHITE),
      ]);

    const renderer = new ScenarioRenderer(
      app,
      triangleTexture,
      buttonsAutoOnTexture,
      buttonsAutoOffTexture,
    );

    // Enforce responsive sizing on the PixiJS canvas element
    app.canvas.style.width = "100%";
    app.canvas.style.height = "100%";
    app.canvas.style.maxWidth = "100%";
    app.canvas.style.maxHeight = "100%";
    app.canvas.style.objectFit = "contain";
    app.canvas.style.display = "block";

    if (host) {
      host.replaceChildren(app.canvas);
    }
    return renderer;
  }

  private constructor(
    app: Application,
    triangleTexture: Texture,
    buttonsAutoOnTexture: Texture,
    buttonsAutoOffTexture: Texture,
  ) {
    this.app = app;
    this.triangleTexture = triangleTexture;
    this.buttonsAutoOnTexture = buttonsAutoOnTexture;
    this.buttonsAutoOffTexture = buttonsAutoOffTexture;

    this.sceneBackground = new Graphics();
    this.sceneBackground
      .rect(0, 0, SCENARIO_VIEW_WIDTH, SCENARIO_VIEW_HEIGHT)
      .fill(0x000000);

    this.backgroundBlurFilter = new BlurFilter({ strength: 8, quality: 3 });

    this.backgroundSprite = new Sprite(Texture.EMPTY);
    this.backgroundSprite.visible = false;

    this.characterLayer = new Container();
    this.characterLayer.sortableChildren = true;

    this.gradientSprite = new Sprite(createGradientTexture());
    this.gradientSprite.width = SCENARIO_VIEW_WIDTH;
    this.gradientSprite.height = GRADIENT_HEIGHT;
    this.gradientSprite.x = 0;
    this.gradientSprite.y = SCENARIO_VIEW_HEIGHT - GRADIENT_HEIGHT;

    this.buttonsSprite = new Sprite(buttonsAutoOffTexture);
    this.buttonsSprite.y = 25;

    this.triangleSprite = new Sprite(triangleTexture);
    this.triangleSprite.x = SCENARIO_VIEW_WIDTH - 133 - triangleTexture.width;
    this.triangleSprite.y = SCENARIO_VIEW_HEIGHT - 64 - triangleTexture.height;

    this.lineGraphics = new Graphics();
    this.lineGraphics
      .moveTo(TEXT_X, 844)
      .lineTo(TEXT_X + SCENARIO_LINE_WIDTH, 844)
      .stroke({
        color: 0xffffff,
        width: SCENARIO_LINE_HEIGHT,
        alpha: 0.5,
      });

    this.nameText = new Text({
      text: "",
      x: TEXT_X,
      y: 765,
      style: new TextStyle({
        fontFamily: "Noto Sans, sans-serif",
        fontSize: 57,
        fontWeight: "700",
        fill: "#ffffff",
        align: "left",
        stroke: {
          width: 2,
          color: "#182c40",
          join: "round",
        },
      }),
    });

    this.affiliationText = new Text({
      text: "",
      x: TEXT_X,
      y: 781,
      style: new TextStyle({
        fontFamily: "Noto Sans, sans-serif",
        fontSize: 41,
        fontWeight: "700",
        letterSpacing: -0.4,
        fill: "#7accf9",
        align: "left",
        stroke: {
          width: 1.5,
          color: "#182c40",
          join: "round",
        },
      }),
    });

    this.dialogueContainer = new Container();

    this.fadeOverlay = new Graphics();
    this.fadeOverlay
      .rect(0, 0, SCENARIO_VIEW_WIDTH, SCENARIO_VIEW_HEIGHT)
      .fill(0x000000);
    this.fadeOverlay.alpha = 0;

    this.app.stage.addChild(
      this.sceneBackground,
      this.backgroundSprite,
      this.characterLayer,
      this.gradientSprite,
      this.buttonsSprite,
      this.triangleSprite,
      this.lineGraphics,
      this.nameText,
      this.affiliationText,
      this.dialogueContainer,
      this.fadeOverlay,
    );

    this.app.ticker.add(this.tick, this);
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  destroy(): void {
    this.app.ticker.remove(this.tick, this);
    this.cancelWaits();
    this.cancelTweens(false);
    this.app.destroy(true, { children: true });
  }

  renderToCanvas(): HTMLCanvasElement {
    this.app.render();
    return this.app.canvas;
  }

  private renderDialogueFormatted(lines: FormattedLine[]): void {
    let poolIndex = 0;
    const fontSize = this.currentDialogueFontSize || 41;
    const lineHeight = this.currentDialogueLineHeight || Math.round(1.35 * fontSize);
    const fontFamily = this.currentDialogueFontFamily || "Noto Sans, sans-serif";

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const lineY = 861 + lineIdx * lineHeight;
      let currentX = TEXT_X + 4;

      for (let chunkIdx = 0; chunkIdx < line.length; chunkIdx++) {
        const chunk = line[chunkIdx];
        if (!chunk.text) continue;

        let textNode = this.dialoguePool[poolIndex];
        if (!textNode) {
          textNode = new Text({
            text: "",
            style: new TextStyle({
              stroke: {
                width: 1.5,
                color: "#182c40",
                join: "round",
              },
              letterSpacing: 0.4,
            }),
          });
          this.dialoguePool.push(textNode);
          this.dialogueContainer.addChild(textNode);
        }

        textNode.text = chunk.text;
        textNode.x = currentX;
        textNode.y = lineY;
        textNode.style.fontFamily = fontFamily;
        textNode.style.fontSize = fontSize;
        textNode.style.fill = chunk.isAction ? "#94a3b8" : "#ffffff";
        textNode.style.fontStyle = chunk.isAction ? "italic" : "normal";
        textNode.visible = true;

        poolIndex++;
        currentX += textNode.width;
      }
    }

    for (let i = poolIndex; i < this.dialoguePool.length; i++) {
      this.dialoguePool[i].visible = false;
      this.dialoguePool[i].text = "";
    }
  }

  /**
   * Deterministically renders an animated GIF from the active WebGL canvas.
   * Defaults to fast 30 FPS (33ms frame delay) for blazing fast compilation and smooth playback.
   */
  async exportGif(options?: {
    fps?: number;
    speed?: "slow" | "normal" | "fast" | number;
    onProgress?: (ratio: number) => void;
  }): Promise<Blob> {
    const state = this.lastState;
    if (!state) throw new Error("No active scenario state.");

    const dialogue = state.content;
    const fps = options?.fps || 30;
    const speed = options?.speed || "normal";
    const speedMult =
      typeof speed === "number"
        ? speed
        : speed === "slow"
          ? 0.6
          : speed === "fast"
            ? 1.8
            : 1.0;

    // 30 FPS frame delay (33ms per frame)
    const frameDelayMs = Math.round(1000 / fps);

    // Dynamic typewriter speed: ~1.2 to 2 chars per frame at normal speed
    const charsPerFrame = Math.max(0.4, 1.2 * (state.scrollSpeed || 1.0) * speedMult);
    const typewriterFrames = Math.max(10, Math.ceil(dialogue.length / charsPerFrame));

    // Generous reading hold pause: ~1.5s (45 frames at 30 FPS) with gentle triangle bobbing
    // so readers can comfortably read the dialogue before the GIF loops back!
    const holdFrames = Math.max(24, Math.round(fps * 1.5));
    const totalFrames = typewriterFrames + holdFrames;

    // Downscale target: 960x540 (crisp 16:9 2x downsample for fast encoding)
    const width = 960;
    const height = 540;
    const offscreen = document.createElement("canvas");
    offscreen.width = width;
    offscreen.height = height;
    const ctx = offscreen.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Failed to initialize canvas export context.");

    const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
    const gif = GIFEncoder();

    // Preserve original renderer state
    const prevProgress = this.typewriter.progress;
    const prevComplete = this.typewriter.complete;
    const prevTriangleY = this.triangleSprite.y;
    const prevTriangleVisible = this.triangleSprite.visible;

    let lines = this.typewriter.formattedLines;
    if (!lines || lines.length === 0) {
      const maxLineWidth = SCENARIO_LINE_WIDTH - 20;
      lines = formatDialogueLines(
        dialogue,
        (t, isAction) =>
          measureTextChunk(
            t,
            isAction,
            this.currentDialogueFontSize,
            this.currentDialogueFontFamily,
          ),
        maxLineWidth,
      );
    }

    try {
      this.typewriter.active = true;
      this.typewriter.complete = false;

      // Sample palette once from scene with fully rendered dialogue text & triangle
      this.renderDialogueFormatted(lines);
      this.triangleSprite.visible = state.displayTriangle;
      this.app.render();

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(this.app.canvas, 0, 0, width, height);
      const sampleImg = ctx.getImageData(0, 0, width, height);
      const sampleRgba = new Uint8Array(sampleImg.data.buffer, sampleImg.data.byteOffset, sampleImg.data.byteLength);
      const sharedPalette = quantize(sampleRgba, 128);

      for (let f = 0; f < totalFrames; f++) {
        if (f < typewriterFrames) {
          const charCount = Math.min(
            dialogue.length,
            Math.max(1, Math.floor((f + 1) * charsPerFrame)),
          );
          const revealed = revealFormattedLines(lines, charCount);
          this.renderDialogueFormatted(revealed);
          this.triangleSprite.visible = false;
        } else {
          this.renderDialogueFormatted(lines);
          this.triangleSprite.visible = state.displayTriangle;
          // Smooth sine-wave bobbing during hold frames
          const bounceProgress = (f - typewriterFrames) / 15;
          const bobOffset = Math.abs(Math.sin(bounceProgress * Math.PI)) * TRIANGLE_MAX_DISTANCE;
          this.triangleSprite.y =
            SCENARIO_VIEW_HEIGHT - 64 - this.triangleTexture.height + bobOffset;
        }

        this.app.render();

        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(this.app.canvas, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height);
        const rgba = new Uint8Array(imgData.data.buffer, imgData.data.byteOffset, imgData.data.byteLength);
        const index = applyPalette(rgba, sharedPalette);
        gif.writeFrame(index, width, height, { palette: sharedPalette, delay: frameDelayMs });

        if (options?.onProgress && f % 2 === 0) {
          options.onProgress(f / totalFrames);
        }
      }

      gif.finish();
      const bytes = gif.bytes();
      return new Blob([bytes], { type: "image/gif" });
    } finally {
      // Restore renderer states
      this.typewriter.progress = prevProgress;
      this.typewriter.complete = prevComplete;
      this.triangleSprite.y = prevTriangleY;
      this.triangleSprite.visible = prevTriangleVisible;
      if (this.typewriter.complete) {
        this.renderDialogueFormatted(lines);
      } else {
        const revealed = revealFormattedLines(
          lines,
          Math.floor(this.typewriter.progress),
        );
        this.renderDialogueFormatted(revealed);
      }
      this.app.render();
    }
  }

  async export60FpsGif(options?: {
    speed?: "slow" | "normal" | "fast" | number;
    onProgress?: (ratio: number) => void;
  }): Promise<Blob> {
    return this.exportGif({ ...options, fps: 30 });
  }

  private ensureTicker(): void {
    if (!this.app.ticker.started) {
      this.app.ticker.start();
    }
  }

  restartAnimation(): void {
    this.typewriterKey = "";
    if (this.lastState) {
      this.lastState = { ...this.lastState, animate: true };
      this.syncTypewriter(this.lastState);
      this.updateTriangleVisibility();
      this.ensureTicker();
      this.app.render();
    }
  }

  sync(state: ScenarioState): void {
    this.lastState = state;
    this.sceneBackground.visible = !state.transparentBackground;

    this.syncBackground(state);
    this.syncCharacters(state.characters, state.name);

    const hasContent = state.content.length > 0;

    this.gradientSprite.visible = hasContent && state.displayGradient;
    this.lineGraphics.visible = hasContent && state.displayLine;

    this.buttonsSprite.visible = state.displayButtons;
    const buttonsTexture = state.autoEnabled
      ? this.buttonsAutoOnTexture
      : this.buttonsAutoOffTexture;
    if (this.buttonsSprite.texture !== buttonsTexture) {
      this.buttonsSprite.texture = buttonsTexture;
    }
    this.buttonsSprite.x = SCENARIO_VIEW_WIDTH - 20 - buttonsTexture.width;

    const showName = hasContent && state.name.length > 0;
    this.nameText.visible = showName;
    this.nameText.style.fontFamily = state.font.family;
    this.nameText.text = state.name;
    this.nameText.y = state.font.nameY ?? 765;

    const showAffiliation = showName && state.affiliation.length > 0;
    this.affiliationText.visible = showAffiliation;
    this.affiliationText.style.fontFamily = state.font.family;
    this.affiliationText.text = state.affiliation;
    this.affiliationText.x = TEXT_X + this.nameText.width + 13;
    this.affiliationText.y = state.font.affiliationY ?? 781;

    this.dialogueContainer.visible = hasContent;
    this.syncTypewriter(state);

    if (!state.animate) {
      this.triangleYOffset = 0;
      this.triangleDirection = 1;
      this.triangleIdleCounter = 0;
      this.triangleSprite.y =
        SCENARIO_VIEW_HEIGHT - 64 - this.triangleTexture.height;
    }

    this.updateTriangleVisibility();

    const needsTicker =
      state.animate ||
      (this.typewriter.active && !this.typewriter.complete) ||
      this.tweens.length > 0;

    if (needsTicker) {
      this.ensureTicker();
    } else {
      if (this.app.ticker.started) {
        this.app.ticker.stop();
      }
    }

    this.app.render();
  }

  private syncBackground(state: ScenarioState): void {
    const url = selectBackground(state);
    this.backgroundSprite.visible = !!url;
    this.backgroundSprite.filters = state.backgroundBlur ? [this.backgroundBlurFilter] : [];

    if (url !== this.backgroundUrl) {
      this.backgroundUrl = url;
      const token = ++this.backgroundLoadToken;

      if (!url) {
        this.backgroundSprite.texture = Texture.EMPTY;
        this.layoutBackground();
        this.app.render();
      } else {
        loadScenarioTexture(url)
          .then((texture) => {
            if (this.backgroundLoadToken !== token || !texture) {
              return;
            }
            this.backgroundSprite.texture = texture;
            this.layoutBackground();
            this.app.render();
          })
          .catch((err) => {
            console.warn("Failed to load background texture:", err);
            if (this.backgroundLoadToken !== token) {
              return;
            }
            this.backgroundSprite.texture = Texture.EMPTY;
            this.layoutBackground();
            this.app.render();
          });
      }
    }

    this.layoutBackground();
  }

  private layoutBackground(): void {
    const state = this.lastState;
    if (!state) return;

    const texture = this.backgroundSprite.texture;
    if (texture === Texture.EMPTY) {
      this.backgroundSprite.x = state.backgroundXOffset;
      this.backgroundSprite.y = state.backgroundYOffset;
      this.backgroundSprite.width = SCENARIO_VIEW_WIDTH;
      this.backgroundSprite.height = SCENARIO_VIEW_HEIGHT;
      return;
    }

    const scale = state.backgroundScale;
    const aspectRatio = texture.width / texture.height;
    const isWider = aspectRatio > SCENARIO_VIEW_WIDTH / SCENARIO_VIEW_HEIGHT;

    const baseScaledWidth = isWider
      ? SCENARIO_VIEW_HEIGHT * aspectRatio
      : SCENARIO_VIEW_WIDTH;
    const baseScaledHeight = isWider
      ? SCENARIO_VIEW_HEIGHT
      : SCENARIO_VIEW_WIDTH / aspectRatio;

    const scaledWidth = baseScaledWidth * scale;
    const scaledHeight = baseScaledHeight * scale;

    this.backgroundSprite.x =
      (SCENARIO_VIEW_WIDTH - scaledWidth) / 2 + state.backgroundXOffset;
    this.backgroundSprite.y =
      (SCENARIO_VIEW_HEIGHT - scaledHeight) / 2 + state.backgroundYOffset;
    this.backgroundSprite.width = scaledWidth;
    this.backgroundSprite.height = scaledHeight;
  }

  private syncCharacters(characters: ScenarioCharacterData[], speakerName = ""): void {
    while (this.characterSlots.length > characters.length) {
      const slot = this.characterSlots.pop();
      slot?.sprite.destroy();
    }

    while (this.characterSlots.length < characters.length) {
      const sprite = new Sprite(Texture.EMPTY);
      sprite.anchor.set(0.5, 0);
      this.characterLayer.addChild(sprite);
      this.characterSlots.push({
        sprite,
        character: null,
        spriteUrl: null,
        filterKey: "",
        loadToken: 0,
      });
    }

    characters.forEach((character, index) => {
      const slot = this.characterSlots[index];
      slot.character = character;

      const isSpeaking = isCharacterSpeaking(character, speakerName, characters.length);
      const isInactive = !isSpeaking;

      if (slot.spriteUrl !== character.spriteUrl) {
        slot.spriteUrl = character.spriteUrl;
        const token = ++slot.loadToken;

        if (!character.spriteUrl) {
          slot.sprite.texture = Texture.EMPTY;
          this.layoutCharacter(slot, isInactive);
          this.app.render();
        } else {
          loadScenarioTexture(character.spriteUrl)
            .then((texture) => {
              if (slot.loadToken !== token || !texture) return;
              slot.sprite.texture = texture;
              this.layoutCharacter(slot, isInactive);
              this.app.render();
            })
            .catch((err) => {
              console.warn("Failed to load character sprite:", err);
              if (slot.loadToken !== token) return;
              slot.sprite.texture = Texture.EMPTY;
              this.layoutCharacter(slot, isInactive);
              this.app.render();
            });
        }
      }

      const filterKey = [
        character.darken ? 1 : 0,
        isInactive ? 1 : 0,
        character.hologram ? 1 : 0,
        character.silhouette ? 1 : 0,
        character.silhouetteColor ?? 0,
        character.blur ? 1 : 0,
      ].join("|");

      if (slot.filterKey !== filterKey) {
        slot.filterKey = filterKey;
        slot.sprite.filters = buildCharacterFilters(character, isInactive);
      }

      this.layoutCharacter(slot, isInactive);
    });
  }

  private layoutCharacter(slot: CharacterSlot, isInactive = false): void {
    const character = slot.character;
    if (!character) return;

    const scaleMult = isInactive ? 0.93 : 1.0;
    const yOffset = isInactive ? 16 : 0;

    slot.sprite.x = CHARACTER_BASE_X + character.x;
    slot.sprite.y = CHARACTER_BASE_Y + character.y + yOffset;
    slot.sprite.scale.set(character.scale * scaleMult);
    slot.sprite.zIndex = isInactive ? 0 : 1;
  }

  private syncTypewriter(state: ScenarioState): void {
    const maxLineWidth = SCENARIO_LINE_WIDTH - 20;
    const maxHeight = 185;
    let fontSize = state.fontSize || 41;
    let lineHeight = Math.round(1.35 * fontSize);
    let formattedLines: FormattedLine[] = [];

    while (fontSize >= 22) {
      const curFont = fontSize;
      formattedLines = formatDialogueLines(
        state.content,
        (t, isAction) => measureTextChunk(t, isAction, curFont, state.font.family),
        maxLineWidth,
      );
      lineHeight = Math.round(1.32 * fontSize);
      if (formattedLines.length * lineHeight <= maxHeight || fontSize <= 22) {
        break;
      }
      fontSize -= 2;
    }

    this.currentDialogueFontSize = fontSize;
    this.currentDialogueLineHeight = lineHeight;
    this.currentDialogueFontFamily = state.font.family;

    const key = [
      state.content,
      fontSize,
      state.font.family,
      state.animate,
    ].join("\u0000");

    if (key === this.typewriterKey) return;
    this.typewriterKey = key;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!state.animate || prefersReducedMotion) {
      this.typewriter = {
        active: false,
        progress: state.content.length,
        formattedLines,
        length: state.content.length,
        complete: true,
      };
      this.renderDialogueFormatted(formattedLines);
      this.notifyDialogueComplete();
      return;
    }

    this.typewriter = {
      active: true,
      progress: 0,
      formattedLines,
      length: state.content.length,
      complete: state.content.length === 0,
    };
    this.renderDialogueFormatted([]);

    if (this.typewriter.complete) {
      this.notifyDialogueComplete();
    }
  }

  private updateTriangleVisibility(): void {
    const state = this.lastState;
    if (!state) return;

    this.triangleSprite.visible =
      state.content.length > 0 &&
      state.displayTriangle &&
      (!state.animate || this.typewriter.complete);
  }

  private tick(ticker: Ticker): void {
    const state = this.lastState;
    if (!state) return;

    // typewriter
    const typewriter = this.typewriter;
    if (typewriter.active && !typewriter.complete) {
      typewriter.progress = Math.min(
        typewriter.progress + ticker.deltaTime * state.scrollSpeed,
        typewriter.length,
      );
      const revealed = revealFormattedLines(
        typewriter.formattedLines,
        Math.floor(typewriter.progress),
      );
      this.renderDialogueFormatted(revealed);

      if (typewriter.progress >= typewriter.length) {
        typewriter.complete = true;
        this.notifyDialogueComplete();
      }

      this.updateTriangleVisibility();
    }

    // triangle bob
    if (state.animate) {
      if (this.triangleYOffset >= TRIANGLE_MAX_DISTANCE) {
        this.triangleDirection = -1;
      } else if (this.triangleYOffset <= 0) {
        this.triangleDirection = 1;
      }

      if (
        this.triangleDirection === 1 &&
        this.triangleYOffset <= 0 &&
        this.triangleIdleCounter < TRIANGLE_IDLE_MS
      ) {
        this.triangleIdleCounter += ticker.deltaMS;
      } else {
        this.triangleIdleCounter = 0;
        this.triangleYOffset +=
          this.triangleDirection * ticker.deltaTime * TRIANGLE_SPEED;
      }

      this.triangleSprite.y =
        SCENARIO_VIEW_HEIGHT -
        64 -
        this.triangleTexture.height +
        this.triangleYOffset;
    }

    // tweens
    if (this.tweens.length > 0) {
      const finished: ActiveTween[] = [];
      for (const tween of this.tweens) {
        tween.elapsed += ticker.deltaMS;
        const progress =
          tween.duration <= 0 ? 1 : Math.min(1, tween.elapsed / tween.duration);
        tween.apply(progress);

        if (progress >= 1) {
          finished.push(tween);
        }
      }

      if (finished.length > 0) {
        this.tweens = this.tweens.filter((t) => !finished.includes(t));
        for (const tween of finished) {
          tween.resolve();
        }
      }
    }

    // Pause ticker when scene is static to eliminate idle GPU/CPU drain
    const hasActiveAnimation =
      (typewriter.active && !typewriter.complete) ||
      state.animate ||
      this.tweens.length > 0;

    if (!hasActiveAnimation && this.app.ticker.started) {
      this.app.ticker.stop();
      this.app.render();
    }
  }

  private tween(
    durationMs: number,
    apply: (progress: number) => void,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      if (durationMs <= 0) {
        apply(1);
        resolve();
        return;
      }
      apply(0);
      this.tweens.push({ elapsed: 0, duration: durationMs, apply, resolve });
      this.ensureTicker();
    });
  }

  cancelTweens(jumpToEnd: boolean): void {
    const pending = this.tweens;
    this.tweens = [];
    for (const tween of pending) {
      if (jumpToEnd) {
        tween.apply(1);
      }
      tween.resolve();
    }
  }

  cancelWaits(): void {
    const dialogueWaiters = this.dialogueWaiters;
    this.dialogueWaiters = [];
    for (const resolve of dialogueWaiters) {
      resolve();
    }
    const clickCancels = [...this.clickWaitCancels];
    this.clickWaitCancels.clear();
    for (const cancel of clickCancels) {
      cancel();
    }
  }

  wait(durationMs: number): Promise<void> {
    return this.tween(durationMs, () => {});
  }

  isDialogueComplete(): boolean {
    return this.typewriter.complete;
  }

  completeDialogue(): void {
    const typewriter = this.typewriter;
    if (!typewriter.active || typewriter.complete) return;
    typewriter.progress = typewriter.length;
    this.renderDialogueFormatted(typewriter.formattedLines);
    typewriter.complete = true;
    this.notifyDialogueComplete();
    this.updateTriangleVisibility();
  }

  waitForDialogueComplete(): Promise<void> {
    if (this.typewriter.complete) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.dialogueWaiters.push(resolve);
    });
  }

  waitForClickOrDialogueComplete(): Promise<"click" | "dialogue"> {
    if (this.typewriter.complete) {
      return Promise.resolve("dialogue");
    }

    return new Promise<"click" | "dialogue">((resolve) => {
      const canvas = this.app.canvas;
      let settled = false;

      const finish = (result: "click" | "dialogue") => {
        if (settled) return;
        settled = true;
        canvas.removeEventListener("pointerdown", onClick);
        this.clickWaitCancels.delete(cancel);
        resolve(result);
      };

      const onClick = () => finish("click");
      const cancel = () => finish("dialogue");

      this.clickWaitCancels.add(cancel);
      this.dialogueWaiters.push(() => finish("dialogue"));
      canvas.addEventListener("pointerdown", onClick);
    });
  }

  waitForClick(): Promise<void> {
    return new Promise<void>((resolve) => {
      const canvas = this.app.canvas;
      const finish = () => {
        canvas.removeEventListener("pointerdown", finish);
        this.clickWaitCancels.delete(finish);
        resolve();
      };
      this.clickWaitCancels.add(finish);
      canvas.addEventListener("pointerdown", finish);
    });
  }

  private notifyDialogueComplete(): void {
    const waiters = this.dialogueWaiters;
    this.dialogueWaiters = [];
    for (const resolve of waiters) {
      resolve();
    }
  }

  setOverlayAlpha(alpha: number): void {
    this.fadeOverlay.alpha = alpha;
  }

  fadeOverlayTo(from: number, to: number, durationMs: number): Promise<void> {
    return this.tween(durationMs, (progress) => {
      this.fadeOverlay.alpha = from + (to - from) * progress;
    });
  }

  setCharacterAlpha(index: number, alpha: number): void {
    const slot = this.characterSlots[index];
    if (slot) {
      slot.sprite.alpha = alpha;
    }
  }

  fadeCharacter(
    index: number,
    from: number,
    to: number,
    durationMs: number,
  ): Promise<void> {
    const slot = this.characterSlots[index];
    if (!slot) return Promise.resolve();
    return this.tween(durationMs, (progress) => {
      slot.sprite.alpha = from + (to - from) * progress;
    });
  }

  moveCharacter(
    index: number,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    durationMs: number,
  ): Promise<void> {
    const slot = this.characterSlots[index];
    if (!slot) return Promise.resolve();
    return this.tween(durationMs, (progress) => {
      slot.sprite.x = CHARACTER_BASE_X + fromX + (toX - fromX) * progress;
      slot.sprite.y = CHARACTER_BASE_Y + fromY + (toY - fromY) * progress;
    });
  }
}

let activeRenderer: ScenarioRenderer | null = null;

export function setActiveScenarioRenderer(
  renderer: ScenarioRenderer | null,
): void {
  activeRenderer = renderer;
}

export function getActiveScenarioRenderer(): ScenarioRenderer | null {
  return activeRenderer;
}
