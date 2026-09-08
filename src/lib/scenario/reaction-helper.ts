/**
 * Blue Archive Reaction and Facial Expression Categorization Helper
 * Maps student sprite file names and variant numbers to authentic VN emotional reactions.
 */

export type ReactionCategory =
  | "all"
  | "neutral"
  | "happy"
  | "angry"
  | "serious"
  | "sad"
  | "surprised"
  | "shy"
  | "calm"
  | "special";

export interface ReactionCategoryDefinition {
  id: ReactionCategory;
  label: string;
  shortLabel: string;
  badge: string;
}

export interface ReactionMeta {
  category: ReactionCategory;
  label: string;
  code: string;
  description: string;
  badgeClass: string;
}

export const REACTION_CATEGORIES: ReactionCategoryDefinition[] = [
  { id: "all", label: "All Reactions", shortLabel: "All", badge: "ALL" },
  { id: "neutral", label: "Default / Neutral", shortLabel: "Neutral", badge: "STD" },
  { id: "happy", label: "Happy / Smile", shortLabel: "Happy", badge: "SMILE" },
  { id: "angry", label: "Angry / Pout", shortLabel: "Angry", badge: "ANGRY" },
  { id: "serious", label: "Serious / Determined", shortLabel: "Serious", badge: "SERIOUS" },
  { id: "sad", label: "Sad / Worried", shortLabel: "Sad", badge: "SAD" },
  { id: "surprised", label: "Surprised / Panic", shortLabel: "Shock", badge: "SHOCK" },
  { id: "shy", label: "Shy / Blushing", shortLabel: "Shy", badge: "BLUSH" },
  { id: "calm", label: "Calm / Eyes Closed", shortLabel: "Calm", badge: "CALM" },
  { id: "special", label: "Special / Variant", shortLabel: "Special", badge: "SPEC" },
];

/**
 * Deduplicate sprite entries by fileName (prevents duplicate Google Drive mirrors).
 */
export function deduplicateSprites<T extends { fileName: string }>(sprites: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const sprite of sprites) {
    if (!sprite.fileName || seen.has(sprite.fileName)) continue;
    seen.add(sprite.fileName);
    unique.push(sprite);
  }
  return unique;
}

/**
 * Analyzes dialogue text to infer the student's emotional tone and reaction.
 * Aligns the dialogue text with the corresponding expression.
 */
export function detectDialogueEmotion(dialogue: string): {
  category: ReactionCategory;
  label: string;
  matchedWord?: string;
} | null {
  if (!dialogue) return null;
  const lower = dialogue.toLowerCase();

  // 1. Angry / Annoyed patterns
  const angryWords = [
    "marah", "kesal", "bakar", "hajar", "diam", "benci", "hmph", "grr", "ugh",
    "baka", "shut up", "annoying", "angry", "pout", "furious", "mad", "die",
    "stop it", "nggak mau", "gak mau", "jengkel", "urusai", "mou", "jangan bercanda",
    "menyebalkan", "kurang ajar", "tutup mulutmu"
  ];
  for (const w of angryWords) {
    if (lower.includes(w)) {
      return { category: "angry", label: "Angry / Kesal", matchedWord: w };
    }
  }
  if (
    /(!\?|\?!|!!{2,})/.test(dialogue) &&
    (lower.includes("jangan") || lower.includes("kamu") || lower.includes("apa-apaan"))
  ) {
    return { category: "angry", label: "Angry / Kesal", matchedWord: "!?" };
  }

  // 2. Shy / Blushing patterns
  const shyWords = [
    "malu", "tersipu", "blush", "jangan lihat", "ano...", "eto...", "doki",
    "s-sensei", "jangan gitu", "b-bukan", "t-tidak", "s-sayang", "flustered",
    "h-hentai", "jangan dekat-dekat", "merona"
  ];
  for (const w of shyWords) {
    if (lower.includes(w)) {
      return { category: "shy", label: "Shy / Blushing", matchedWord: w };
    }
  }

  // 3. Sad / Distressed patterns
  const sadWords = [
    "sedih", "maaf", "hiks", "hmpf", "menangis", "cry", "tears", "sad", "sorry",
    "pain", "sakit", "kecewa", "sulit", "susah", "kasihan", "gomen", "kanashii",
    "tidak berdaya", "tolong", "hiks...", "maafkan aku"
  ];
  for (const w of sadWords) {
    if (lower.includes(w)) {
      return { category: "sad", label: "Sad / Worried", matchedWord: w };
    }
  }

  // 4. Surprised / Shocked patterns
  const shockWords = [
    "eh?", "apa?!", "hah?!", "kaget", "terkejut", "whoa", "nani", "surprised",
    "shock", "what?!", "sudden", "astaga", "waduh", "beneran?!", "gawat", "ya ampun",
    "heee?!", "ehhh?!"
  ];
  for (const w of shockWords) {
    if (lower.includes(w)) {
      return { category: "surprised", label: "Surprised / Shocked", matchedWord: w };
    }
  }

  // 5. Happy / Cheerful patterns
  const happyWords = [
    "hehe", "haha", "senang", "bahagia", "terima kasih", "makasih", "uhe", "yay",
    "waa", "love", "happy", "smile", "great", "good", "enak", "asik", "suka",
    "arigatou", "ureshii", "alhamdulillah", "yatta", "selamat", "semangat"
  ];
  for (const w of happyWords) {
    if (lower.includes(w)) {
      return { category: "happy", label: "Happy / Smile", matchedWord: w };
    }
  }

  // 6. Calm / Relaxed patterns
  const calmWords = [
    "huu...", "fiuh", "tenang", "istirahat", "tidur", "sigh", "peaceful",
    "sleepy", "oyasumi", "santai", "ngantuk"
  ];
  for (const w of calmWords) {
    if (lower.includes(w)) {
      return { category: "calm", label: "Calm / Relaxed", matchedWord: w };
    }
  }

  return null;
}

/**
 * Resolves emotional reaction metadata and human-readable reaction names for a given sprite.
 */
export function getReactionMeta(
  rawName: string = "",
  fileName: string = "",
  index: number = 0,
): ReactionMeta {
  const base = fileName.replace(/\.png$/i, "");
  const combined = `${rawName} ${base}`.toLowerCase();

  // 1. Keyword-based matching for named special animations / halo variants
  if (combined.includes("halo_angry") || combined.includes("halo angry")) {
    return {
      category: "angry",
      label: "Halo Angry",
      code: "H-Angry",
      description: "Intense angry halo agitation",
      badgeClass: "text-rose-400 border-rose-500/40 bg-rose-500/15",
    };
  }
  if (combined.includes("halo_happy") || combined.includes("halo happy")) {
    return {
      category: "happy",
      label: "Halo Joy",
      code: "H-Joy",
      description: "Cheerful glowing halo expression",
      badgeClass: "text-amber-300 border-amber-500/30 bg-amber-500/10",
    };
  }
  if (
    combined.includes("halo_suprise") ||
    combined.includes("halo surprise") ||
    combined.includes("halo shock")
  ) {
    return {
      category: "surprised",
      label: "Halo Shock",
      code: "H-Shock",
      description: "Agitated surprised halo reaction",
      badgeClass: "text-yellow-300 border-yellow-500/30 bg-yellow-500/10",
    };
  }
  if (
    combined.includes("patend") ||
    combined.includes("pat_end") ||
    combined.includes("pat 01") ||
    combined.includes("pat_01")
  ) {
    return {
      category: "special",
      label: "Headpat",
      code: "Pat",
      description: "Affectionate Sensei headpat reaction",
      badgeClass: "text-pink-300 border-pink-500/30 bg-pink-500/10",
    };
  }
  if (combined.includes("idle")) {
    return {
      category: "neutral",
      label: "Idle Pose",
      code: "Idle",
      description: "Standing natural posture",
      badgeClass: "text-slate-300 border-slate-700 bg-slate-800/50",
    };
  }
  if (combined.includes("eye close") || combined.includes("eye_close")) {
    return {
      category: "calm",
      label: "Eyes Closed",
      code: "Closed",
      description: "Peaceful contemplation or deep breath",
      badgeClass: "text-indigo-300 border-indigo-500/30 bg-indigo-500/10",
    };
  }
  if (combined.includes("wink")) {
    return {
      category: "happy",
      label: "Playful Wink",
      code: "Wink",
      description: "Charming playful wink",
      badgeClass: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
    };
  }
  if (combined.includes("cry") || combined.includes("tear")) {
    return {
      category: "sad",
      label: "Tearful / Crying",
      code: "Cry",
      description: "Emotional crying or tears in eyes",
      badgeClass: "text-sky-300 border-sky-500/30 bg-sky-500/10",
    };
  }
  if (
    combined.includes("blush") ||
    combined.includes("embarrass") ||
    combined.includes("fluster")
  ) {
    return {
      category: "shy",
      label: "Blushing / Shy",
      code: "Blush",
      description: "Reddened cheeks with shyness",
      badgeClass: "text-rose-300 border-rose-500/30 bg-rose-500/10",
    };
  }
  if (
    combined.includes("shock") ||
    combined.includes("gasp") ||
    combined.includes("panic")
  ) {
    return {
      category: "surprised",
      label: "Shocked / Panic",
      code: "Shock",
      description: "Wide eyes with sudden surprise",
      badgeClass: "text-amber-300 border-amber-500/30 bg-amber-500/10",
    };
  }
  if (
    combined.includes("angry") ||
    combined.includes("marah") ||
    combined.includes("kesal") ||
    combined.includes("pout") ||
    combined.includes("frown") ||
    combined.includes("annoy") ||
    combined.includes("rage")
  ) {
    return {
      category: "angry",
      label: "Angry / Pout",
      code: "Angry",
      description: "Angry, annoyed, or pouting expression",
      badgeClass: "text-rose-400 border-rose-500/40 bg-rose-500/15",
    };
  }
  if (
    combined.includes("serious") ||
    combined.includes("determined") ||
    combined.includes("resolute") ||
    combined.includes("stern")
  ) {
    return {
      category: "serious",
      label: "Determined",
      code: "Serious",
      description: "Focused and resolute serious expression",
      badgeClass: "text-sky-300 border-sky-500/30 bg-sky-500/10",
    };
  }

  // 2. Extract numeric index from suffix (e.g. airi_default_01.png -> 1)
  const numMatch =
    base.match(/_(?:[A-Za-z]+_)?(\d\d+)(?:_[A-Za-z0-9]+)?$/) ||
    base.match(/(\d+)$/) ||
    rawName.match(/\b(\d+)\b/);

  const num = numMatch ? parseInt(numMatch[1], 10) : null;

  if (num === 0) {
    return {
      category: "neutral",
      label: "Default / Neutral",
      code: "00",
      description: "Calm standard expression",
      badgeClass: "text-slate-300 border-slate-700 bg-slate-800/50",
    };
  } else if (num === 1) {
    return {
      category: "happy",
      label: "Gentle Smile",
      code: "01",
      description: "Warm pleasant smile",
      badgeClass: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
    };
  } else if (num === 2) {
    return {
      category: "happy",
      label: "Joyful Smile",
      code: "02",
      description: "Open cheerful smile",
      badgeClass: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
    };
  } else if (num === 3) {
    return {
      category: "serious",
      label: "Determined",
      code: "03",
      description: "Focused and serious expression",
      badgeClass: "text-sky-300 border-sky-500/30 bg-sky-500/10",
    };
  } else if (num === 4) {
    return {
      category: "angry",
      label: "Angry / Pout",
      code: "04",
      description: "Irritated pout or angry reaction",
      badgeClass: "text-rose-400 border-rose-500/40 bg-rose-500/15",
    };
  } else if (num === 5) {
    return {
      category: "sad",
      label: "Worried / Troubled",
      code: "05",
      description: "Uneasy or anxious reaction",
      badgeClass: "text-sky-300 border-sky-500/30 bg-sky-500/10",
    };
  } else if (num === 6) {
    return {
      category: "sad",
      label: "Sad / Distressed",
      code: "06",
      description: "Unhappy or tearful reaction",
      badgeClass: "text-sky-300 border-sky-400/30 bg-sky-400/10",
    };
  } else if (num === 7) {
    return {
      category: "surprised",
      label: "Surprised",
      code: "07",
      description: "Sudden realization or astonishment",
      badgeClass: "text-yellow-300 border-yellow-500/30 bg-yellow-500/10",
    };
  } else if (num === 8) {
    return {
      category: "surprised",
      label: "Flustered / Shocked",
      code: "08",
      description: "Wide eyes with sweat or agitation",
      badgeClass: "text-amber-300 border-amber-400/30 bg-amber-400/10",
    };
  } else if (num === 9) {
    return {
      category: "shy",
      label: "Shy / Blushing",
      code: "09",
      description: "Blushing cheeks with embarrassment",
      badgeClass: "text-rose-300 border-rose-500/30 bg-rose-500/10",
    };
  } else if (num === 10) {
    return {
      category: "happy",
      label: "Smug / Teasing",
      code: "10",
      description: "Playful confidence or cheeky grin",
      badgeClass: "text-purple-300 border-purple-500/30 bg-purple-500/10",
    };
  } else if (num === 11) {
    return {
      category: "calm",
      label: "Eyes Closed",
      code: "11",
      description: "Calm sigh or relaxed contemplation",
      badgeClass: "text-indigo-300 border-indigo-500/30 bg-indigo-500/10",
    };
  } else if (num === 12) {
    return {
      category: "happy",
      label: "Winking",
      code: "12",
      description: "Charming wink",
      badgeClass: "text-teal-300 border-teal-500/30 bg-teal-500/10",
    };
  } else if (num === 99) {
    return {
      category: "special",
      label: "Silhouette",
      code: "99",
      description: "Dramatic shadow outline",
      badgeClass: "text-slate-400 border-slate-800 bg-slate-900/60",
    };
  } else if (num !== null) {
    return {
      category: "special",
      label: `Variant #${num.toString().padStart(2, "0")}`,
      code: num.toString().padStart(2, "0"),
      description: `Special expression variant #${num}`,
      badgeClass: "text-cyan-300 border-cyan-500/30 bg-cyan-500/10",
    };
  }

  // 3. Fallbacks
  if (index === 0) {
    return {
      category: "neutral",
      label: "Default",
      code: "00",
      description: "Default portrait",
      badgeClass: "text-slate-300 border-slate-700 bg-slate-800/50",
    };
  }

  const paddedIdx = (index + 1).toString().padStart(2, "0");
  return {
    category: "special",
    label: rawName || `Reaction #${paddedIdx}`,
    code: paddedIdx,
    description: `Student expression #${paddedIdx}`,
    badgeClass: "text-slate-400 border-slate-700 bg-slate-800/40",
  };
}

/**
 * Searches for a matching sprite given a reaction or expression query.
 * Can match by code (e.g. "04"), reaction keyword ("angry", "marah", "smile"), category, or fileName.
 */
export function findSpriteByReactionOrExpression<
  T extends { name: string; fileName: string; url: string }
>(sprites: T[], query: string): T | undefined {
  if (!sprites || sprites.length === 0 || !query) return undefined;

  const q = query.trim().toLowerCase();

  // 1. Direct fileName or URL match
  const directMatch = sprites.find(
    (s) =>
      s.fileName.toLowerCase() === q ||
      s.fileName.toLowerCase().includes(q) ||
      s.name.toLowerCase() === q,
  );
  if (directMatch) return directMatch;

  // 2. Try matching reaction metadata
  for (let idx = 0; idx < sprites.length; idx++) {
    const s = sprites[idx];
    const meta = getReactionMeta(s.name, s.fileName, idx);

    // Code match (e.g. "04", "4", "01")
    if (meta.code.toLowerCase() === q || parseInt(meta.code, 10) === parseInt(q, 10)) {
      return s;
    }

    // Label match (e.g. "angry", "marah", "pout", "smile")
    if (
      meta.label.toLowerCase() === q ||
      meta.label.toLowerCase().includes(q)
    ) {
      return s;
    }

    // Category match (e.g. "angry", "happy", "serious", "sad")
    if (meta.category === q) {
      return s;
    }
  }

  // 3. Synonym aliases
  if (["angry", "marah", "kesal", "pout", "annoyed"].includes(q)) {
    for (let idx = 0; idx < sprites.length; idx++) {
      const s = sprites[idx];
      const meta = getReactionMeta(s.name, s.fileName, idx);
      if (meta.category === "angry" || meta.code === "04") {
        return s;
      }
    }
  }

  return undefined;
}
