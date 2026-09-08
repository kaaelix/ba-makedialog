import { assetCatalog } from "@/lib/assets/catalog";
import {
  SCENARIO_TEXT_FONT_SIZE,
  SCENARIO_TEXT_SCROLL_SPEED,
} from "@/lib/scenario/constants";
import { SCENARIO_FONT_EN } from "@/lib/scenario/fonts";
import { parseScenarioScript } from "@/lib/scenario/script/parser";
import {
  findSpriteByReactionOrExpression,
  detectDialogueEmotion,
} from "@/lib/scenario/reaction-helper";
import { compositionAgent } from "@/lib/agents/composition-agent";
import type {
  ScenarioCharacterData,
  ScenarioConfig,
} from "@/lib/scenario/types";

const DEFAULT_BG_URL =
  "https://lh3.googleusercontent.com/d/1_BxnV-AyJui7SCHGbYZxxNzG4vGo_ydh";
const DEFAULT_BG_NAME = "Classroom";

const DEFAULT_CHAR_ID = "ch_ch0241";
const DEFAULT_CHAR_NAME = "Hoshino";
const DEFAULT_CHAR_AFFILIATION = "Abydos High School";
const DEFAULT_CHAR_SPRITE_URL =
  "https://lh3.googleusercontent.com/d/1ftSBvFiJf5qZj90vXKCUclOqrhBV6FlH";
const DEFAULT_CHAR_FILENAME = "CH0241_default_00.png";

export function parseNumeric(val: any, fallback: number): number {
  if (val === undefined || val === null || val === "") return fallback;
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * Normalizes any scenario input payload (script, flat properties, query params, or config)
 * into a fully populated, deterministic ScenarioConfig matching the WebGL renderer.
 */
export function normalizeScenarioInput(raw: any): ScenarioConfig {
  if (!raw || typeof raw !== "object") {
    raw = {};
  }

  // Check if input is wrapped in a config field
  const src = raw.config && typeof raw.config === "object" ? raw.config : raw;

  // Resolve raw inputs supporting asset IDs and aliases
  let rawChar =
    src.characterId ??
    src.charId ??
    src.char_id ??
    src.character_id ??
    src.studentId ??
    src.student_id ??
    src.content?.characterName ??
    src.characterName ??
    src.name ??
    src.character ??
    src.student ??
    src.char ??
    "";

  let affiliation =
    src.content?.affiliation ?? src.affiliation ?? src.school ?? "";

  let dialogue =
    src.content?.dialogue ??
    src.dialogue ??
    src.content ??
    src.text ??
    src.message ??
    "";

  let bgInput =
    src.backgroundId ??
    src.bgId ??
    src.background_id ??
    src.bg_id ??
    src.background?.url ??
    src.background?.image ??
    src.backgroundUrl ??
    src.backgroundName ??
    src.background ??
    src.bg ??
    "";

  let expression =
    src.emotion ??
    src.reaction ??
    src.expression ??
    src.expressionId ??
    src.exprId ??
    src.expr ??
    "";

  // 1. Process script if provided
  const scriptText = typeof src.script === "string" ? src.script.trim() : "";
  if (scriptText) {
    // If structured command script (#001 ...), parse with parseScenarioScript
    if (scriptText.includes("#") || scriptText.includes("MESSAGE")) {
      const parsed = parseScenarioScript(scriptText);
      for (const ev of parsed.events) {
        for (const cmd of ev.commands) {
          if (cmd.type === "NAME") {
            rawChar = cmd.name;
          } else if (cmd.type === "AFFILIATION") {
            affiliation = cmd.affiliation;
          } else if (cmd.type === "MESSAGE") {
            dialogue = cmd.message;
          } else if (cmd.type === "CHARA_EXPR") {
            expression = cmd.expression;
          }
        }
      }
    } else {
      // Simple format: "Name: Dialogue" or single dialogue line
      const colonIdx = scriptText.indexOf(":");
      if (colonIdx > 0 && colonIdx < 30) {
        const potentialName = scriptText.slice(0, colonIdx).trim();
        const potentialText = scriptText.slice(colonIdx + 1).trim();
        if (!rawChar) rawChar = potentialName;
        if (!dialogue) dialogue = potentialText;
      } else if (!dialogue) {
        dialogue = scriptText;
      }
    }
  }

  // Fallbacks if dialogue is still empty
  if (!dialogue) {
    dialogue =
      "Uhe~ Sensei, are you still awake? Working this late isn't good for your health, you know~";
  }

  // If no explicit expression was supplied, auto-align expression with dialogue emotion
  if (!expression && dialogue) {
    const detected = detectDialogueEmotion(dialogue);
    if (detected) {
      expression = detected.category;
    }
  }

  // Lookup student in catalog by ID or by name
  let characterName = "";
  let matchedStudent =
    (rawChar ? assetCatalog.getAssetById(rawChar) : undefined) ||
    (rawChar ? assetCatalog.findCharacterByName(rawChar) : undefined);

  if (matchedStudent) {
    characterName = matchedStudent.name;
    if (!affiliation) {
      affiliation =
        matchedStudent.school ||
        matchedStudent.metadata?.school ||
        DEFAULT_CHAR_AFFILIATION;
    }
  } else if (rawChar) {
    characterName = rawChar;
  } else {
    characterName = DEFAULT_CHAR_NAME;
    matchedStudent = assetCatalog.getAssetById(DEFAULT_CHAR_ID);
  }

  if (!affiliation) {
    affiliation = DEFAULT_CHAR_AFFILIATION;
  }

  // 2. Resolve Background
  let backgroundUrl = DEFAULT_BG_URL;
  let backgroundName = DEFAULT_BG_NAME;

  if (typeof bgInput === "string" && bgInput.trim().length > 0) {
    const trimmed = bgInput.trim();
    if (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("/")
    ) {
      backgroundUrl = trimmed;
      backgroundName = src.backgroundName || "Custom Background";
    } else {
      const foundBg =
        assetCatalog.getAssetById(trimmed) ||
        assetCatalog.findBackgroundByNameOrLocation(trimmed);
      if (foundBg && foundBg.url) {
        backgroundUrl = foundBg.url;
        backgroundName = foundBg.name;
      } else {
        backgroundName = trimmed;
      }
    }
  } else if (src.background?.url) {
    backgroundUrl = src.background.url;
    backgroundName = src.background.name || DEFAULT_BG_NAME;
  }

  // 3. Resolve Characters array
  let characters: ScenarioCharacterData[] = [];

  // Parse multi-character sources (src.characters as JSON string or array, src.students, char1..charN)
  let rawCharList: any[] | null = null;
  if (Array.isArray(src.characters) && src.characters.length > 0) {
    rawCharList = src.characters;
  } else if (typeof src.characters === "string" && src.characters.trim().length > 0) {
    try {
      const parsed = JSON.parse(src.characters);
      if (Array.isArray(parsed)) rawCharList = parsed;
    } catch {
      rawCharList = src.characters.split(",").map((s: string) => ({ name: s.trim() }));
    }
  } else if (Array.isArray(src.students) && src.students.length > 0) {
    rawCharList = src.students;
  } else if (typeof src.students === "string" && src.students.trim().length > 0) {
    try {
      const parsed = JSON.parse(src.students);
      if (Array.isArray(parsed)) rawCharList = parsed;
    } catch {
      rawCharList = src.students.split(",").map((s: string) => ({ name: s.trim() }));
    }
  } else {
    // Check for indexed parameters: char1, char2, character1, character2, student1, student2
    const indexed: any[] = [];
    for (let i = 1; i <= 6; i++) {
      const item = src[`character${i}`] ?? src[`char${i}`] ?? src[`student${i}`];
      if (item) {
        indexed.push(
          typeof item === "object"
            ? item
            : {
                name: item,
                expression:
                  src[`character${i}_expr`] ??
                  src[`char${i}_expr`] ??
                  src[`character${i}_emotion`] ??
                  src[`expression${i}`] ??
                  src[`expr${i}`],
                x: parseNumeric(src[`character${i}_x`] ?? src[`char${i}_x`] ?? src[`x${i}`], 0),
                y: parseNumeric(src[`character${i}_y`] ?? src[`char${i}_y`] ?? src[`y${i}`], 0),
                scale: parseNumeric(src[`character${i}_scale`] ?? src[`char${i}_scale`] ?? src[`scale${i}`], 1),
              },
        );
      }
    }
    if (indexed.length > 0) {
      rawCharList = indexed;
    }
  }

  if (rawCharList && rawCharList.length > 0) {
    characters = rawCharList.map((rawItem: any, idx: number) => {
      const c = typeof rawItem === "string" ? { name: rawItem } : rawItem;
      let spriteUrl = c.spriteUrl || "";
      let filename = c.filename || `${c.name || "character"}.png`;
      let charStudent = null;

      const charQuery = c.id || c.characterId || c.studentId || c.name;
      if (charQuery) {
        charStudent =
          assetCatalog.getAssetById(charQuery) ||
          assetCatalog.findCharacterByName(charQuery);
      }

      const itemExpr = c.expression || c.emotion || c.reaction || (idx === 0 ? expression : "");

      if (!spriteUrl && charStudent) {
        const sprites =
          (charStudent?.metadata as any)?.sprites ||
          assetCatalog.getCharacterSprites(charStudent?.id || charQuery);

        if (sprites && sprites.length > 0) {
          const picked = itemExpr
            ? findSpriteByReactionOrExpression(sprites, itemExpr) || sprites[0]
            : sprites[0];
          spriteUrl = picked.url;
          filename = picked.fileName;
        } else if (charStudent.url) {
          spriteUrl = charStudent.url;
        }
      }

      if (!spriteUrl) {
        spriteUrl = DEFAULT_CHAR_SPRITE_URL;
        filename = DEFAULT_CHAR_FILENAME;
      }

      return {
        id: c.id || charStudent?.id || `char_${idx}`,
        name: c.name || charStudent?.name || (idx === 0 ? characterName : `Student ${idx + 1}`),
        spriteUrl,
        filename,
        timestamp: c.timestamp || Date.now(),
        x: typeof c.x === "number" ? c.x : 0,
        y: typeof c.y === "number" ? c.y : 0,
        scale: typeof c.scale === "number" ? c.scale : 1,
        darken: !!c.darken,
        hologram: !!c.hologram,
        silhouette: !!c.silhouette,
        silhouetteColor: c.silhouetteColor,
        blur: !!c.blur,
        selectedExpression: itemExpr || "neutral",
      };
    });
  } else {
    // Generate single primary character from student lookup
    let spriteUrl = src.spriteUrl || "";
    let filename = src.filename || `${characterName}.png`;

    const sprites =
      (matchedStudent?.metadata as any)?.sprites ||
      assetCatalog.getCharacterSprites(matchedStudent?.id || characterName);

    if (sprites && sprites.length > 0) {
      const picked = expression
        ? findSpriteByReactionOrExpression(sprites, expression) || sprites[0]
        : sprites[0];
      spriteUrl = picked.url;
      filename = picked.fileName;
    } else if (matchedStudent && matchedStudent.url) {
      spriteUrl = matchedStudent.url;
    }

    if (!spriteUrl) {
      spriteUrl = DEFAULT_CHAR_SPRITE_URL;
      filename = DEFAULT_CHAR_FILENAME;
    }

    const charX = parseNumeric(
      src.characterX ?? src.charX ?? src.char_x ?? src.character_x ?? src.x,
      0,
    );
    const charY = parseNumeric(
      src.characterY ?? src.charY ?? src.char_y ?? src.character_y ?? src.y,
      0,
    );
    const charScale = parseNumeric(
      src.characterScale ??
        src.charScale ??
        src.char_scale ??
        src.character_scale ??
        src.scale,
      1,
    );

    characters = [
      {
        id: matchedStudent?.id || DEFAULT_CHAR_ID,
        name: characterName,
        spriteUrl,
        filename,
        timestamp: Date.now(),
        x: charX,
        y: charY,
        scale: charScale,
        selectedExpression: expression || "neutral",
        darken: false,
        hologram: false,
        silhouette: false,
        blur: !!(src.characterBlur ?? src.charBlur ?? src.character?.blur),
      },
    ];
  }

  const bgScale = parseNumeric(
    src.background?.scale ??
      src.backgroundScale ??
      src.bgScale ??
      src.bg_scale ??
      src.zoom,
    1,
  );
  const bgX = parseNumeric(
    src.background?.xOffset ??
      src.backgroundXOffset ??
      src.backgroundX ??
      src.bgX ??
      src.bg_x ??
      src.bg_x_offset,
    0,
  );
  const bgY = parseNumeric(
    src.background?.yOffset ??
      src.backgroundYOffset ??
      src.backgroundY ??
      src.bgY ??
      src.bg_y ??
      src.bg_y_offset,
    0,
  );

  // 4. Resolve Speed
  let speed = "normal";
  const rawSpeed =
    src.speed ??
    src.gifSpeed ??
    src.speedMode ??
    src.behavior?.speed;
  if (typeof rawSpeed === "string") {
    const s = rawSpeed.toLowerCase().trim();
    if (s === "slow" || s === "lambat" || s === "pelan") {
      speed = "slow";
    } else if (s === "fast" || s === "cepat") {
      speed = "fast";
    } else {
      speed = "normal";
    }
  } else if (typeof rawSpeed === "number" && !isNaN(rawSpeed)) {
    if (rawSpeed <= 0.7) {
      speed = "slow";
    } else if (rawSpeed >= 1.4) {
      speed = "fast";
    } else {
      speed = "normal";
    }
  }

  const isGif =
    src.format === "gif" ||
    src.output?.format === "gif" ||
    !!src.animate ||
    src.output?.type === "animation";

  // 5. Construct the standard ScenarioConfig
  const config: ScenarioConfig = {
    content: {
      characterName,
      affiliation,
      dialogue,
    },
    background: {
      mode: "url",
      url: backgroundUrl,
      scale: bgScale,
      xOffset: bgX,
      yOffset: bgY,
      blur: !!(src.background?.blur ?? src.backgroundBlur ?? src.bgBlur ?? src.blur),
    },
    characters,
    font: src.font || SCENARIO_FONT_EN,
    fontSize:
      typeof src.fontSize === "number" ? src.fontSize : SCENARIO_TEXT_FONT_SIZE,
    elements: {
      displayButtons:
        src.elements?.displayButtons ?? src.displayButtons ?? true,
      autoEnabled: src.elements?.autoEnabled ?? src.autoEnabled ?? false,
      displayLine: src.elements?.displayLine ?? src.displayLine ?? true,
      displayGradient:
        src.elements?.displayGradient ?? src.displayGradient ?? true,
      displayTriangle:
        src.elements?.displayTriangle ?? src.displayTriangle ?? true,
      transparentBackground:
        src.elements?.transparentBackground ??
        src.transparentBackground ??
        false,
    },
    behavior: {
      type: "chat_image",
      markdown: true,
      scrollSpeed:
        typeof src.scrollSpeed === "number"
          ? src.scrollSpeed
          : SCENARIO_TEXT_SCROLL_SPEED,
      animate: isGif,
      speed: speed as any,
    },
    output: {
      type: (isGif ? "animation" : "image") as any,
      mode: (src.output?.mode || "chat") as any,
      format: (isGif ? "gif" : "png") as any,
    },
    speed: speed as any,
    gifSpeed: speed as any,
    format: (isGif ? "gif" : "png") as any,
    script: scriptText,
  };

  return compositionAgent.compose(config);
}

export interface CompactScenarioPayload {
  c?: string; // characterId or query
  n?: string; // character name
  a?: string; // affiliation
  d?: string; // dialogue
  b?: string; // backgroundId or url
  e?: string; // emotion text (e.g. "angry", "happy")
  t?: boolean; // transparentBackground
  x?: number; // character x
  y?: number; // character y
  s?: number; // character scale
  bx?: number; // background x offset
  by?: number; // background y offset
  bs?: number; // background zoom scale
  sp?: string; // speed ("slow" | "normal" | "fast")
}

export function encodeScenarioId(
  config: ScenarioConfig,
  type?: "png" | "gif",
): string {
  const primaryChar = config.characters?.[0];
  const payload: CompactScenarioPayload = {};
  if (primaryChar?.id) payload.c = primaryChar.id;
  if (config.content?.characterName) payload.n = config.content.characterName;
  if (config.content?.affiliation) payload.a = config.content.affiliation;
  if (config.content?.dialogue) payload.d = config.content.dialogue;
  if (config.background?.url) payload.b = config.background.url;
  if (primaryChar?.selectedExpression) payload.e = primaryChar.selectedExpression;
  if (config.elements?.transparentBackground) payload.t = true;
  if (primaryChar?.x) payload.x = primaryChar.x;
  if (primaryChar?.y) payload.y = primaryChar.y;
  if (primaryChar?.scale && primaryChar.scale !== 1) payload.s = primaryChar.scale;
  if (config.background?.xOffset) payload.bx = config.background.xOffset;
  if (config.background?.yOffset) payload.by = config.background.yOffset;
  if (config.background?.scale && config.background.scale !== 1) payload.bs = config.background.scale;
  if ((config as any).speed && (config as any).speed !== "normal") payload.sp = String((config as any).speed);

  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json, "utf8").toString("base64url");
  const isGif = type === "gif" || config.output?.format === "gif" || (config as any).format === "gif";
  const prefix = isGif ? "sc_gif_" : "sc_";
  return `${prefix}${b64}`;
}

export function decodeScenarioId(id: string): ScenarioConfig | null {
  try {
    let b64 = "";
    const isGif = id.startsWith("sc_gif_");
    if (isGif) {
      b64 = id.slice(7);
    } else if (id.startsWith("sc_")) {
      b64 = id.slice(3);
    } else if (id.startsWith("scenario_")) {
      const parts = id.split("_");
      if (parts.length >= 3) {
        b64 = parts.slice(2).join("_");
      }
    }
    if (!b64) return null;

    const json = Buffer.from(b64, "base64url").toString("utf8");
    const payload: CompactScenarioPayload = JSON.parse(json);
    return normalizeScenarioInput({
      characterId: payload.c,
      name: payload.n,
      affiliation: payload.a,
      dialogue: payload.d,
      background: payload.b,
      emotion: payload.e,
      expression: payload.e,
      transparentBackground: payload.t,
      characterX: payload.x,
      characterY: payload.y,
      characterScale: payload.s,
      backgroundX: payload.bx,
      backgroundY: payload.by,
      backgroundScale: payload.bs,
      speed: payload.sp || "normal",
      format: isGif ? "gif" : "png",
      animate: isGif,
    });
  } catch {
    return null;
  }
}

