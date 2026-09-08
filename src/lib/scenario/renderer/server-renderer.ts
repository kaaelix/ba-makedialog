import fs from "fs";
import path from "path";
import {
  CHARACTER_BASE_X,
  CHARACTER_BASE_Y,
  GRADIENT_HEIGHT,
  LINE_Y,
  NAME_DEFAULT_Y,
  AFFILIATION_DEFAULT_Y,
  DIALOGUE_DEFAULT_Y,
  SCENARIO_LINE_HEIGHT,
  SCENARIO_LINE_WIDTH,
  SCENARIO_TEXT_FONT_SIZE,
  SCENARIO_VIEW_HEIGHT,
  SCENARIO_VIEW_WIDTH,
  TEXT_X,
} from "@/lib/scenario/constants";
import type {
  ScenarioCharacterData,
  ScenarioConfig,
  ScenarioGenerationResult,
} from "@/lib/scenario/types";
import { ChatImageBehavior } from "@/lib/scenario/behavior/chat-image-behavior";
import {
  getScenarioOutputDir,
  getScenarioStorageKey,
  storeScenarioBuffer,
} from "@/lib/scenario/storage";
import { encodeScenarioId } from "@/lib/scenario/script/normalizer";
import {
  formatDialogueLines,
  isCharacterSpeaking,
  revealFormattedLines,
  type FormattedLine,
} from "@/lib/scenario/dialogue-formatter";
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { PNG } from "pngjs";

// Lazy-loaded pureimage
let PImage: any = null;
let fontLoaded = false;

async function getPureImage() {
  if (!PImage) {
    try {
      PImage = await import("pureimage");
    } catch {
      // Fallback require
      PImage = require("pureimage");
    }
  }

  if (!fontLoaded && PImage) {
    const regularFontPath = path.join(
      process.cwd(),
      "public",
      "assets",
      "fonts",
      "noto-sans",
      "NotoSans-Regular.ttf",
    );
    const boldFontPath = path.join(
      process.cwd(),
      "public",
      "assets",
      "fonts",
      "noto-sans",
      "NotoSans-SemiBold.ttf",
    );

    if (fs.existsSync(regularFontPath)) {
      try {
        const regularFont = PImage.registerFont(regularFontPath, "Noto Sans");
        await regularFont.load();
      } catch (e) {
        console.warn("Could not register Noto Sans font in pureimage:", e);
      }
    }

    if (fs.existsSync(boldFontPath)) {
      try {
        const boldFont = PImage.registerFont(boldFontPath, "Noto Sans Bold");
        await boldFont.load();
      } catch (e) {
        console.warn("Could not register Noto Sans Bold font in pureimage:", e);
      }
    }

    const jpFontPath = path.join(
      process.cwd(),
      "public",
      "assets",
      "fonts",
      "shinmgoupr",
      "U-OTF-ShinMGoUpr-Medium.otf",
    );
    if (fs.existsSync(jpFontPath)) {
      try {
        const jpFont = PImage.registerFont(jpFontPath, "ShinMGoUpr");
        await jpFont.load();
      } catch (e) {
        console.warn("Could not register ShinMGoUpr font in pureimage:", e);
      }
    }

    fontLoaded = true;
  }

  return PImage;
}

// In-memory image buffer cache
const imageCache = new Map<string, any>();

async function fetchImageBitmap(urlOrPath: string, pi: any) {
  if (!urlOrPath) return null;
  if (imageCache.has(urlOrPath)) {
    return imageCache.get(urlOrPath);
  }

  try {
    let buffer: Buffer;

    if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
      const res = await fetch(urlOrPath, {
        cache: "no-store",
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept:
            "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
      });
      if (!res.ok) {
        console.warn(`HTTP ${res.status} fetching image: ${urlOrPath}`);
        return null;
      }
      const arrayBuffer = await res.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      const localPath = urlOrPath.startsWith("/")
        ? path.join(process.cwd(), "public", urlOrPath)
        : path.join(process.cwd(), urlOrPath);
      if (!fs.existsSync(localPath)) {
        return null;
      }
      buffer = fs.readFileSync(localPath);
    }

    // Decode depending on format
    let bitmap = null;
    const isJpeg =
      (buffer[0] === 0xff && buffer[1] === 0xd8) ||
      urlOrPath.toLowerCase().endsWith(".jpg") ||
      urlOrPath.toLowerCase().endsWith(".jpeg");

    if (isJpeg) {
      try {
        const jpegMod = await import("jpeg-js");
        const jpeg = (jpegMod as any).default || jpegMod;
        const raw = jpeg.decode(buffer, { useTArray: true });
        if (raw && raw.width && raw.height) {
          bitmap = pi.make(raw.width, raw.height);
          bitmap.data.set(raw.data);
        }
      } catch (err) {
        console.warn(`jpeg-js fast decode failed for ${urlOrPath}:`, err);
      }

      if (!bitmap) {
        try {
          const { Readable } = await import("stream");
          bitmap = await pi.decodeJPEGFromStream(Readable.from(buffer));
        } catch (streamErr) {
          console.warn(`pureimage decodeJPEGFromStream failed for ${urlOrPath}:`, streamErr);
          bitmap = null;
        }
      }
    } else {
      // PNG primary: fast direct synchronous buffer read
      try {
        const png = PNG.sync.read(buffer);
        bitmap = pi.make(png.width, png.height);
        bitmap.data.set(png.data);
      } catch {
        // Fallback to pureimage stream decoder
        try {
          const { Readable } = await import("stream");
          bitmap = await pi.decodePNGFromStream(Readable.from(buffer));
        } catch {
          bitmap = null;
        }
      }
    }

    if (bitmap) {
      imageCache.set(urlOrPath, bitmap);
    }
    return bitmap;
  } catch (err) {
    console.warn(`Failed to decode image from ${urlOrPath}:`, err);
    return null;
  }
}

function blitBackground(
  canvas: any,
  bgBitmap: any,
  scale: number = 1,
  xOffset: number = 0,
  yOffset: number = 0,
): boolean {
  if (!canvas?.data || !bgBitmap?.data) return false;
  const width = canvas.width;
  const height = canvas.height;
  const srcWidth = bgBitmap.width;
  const srcHeight = bgBitmap.height;
  if (!width || !height || !srcWidth || !srcHeight) return false;

  const aspectRatio = srcWidth / srcHeight;
  const targetAspect = width / height;
  const isWider = aspectRatio > targetAspect;

  const baseScaledWidth = isWider ? height * aspectRatio : width;
  const baseScaledHeight = isWider ? height : width / aspectRatio;

  const scaledW = baseScaledWidth * scale;
  const scaledH = baseScaledHeight * scale;
  const drawX = (width - scaledW) / 2 + xOffset;
  const drawY = (height - scaledH) / 2 + yOffset;

  const invW = srcWidth / scaledW;
  const invH = srcHeight / scaledH;

  const destData = canvas.data;
  const srcData = bgBitmap.data;

  for (let y = 0; y < height; y++) {
    const srcY = Math.floor((y - drawY) * invH);
    if (srcY < 0 || srcY >= srcHeight) continue;
    const srcRow = srcY * srcWidth;
    const destRow = y * width;
    for (let x = 0; x < width; x++) {
      const srcX = Math.floor((x - drawX) * invW);
      if (srcX < 0 || srcX >= srcWidth) continue;
      const srcIdx = (srcRow + srcX) << 2;
      const destIdx = (destRow + x) << 2;
      destData[destIdx] = srcData[srcIdx];
      destData[destIdx + 1] = srcData[srcIdx + 1];
      destData[destIdx + 2] = srcData[srcIdx + 2];
      destData[destIdx + 3] = 255;
    }
  }
  return true;
}

function wrapText(
  text: string,
  ctx?: any,
  maxWidth: number = SCENARIO_LINE_WIDTH,
): string[] {
  if (!text) return [];
  const rawLines = text.split("\n");
  const result: string[] = [];

  for (const rawLine of rawLines) {
    if (ctx && typeof ctx.measureText === "function") {
      const lineMetrics = ctx.measureText(rawLine);
      if (lineMetrics && lineMetrics.width <= maxWidth) {
        result.push(rawLine);
        continue;
      }
    }

    const words = rawLine.split(" ");
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      let fits = false;
      if (ctx && typeof ctx.measureText === "function") {
        const m = ctx.measureText(testLine);
        fits = m && m.width <= maxWidth;
      } else {
        fits = testLine.length <= 56;
      }

      if (fits) {
        currentLine = testLine;
      } else {
        if (currentLine) result.push(currentLine);
        // If single word or continuous text exceeds maxWidth, wrap character-by-character
        if (ctx && typeof ctx.measureText === "function" && ctx.measureText(word)?.width > maxWidth) {
          let subLine = "";
          for (const ch of word) {
            const testChar = subLine + ch;
            if (ctx.measureText(testChar)?.width <= maxWidth) {
              subLine = testChar;
            } else {
              if (subLine) result.push(subLine);
              subLine = ch;
            }
          }
          currentLine = subLine;
        } else {
          currentLine = word;
        }
      }
    }
    if (currentLine) result.push(currentLine);
  }

  return result;
}

function revealText(lines: string[], charsToShow: number): string[] {
  let shown = 0;
  const result: string[] = [];

  for (const line of lines) {
    if (shown >= charsToShow) {
      break;
    }

    const remaining = charsToShow - shown;

    if (line.length <= remaining) {
      result.push(line);
      shown += line.length;
    } else {
      result.push(line.slice(0, remaining));
      shown += remaining;
      break;
    }
  }

  return result;
}

function getOutputDir(): string {
  return getScenarioOutputDir();
}

function drawOutlinedText(
  ctx: any,
  text: string,
  x: number,
  y: number,
  fillColor: string,
  strokeColor = "#182c40",
  strokeWidth = 1.5,
  isMonologue = false,
) {
  if (!text) return;
  const w = strokeWidth;
  const d = w * 0.707;
  const offsets = [
    [-w, 0],
    [w, 0],
    [0, -w],
    [0, w],
    [-d, -d],
    [d, -d],
    [-d, d],
    [d, d],
  ];

  if (isMonologue) {
    ctx.save();
    ctx.translate(x, y);
    ctx.transform(1, 0, -0.18, 1, 0, 0);
    ctx.translate(-x, -y);
  }

  ctx.fillStyle = strokeColor;
  for (const [dx, dy] of offsets) {
    ctx.fillText(text, x + dx, y + dy);
  }

  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);

  if (isMonologue) {
    ctx.restore();
  }
}

function applyFastBoxBlur(bitmap: any, radius = 8) {
  if (!bitmap?.data || radius <= 0) return;
  const w = bitmap.width;
  const h = bitmap.height;
  const data = bitmap.data;
  const size = w * h;
  const temp = new Uint8Array(size * 4);

  const r = radius;
  const windowSize = 2 * r + 1;
  const invWindow = 1 / windowSize;

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    const rowStart = y * w;
    let rSum = 0, gSum = 0, bSum = 0, aSum = 0;

    for (let i = -r; i <= r; i++) {
      const x = Math.min(w - 1, Math.max(0, i));
      const idx = (rowStart + x) << 2;
      rSum += data[idx];
      gSum += data[idx + 1];
      bSum += data[idx + 2];
      aSum += data[idx + 3];
    }

    for (let x = 0; x < w; x++) {
      const outIdx = (rowStart + x) << 2;
      temp[outIdx] = Math.round(rSum * invWindow);
      temp[outIdx + 1] = Math.round(gSum * invWindow);
      temp[outIdx + 2] = Math.round(bSum * invWindow);
      temp[outIdx + 3] = Math.round(aSum * invWindow);

      const nextX = Math.min(w - 1, x + r + 1);
      const prevX = Math.max(0, x - r);
      const nextIdx = (rowStart + nextX) << 2;
      const prevIdx = (rowStart + prevX) << 2;

      rSum += data[nextIdx] - data[prevIdx];
      gSum += data[nextIdx + 1] - data[prevIdx + 1];
      bSum += data[nextIdx + 2] - data[prevIdx + 2];
      aSum += data[nextIdx + 3] - data[prevIdx + 3];
    }
  }

  // Vertical pass
  for (let x = 0; x < w; x++) {
    let rSum = 0, gSum = 0, bSum = 0, aSum = 0;

    for (let i = -r; i <= r; i++) {
      const y = Math.min(h - 1, Math.max(0, i));
      const idx = (y * w + x) << 2;
      rSum += temp[idx];
      gSum += temp[idx + 1];
      bSum += temp[idx + 2];
      aSum += temp[idx + 3];
    }

    for (let y = 0; y < h; y++) {
      const outIdx = (y * w + x) << 2;
      data[outIdx] = Math.round(rSum * invWindow);
      data[outIdx + 1] = Math.round(gSum * invWindow);
      data[outIdx + 2] = Math.round(bSum * invWindow);
      data[outIdx + 3] = Math.round(aSum * invWindow);

      const nextY = Math.min(h - 1, y + r + 1);
      const prevY = Math.max(0, y - r);
      const nextIdx = (nextY * w + x) << 2;
      const prevIdx = (prevY * w + x) << 2;

      rSum += temp[nextIdx] - temp[prevIdx];
      gSum += temp[nextIdx + 1] - temp[prevIdx + 1];
      bSum += temp[nextIdx + 2] - temp[prevIdx + 2];
      aSum += temp[nextIdx + 3] - temp[prevIdx + 3];
    }
  }
}

export class ServerScenarioRenderer {
  /**
   * Renders the static base scene elements (Backdrop, Background, Characters, Vignette Gradient, Auto Buttons, Line, Name, Affiliation).
   * Cached and reused across animation frames for blazing fast 60 FPS rendering.
   */
  static async renderBaseFrame(config: ScenarioConfig, pi?: any): Promise<any> {
    const pure = pi || (await getPureImage());
    const canvas = pure.make(SCENARIO_VIEW_WIDTH, SCENARIO_VIEW_HEIGHT);
    const ctx = canvas.getContext("2d");

    const transparent = config.elements?.transparentBackground ?? false;

    // 1. Stage Backdrop
    if (!transparent) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, SCENARIO_VIEW_WIDTH, SCENARIO_VIEW_HEIGHT);
    }

    // 2. Background Image
    const bgUrl = config.background?.url || config.background?.image;
    if (bgUrl) {
      const bgBitmap = await fetchImageBitmap(bgUrl, pure);
      if (bgBitmap) {
        const scale = config.background?.scale ?? 1;
        const xOffset = config.background?.xOffset ?? 0;
        const yOffset = config.background?.yOffset ?? 0;

        const blitted = blitBackground(canvas, bgBitmap, scale, xOffset, yOffset);
        if (!blitted) {
          const aspectRatio = bgBitmap.width / bgBitmap.height;
          const targetAspect = SCENARIO_VIEW_WIDTH / SCENARIO_VIEW_HEIGHT;
          const isWider = aspectRatio > targetAspect;

          const baseScaledWidth = isWider
            ? SCENARIO_VIEW_HEIGHT * aspectRatio
            : SCENARIO_VIEW_WIDTH;
          const baseScaledHeight = isWider
            ? SCENARIO_VIEW_HEIGHT
            : SCENARIO_VIEW_WIDTH / aspectRatio;

          const scaledW = baseScaledWidth * scale;
          const scaledH = baseScaledHeight * scale;
          const drawX = (SCENARIO_VIEW_WIDTH - scaledW) / 2 + xOffset;
          const drawY = (SCENARIO_VIEW_HEIGHT - scaledH) / 2 + yOffset;

          ctx.drawImage(bgBitmap, 0, 0, bgBitmap.width, bgBitmap.height, drawX, drawY, scaledW, scaledH);
        }

        // Apply background depth-of-field blur if enabled
        if (config.background?.blur) {
          applyFastBoxBlur(canvas, 10);
        }
      }
    }

    // 3. Characters Layer
    if (config.characters && config.characters.length > 0) {
      const speakerName = config.content?.characterName || "";
      const totalChars = config.characters.length;

      // Draw non-speaking characters first (behind), then active speaker on top
      const sortedChars = [...config.characters]
        .map((char, originalIndex) => ({
          char,
          isSpeaking: isCharacterSpeaking(char, speakerName, totalChars),
          originalIndex,
        }))
        .sort((a, b) => {
          if (a.isSpeaking === b.isSpeaking) return a.originalIndex - b.originalIndex;
          return a.isSpeaking ? 1 : -1;
        });

      for (const item of sortedChars) {
        const char = item.char;
        const isInactive = !item.isSpeaking;
        if (!char.spriteUrl) continue;
        const charBitmap = await fetchImageBitmap(char.spriteUrl, pure);
        if (charBitmap) {
          const scaleMult = isInactive ? 0.93 : 1.0;
          const yOff = isInactive ? 16 : 0;
          const charScale = (char.scale ?? 1) * scaleMult;
          const drawW = charBitmap.width * charScale;
          const drawH = charBitmap.height * charScale;
          const drawX = CHARACTER_BASE_X + (char.x ?? 0) - drawW / 2;
          const drawY = CHARACTER_BASE_Y + (char.y ?? 0) + yOff;

          let charToDraw = charBitmap;

          if (isInactive || char.darken) {
            const greyBitmap = pure.make(charBitmap.width, charBitmap.height);
            greyBitmap.data.set(charBitmap.data);
            const data = greyBitmap.data;
            for (let p = 0; p < data.length; p += 4) {
              const a = data[p + 3];
              if (a === 0) continue;
              const r = data[p];
              const g = data[p + 1];
              const b = data[p + 2];
              const gray = 0.299 * r + 0.587 * g + 0.114 * b;
              data[p] = Math.min(255, Math.round((gray * 0.55 + r * 0.45) * 0.70));
              data[p + 1] = Math.min(255, Math.round((gray * 0.55 + g * 0.45) * 0.72));
              data[p + 2] = Math.min(255, Math.round((gray * 0.55 + b * 0.45) * 0.76));
            }
            charToDraw = greyBitmap;
          }

          if (char.blur) {
            const blurBitmap = pure.make(charToDraw.width, charToDraw.height);
            blurBitmap.data.set(charToDraw.data);
            applyFastBoxBlur(blurBitmap, 8);
            charToDraw = blurBitmap;
          }

          ctx.drawImage(charToDraw, 0, 0, charBitmap.width, charBitmap.height, drawX, drawY, drawW, drawH);
        }
      }
    }

    const hasContent = !!config.content?.dialogue;
    const displayGradient = config.elements?.displayGradient ?? true;
    const displayLine = config.elements?.displayLine ?? true;
    const displayButtons = config.elements?.displayButtons ?? true;

    // 4. Bottom Vignette Gradient
    if (hasContent && displayGradient) {
      const data = canvas.data;
      const width = SCENARIO_VIEW_WIDTH;
      const startY = SCENARIO_VIEW_HEIGHT - GRADIENT_HEIGHT;
      const gradR = 17;
      const gradG = 37;
      const gradB = 54;

      const rowR = new Int32Array(GRADIENT_HEIGHT);
      const rowG = new Int32Array(GRADIENT_HEIGHT);
      const rowB = new Int32Array(GRADIENT_HEIGHT);
      const rowInv = new Int32Array(GRADIENT_HEIGHT);

      for (let y = 0; y < GRADIENT_HEIGHT; y++) {
        const p = y / GRADIENT_HEIGHT;
        const alpha =
          p < 0.33
            ? (p / 0.33) * 0.75
            : p < 0.55
              ? 0.75 + ((p - 0.33) / 0.22) * 0.11
              : 0.86;
        const a256 = Math.round(alpha * 256);
        rowR[y] = gradR * a256;
        rowG[y] = gradG * a256;
        rowB[y] = gradB * a256;
        rowInv[y] = 256 - a256;
      }

      for (let y = 0; y < GRADIENT_HEIGHT; y++) {
        const rVal = rowR[y];
        const gVal = rowG[y];
        const bVal = rowB[y];
        const inv = rowInv[y];
        let idx = (startY + y) * width * 4;

        for (let x = 0; x < width; x++) {
          data[idx] = (rVal + data[idx] * inv) >> 8;
          data[idx + 1] = (gVal + data[idx + 1] * inv) >> 8;
          data[idx + 2] = (bVal + data[idx + 2] * inv) >> 8;
          idx += 4;
        }
      }
    }

    // 5. Auto Buttons
    if (displayButtons) {
      const btnPath = config.elements?.autoEnabled
        ? "/assets/ui/scenario-viewer/buttons_auto_on.png"
        : "/assets/ui/scenario-viewer/buttons_auto_off.png";
      const btnBitmap = await fetchImageBitmap(btnPath, pure);
      if (btnBitmap) {
        ctx.drawImage(
          btnBitmap,
          0,
          0,
          btnBitmap.width,
          btnBitmap.height,
          SCENARIO_VIEW_WIDTH - 20 - btnBitmap.width,
          25,
          btnBitmap.width,
          btnBitmap.height,
        );
      }
    }

    // 6. Dialogue Divider Line
    if (hasContent && displayLine) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.fillRect(TEXT_X, LINE_Y, SCENARIO_LINE_WIDTH, SCENARIO_LINE_HEIGHT);
    }

    // 7. Character Name & Affiliation (100% WebGL Match)
    const charName = config.content?.characterName || "";
    const affiliation = config.content?.affiliation || "";
    const isJpFont = config.font?.family === "ShinMGoUpr";
    const boldFontName = isJpFont ? "ShinMGoUpr" : "Noto Sans Bold";
    const nameY = config.font?.nameY ?? NAME_DEFAULT_Y;
    const affilY = config.font?.affiliationY ?? AFFILIATION_DEFAULT_Y;

    if (charName) {
      ctx.font = `57 ${boldFontName}`;
      ctx.textBaseline = "top";
      drawOutlinedText(ctx, charName, TEXT_X, nameY, "#ffffff", "#182c40", 2.0);

      if (affiliation) {
        const metrics = ctx.measureText(charName);
        const nameWidth = metrics?.width || charName.length * 35;
        ctx.font = `41 ${boldFontName}`;
        drawOutlinedText(
          ctx,
          affiliation,
          TEXT_X + nameWidth + 13,
          affilY,
          "#7accf9",
          "#182c40",
          1.5,
        );
      }
    }

    return canvas;
  }

  /**
   * Renders a single deterministic still scenario frame.
   */
  static async renderFrame(
    config: ScenarioConfig,
    options?: {
      dialogueTextOverride?: string;
      triangleYOffset?: number;
      showTriangle?: boolean;
    },
  ): Promise<any> {
    const pi = await getPureImage();
    const baseCanvas = await ServerScenarioRenderer.renderBaseFrame(config, pi);
    const canvas = pi.make(SCENARIO_VIEW_WIDTH, SCENARIO_VIEW_HEIGHT);
    canvas.data.set(baseCanvas.data);
    const ctx = canvas.getContext("2d");

    const hasContent = !!config.content?.dialogue || !!options?.dialogueTextOverride;
    const displayTriangle = config.elements?.displayTriangle ?? true;

    // 8. Dialogue Text
    const dialogueText =
      options?.dialogueTextOverride !== undefined
        ? options.dialogueTextOverride
        : config.content?.dialogue || "";

    if (dialogueText) {
      const isJpFont = config.font?.family === "ShinMGoUpr";
      const dialogueFontName = isJpFont ? "ShinMGoUpr" : "Noto Sans";
      const baseFontSize = config.fontSize ?? SCENARIO_TEXT_FONT_SIZE;
      const maxHeight = 185;
      const maxLineWidth = SCENARIO_LINE_WIDTH - 20;

      let fontSize = baseFontSize;
      let formattedLines: FormattedLine[] = [];
      let lineHeight = Math.round(1.35 * fontSize);

      while (fontSize >= 22) {
        ctx.font = `${fontSize} ${dialogueFontName}`;
        formattedLines = formatDialogueLines(
          dialogueText,
          (t) => ctx.measureText(t).width,
          maxLineWidth,
        );
        lineHeight = Math.round(1.32 * fontSize);
        if (formattedLines.length * lineHeight <= maxHeight || fontSize <= 22) {
          break;
        }
        fontSize -= 2;
      }

      ctx.font = `${fontSize} ${dialogueFontName}`;
      ctx.textBaseline = "top";

      formattedLines.forEach((line, i) => {
        const lineY = DIALOGUE_DEFAULT_Y + i * lineHeight;
        let currentX = TEXT_X + 4;
        line.forEach((chunk) => {
          if (!chunk.text) return;
          const fillColor = chunk.isAction ? "#94a3b8" : "#ffffff";
          drawOutlinedText(ctx, chunk.text, currentX, lineY, fillColor, "#182c40", 1.5, chunk.isAction);
          currentX += ctx.measureText(chunk.text).width;
        });
      });
    }

    // 9. Triangle Prompt Indicator
    const showTri = options?.showTriangle ?? true;
    if (hasContent && displayTriangle && showTri) {
      const triBitmap = await fetchImageBitmap(
        "/assets/ui/scenario-viewer/scennario-triangle.png",
        pi,
      );
      if (triBitmap) {
        const yOff = options?.triangleYOffset ?? 0;
        const triX = SCENARIO_VIEW_WIDTH - 133 - triBitmap.width;
        const triY = SCENARIO_VIEW_HEIGHT - 64 - triBitmap.height + yOff;
        ctx.drawImage(triBitmap, 0, 0, triBitmap.width, triBitmap.height, triX, triY, triBitmap.width, triBitmap.height);
      }
    }

    return canvas;
  }

  /**
   * Generates a PNG still image directly from config (No queues, immediate).
   */
  static async generatePNG(
    config: ScenarioConfig,
    baseUrl = "",
  ): Promise<ScenarioGenerationResult> {
    const startTime = Date.now();
    const pi = await getPureImage();
    const canvas = await ServerScenarioRenderer.renderFrame(config);

    const id = encodeScenarioId(config, "png");
    const safeKey = getScenarioStorageKey(id);
    const outputDir = getOutputDir();

    const filePath = path.join(outputDir, `${safeKey}.png`);
    const stream = fs.createWriteStream(filePath);
    await pi.encodePNGToStream(canvas, stream);

    const stat = fs.statSync(filePath);
    const publicUrl = baseUrl
      ? `${baseUrl}/api/generation/${id}/result`
      : `/api/generation/${id}/result`;

    const pngBuffer = fs.readFileSync(filePath);
    const dataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;

    // Cache in serverless memory
    storeScenarioBuffer(id, pngBuffer, "png");

    const primaryChar = config.characters?.[0];
    const charName = config.content?.characterName || "Hoshino";
    const emotion = primaryChar?.selectedExpression || "neutral";
    const bgUrl =
      config.background?.url ||
      "https://lh3.googleusercontent.com/d/1_BxnV-AyJui7SCHGbYZxxNzG4vGo_ydh";

    const result: ScenarioGenerationResult = {
      success: true,
      type: "image",
      id,
      url: publicUrl,
      dataUrl,
      width: SCENARIO_VIEW_WIDTH,
      height: SCENARIO_VIEW_HEIGHT,
      sizeBytes: stat.size,
      durationMs: Date.now() - startTime,
      emotion,
      character: {
        name: charName,
        id: primaryChar?.id || "ch_ch0241",
        emotion,
        spriteUrl: primaryChar?.spriteUrl || "",
        x: primaryChar?.x ?? 0,
        y: primaryChar?.y ?? 0,
        scale: primaryChar?.scale ?? 1,
      },
      characters: config.characters || [],
      background: {
        name: config.background?.image || "Classroom",
        url: bgUrl,
        x: config.background?.xOffset ?? 0,
        y: config.background?.yOffset ?? 0,
        scale: config.background?.scale ?? 1,
      },
    };

    if (config.output?.mode === "chat" || config.behavior?.type === "chat_image") {
      return ChatImageBehavior.apply(result, config.content?.characterName ?? "Scenario");
    }

    return result;
  }

  /**
   * Generates an animated 60 FPS GIF directly from config using cached base frame compositing.
   */
  static async generateGIF(
    config: ScenarioConfig,
    baseUrl = "",
  ): Promise<ScenarioGenerationResult> {
    const startTime = Date.now();
    const dialogue = config.content?.dialogue || "";
    const primaryChar = config.characters?.[0];
    const charName = config.content?.characterName || "Hoshino";
    const emotion = primaryChar?.selectedExpression || "neutral";
    const bgUrl =
      config.background?.url ||
      "https://lh3.googleusercontent.com/d/1_BxnV-AyJui7SCHGbYZxxNzG4vGo_ydh";

    const pi = await getPureImage();
    const baseCanvas = await ServerScenarioRenderer.renderBaseFrame(config, pi);
    const triBitmap = await fetchImageBitmap(
      "/assets/ui/scenario-viewer/scennario-triangle.png",
      pi,
    );

    const speed = (config as any).speed || (config as any).gifSpeed || config.behavior?.speed || "normal";
    const speedMult =
      typeof speed === "number" && !isNaN(speed) && speed > 0
        ? speed
        : speed === "slow" || speed === "lambat" || speed === "pelan"
          ? 0.6
          : speed === "fast" || speed === "cepat"
            ? 1.8
            : 1.0;

    // 30 FPS frame delay (33ms per frame)
    const frameDelay = 33;
    const isJpFont = config.font?.family === "ShinMGoUpr";
    const dialogueFontName = isJpFont ? "ShinMGoUpr" : "Noto Sans";
    const baseFontSize = config.fontSize ?? SCENARIO_TEXT_FONT_SIZE;
    const maxHeight = 185;
    const maxLineWidth = SCENARIO_LINE_WIDTH - 20;

    let fontSize = baseFontSize;
    let fullFormattedLines: FormattedLine[] = [];
    let lineHeight = Math.round(1.35 * fontSize);

    const tempCanvas = pi.make(100, 100);
    const tempCtx = tempCanvas.getContext("2d");

    while (fontSize >= 22) {
      tempCtx.font = `${fontSize} ${dialogueFontName}`;
      fullFormattedLines = formatDialogueLines(
        dialogue,
        (t) => tempCtx.measureText(t).width,
        maxLineWidth,
      );
      lineHeight = Math.round(1.32 * fontSize);
      if (fullFormattedLines.length * lineHeight <= maxHeight || fontSize <= 22) {
        break;
      }
      fontSize -= 2;
    }

    const charsPerStep = Math.max(1, Math.round(1.6 * speedMult));
    const typewriterSteps = Math.max(12, Math.min(80, Math.ceil(dialogue.length / charsPerStep)));
    const holdFrames = Math.max(24, Math.round(30 * 1.5)); // ~1.5s reading hold
    const frameCanvases: Array<{ canvas: any; delay: number }> = [];

    const renderLinesAndTriangle = (lines: FormattedLine[], showTriangle: boolean, yOffset: number) => {
      const frameCanvas = pi.make(SCENARIO_VIEW_WIDTH, SCENARIO_VIEW_HEIGHT);
      frameCanvas.data.set(baseCanvas.data);
      const ctx = frameCanvas.getContext("2d");

      if (lines.length > 0) {
        ctx.font = `${fontSize} ${dialogueFontName}`;
        ctx.textBaseline = "top";
        lines.forEach((line, i) => {
          const lineY = DIALOGUE_DEFAULT_Y + i * lineHeight;
          let currentX = TEXT_X + 4;
          line.forEach((chunk) => {
            if (!chunk.text) return;
            const fillColor = chunk.isAction ? "#94a3b8" : "#ffffff";
            drawOutlinedText(ctx, chunk.text, currentX, lineY, fillColor, "#182c40", 1.5, chunk.isAction);
            currentX += ctx.measureText(chunk.text).width;
          });
        });
      }

      if (showTriangle && triBitmap) {
        const triX = SCENARIO_VIEW_WIDTH - 133 - triBitmap.width;
        const triY = SCENARIO_VIEW_HEIGHT - 64 - triBitmap.height + yOffset;
        ctx.drawImage(
          triBitmap,
          0,
          0,
          triBitmap.width,
          triBitmap.height,
          triX,
          triY,
          triBitmap.width,
          triBitmap.height,
        );
      }

      return frameCanvas;
    };

    // 1. Smooth 30 FPS Typewriter Progression
    for (let i = 0; i < typewriterSteps; i++) {
      const charCount = Math.min(
        dialogue.length,
        Math.max(1, Math.floor((i + 1) * charsPerStep)),
      );
      const currentLines = revealFormattedLines(fullFormattedLines, charCount);
      const frame = renderLinesAndTriangle(currentLines, false, 0);
      frameCanvases.push({ canvas: frame, delay: frameDelay });
    }

    // 2. Generous 1.5s Reading Hold with Triangle Bobbing
    for (let b = 0; b < holdFrames; b++) {
      const bobY = Math.round(Math.abs(Math.sin((b / 15) * Math.PI)) * 8);
      const frame = renderLinesAndTriangle(fullFormattedLines, true, bobY);
      frameCanvases.push({ canvas: frame, delay: frameDelay });
    }

    // Downscale to 960x540 for visual novel presentation and fast encoding
    const gifWidth = 960;
    const gifHeight = 540;
    const gif = GIFEncoder();

    // Fast synchronous downsampler avoiding 13 million getPixelRGBA function calls
    const downsampleCanvasToRgba = (srcCanvas: any): Uint8Array => {
      const rgba = new Uint8Array(gifWidth * gifHeight * 4);
      const srcData = srcCanvas.data;
      const srcW = SCENARIO_VIEW_WIDTH;
      const srcH = SCENARIO_VIEW_HEIGHT;

      for (let y = 0; y < gifHeight; y++) {
        const srcRow = Math.floor((y / gifHeight) * srcH) * srcW;
        const dstRow = y * gifWidth;
        for (let x = 0; x < gifWidth; x++) {
          const srcX = Math.floor((x / gifWidth) * srcW);
          const srcIdx = (srcRow + srcX) << 2;
          const dstIdx = (dstRow + x) << 2;
          rgba[dstIdx] = srcData[srcIdx];
          rgba[dstIdx + 1] = srcData[srcIdx + 1];
          rgba[dstIdx + 2] = srcData[srcIdx + 2];
          rgba[dstIdx + 3] = srcData[srcIdx + 3];
        }
      }
      return rgba;
    };

    // Pre-sample color palette once from the final frame (which contains all characters, background, dialogue, triangle)
    const finalFrameCanvas = frameCanvases[frameCanvases.length - 1].canvas;
    const sampleRgba = downsampleCanvasToRgba(finalFrameCanvas);
    const sharedPalette = quantize(sampleRgba, 128);

    for (const { canvas, delay } of frameCanvases) {
      const rgba = downsampleCanvasToRgba(canvas);
      const index = applyPalette(rgba, sharedPalette);
      gif.writeFrame(index, gifWidth, gifHeight, { palette: sharedPalette, delay });
    }

    gif.finish();
    const gifBuffer = Buffer.from(gif.bytes());

    const id = encodeScenarioId(config, "gif");
    const safeKey = getScenarioStorageKey(id);
    const outputDir = getOutputDir();

    const filePath = path.join(outputDir, `${safeKey}.gif`);
    fs.writeFileSync(filePath, gifBuffer);

    const publicUrl = baseUrl
      ? `${baseUrl}/api/generation/${id}/result`
      : `/api/generation/${id}/result`;

    const gifDataUrl = `data:image/gif;base64,${gifBuffer.toString("base64")}`;

    // Cache in serverless memory
    storeScenarioBuffer(id, gifBuffer, "gif");

    const result: ScenarioGenerationResult = {
      success: true,
      type: "animation",
      id,
      url: publicUrl,
      dataUrl: gifDataUrl,
      width: gifWidth,
      height: gifHeight,
      sizeBytes: gifBuffer.length,
      durationMs: Date.now() - startTime,
      emotion,
      speed: String(speed),
      character: {
        name: charName,
        id: primaryChar?.id || "ch_ch0241",
        emotion,
        spriteUrl: primaryChar?.spriteUrl || "",
        x: primaryChar?.x ?? 0,
        y: primaryChar?.y ?? 0,
        scale: primaryChar?.scale ?? 1,
      },
      characters: config.characters || [],
      background: {
        name: config.background?.image || "Classroom",
        url: bgUrl,
        x: config.background?.xOffset ?? 0,
        y: config.background?.yOffset ?? 0,
        scale: config.background?.scale ?? 1,
      },
    };

    if (config.output?.mode === "chat" || config.behavior?.type === "chat_image") {
      return ChatImageBehavior.apply(result, config.content?.characterName ?? "Scenario GIF");
    }

    return result;
  }
}
