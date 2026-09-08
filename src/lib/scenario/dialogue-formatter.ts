export type DialogueChunk = {
  text: string;
  isAction: boolean;
};

export type FormattedLine = DialogueChunk[];

/**
 * Parses raw scenario dialogue into tokens partitioned by **...** or *...* boundaries.
 */
export function tokenizeDialogue(text: string): DialogueChunk[] {
  if (!text) return [];
  const tokens: DialogueChunk[] = [];
  let i = 0;

  while (i < text.length) {
    if (text.slice(i, i + 2) === "**") {
      const close = text.indexOf("**", i + 2);
      if (close === -1) {
        tokens.push({ text: text.slice(i), isAction: true });
        break;
      } else {
        tokens.push({ text: text.slice(i, close + 2), isAction: true });
        i = close + 2;
      }
    } else if (text[i] === "*") {
      const close = text.indexOf("*", i + 1);
      if (close === -1) {
        tokens.push({ text: text.slice(i), isAction: true });
        break;
      } else {
        tokens.push({ text: text.slice(i, close + 1), isAction: true });
        i = close + 1;
      }
    } else {
      let nextStar = text.indexOf("*", i);
      if (nextStar === -1) nextStar = text.length;
      tokens.push({ text: text.slice(i, nextStar), isAction: false });
      i = nextStar;
    }
  }

  return tokens;
}

function mergeChunks(chunks: DialogueChunk[]): DialogueChunk[] {
  const merged: DialogueChunk[] = [];
  for (const item of chunks) {
    if (merged.length > 0 && merged[merged.length - 1].isAction === item.isAction) {
      merged[merged.length - 1].text += item.text;
    } else {
      merged.push({ text: item.text, isAction: item.isAction });
    }
  }
  return merged;
}

/**
 * Word-wraps dialogue tokens into lines while strictly preserving action/dialogue chunk boundaries.
 */
export function formatDialogueLines(
  text: string,
  measureWidthFn: (chunkText: string, isAction: boolean) => number,
  maxLineWidth: number,
): FormattedLine[] {
  if (!text) return [];

  const rawLines = text.split("\n");
  const allFormattedLines: FormattedLine[] = [];

  for (const rawLine of rawLines) {
    if (!rawLine) {
      allFormattedLines.push([{ text: "", isAction: false }]);
      continue;
    }

    const tokens = tokenizeDialogue(rawLine);
    const words: DialogueChunk[] = [];

    for (const token of tokens) {
      const splitWords = token.text.split(/(\s+)/);
      for (const w of splitWords) {
        if (!w) continue;
        words.push({ text: w, isAction: token.isAction });
      }
    }

    let currentLine: DialogueChunk[] = [];
    let currentLineWidth = 0;

    for (const item of words) {
      const wWidth = measureWidthFn(item.text, item.isAction);
      if (currentLineWidth + wWidth <= maxLineWidth || currentLine.length === 0) {
        currentLine.push(item);
        currentLineWidth += wWidth;
      } else {
        allFormattedLines.push(mergeChunks(currentLine));
        currentLine = [item];
        currentLineWidth = wWidth;
      }
    }

    if (currentLine.length > 0) {
      allFormattedLines.push(mergeChunks(currentLine));
    }
  }

  return allFormattedLines;
}

/**
 * Reveals character count progressively across lines for seamless 30 FPS typewriter animations.
 */
export function revealFormattedLines(
  lines: FormattedLine[],
  charsToShow: number,
): FormattedLine[] {
  let shown = 0;
  const result: FormattedLine[] = [];

  for (const line of lines) {
    if (shown >= charsToShow) break;
    const currentLineChunks: DialogueChunk[] = [];

    for (const chunk of line) {
      if (shown >= charsToShow) break;
      const remaining = charsToShow - shown;

      if (chunk.text.length <= remaining) {
        currentLineChunks.push({ text: chunk.text, isAction: chunk.isAction });
        shown += chunk.text.length;
      } else {
        currentLineChunks.push({
          text: chunk.text.slice(0, remaining),
          isAction: chunk.isAction,
        });
        shown += remaining;
        break;
      }
    }

    if (currentLineChunks.length > 0) {
      result.push(currentLineChunks);
    }
  }

  return result;
}

/**
 * Checks whether a character on stage is the active speaker based on the dialogue speaker name.
 * Non-speaking characters step back slightly and are shaded grey-ish.
 */
export function isCharacterSpeaking(
  character: { name?: string; darken?: boolean },
  speakerName?: string,
  totalCharacters = 1,
): boolean {
  if (character.darken) return false;

  const cleanSpeaker = (speakerName || "").trim().toLowerCase();
  const cleanCharName = (character.name || "").trim().toLowerCase();

  if (!cleanSpeaker) {
    return true;
  }

  if (!cleanCharName) {
    if (totalCharacters === 1 && cleanSpeaker !== "sensei" && cleanSpeaker !== "narrator") {
      return true;
    }
    return false;
  }

  return (
    cleanCharName === cleanSpeaker ||
    cleanSpeaker.includes(cleanCharName) ||
    cleanCharName.includes(cleanSpeaker)
  );
}
