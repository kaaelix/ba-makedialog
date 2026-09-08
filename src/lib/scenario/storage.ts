import fs from "fs";
import path from "path";
import crypto from "crypto";

export function getScenarioStorageKey(id: string): string {
  if (id.length <= 80 && !/[^a-zA-Z0-9_-]/.test(id)) return id;
  return crypto.createHash("md5").update(id).digest("hex");
}

export function getScenarioOutputDir(): string {
  const tmpDir = path.join("/tmp", "generated", "scenario");
  if (process.env.VERCEL) {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    return tmpDir;
  }
  const publicDir = path.join(process.cwd(), "public", "generated", "scenario");
  try {
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    return publicDir;
  } catch {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    return tmpDir;
  }
}

export function getUploadsOutputDir(): string {
  const tmpDir = path.join("/tmp", "generated", "uploads");
  if (process.env.VERCEL) {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    return tmpDir;
  }
  const publicDir = path.join(process.cwd(), "public", "generated", "uploads");
  try {
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    return publicDir;
  } catch {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    return tmpDir;
  }
}

export interface StoredScenarioFile {
  filePath: string;
  type: "png" | "gif";
  size: number;
}

export interface InMemoryScenarioFile {
  buffer: Buffer;
  type: "png" | "gif";
  timestamp: number;
}

const scenarioMemoryCache =
  (globalThis as any).__scenarioMemoryCache ||
  new Map<string, InMemoryScenarioFile>();
(globalThis as any).__scenarioMemoryCache = scenarioMemoryCache;

export function storeScenarioBuffer(
  id: string,
  buffer: Buffer,
  type: "png" | "gif",
): void {
  // Prune oldest if cache exceeds 60 entries
  if (scenarioMemoryCache.size > 60) {
    const oldestKey = scenarioMemoryCache.keys().next().value;
    if (oldestKey) scenarioMemoryCache.delete(oldestKey);
  }
  scenarioMemoryCache.set(id, {
    buffer,
    type,
    timestamp: Date.now(),
  });
}

export function getScenarioBuffer(id: string): InMemoryScenarioFile | null {
  return scenarioMemoryCache.get(id) || null;
}

export function findGeneratedScenarioFile(id: string): StoredScenarioFile | null {
  const candidateDirs = [
    path.join("/tmp", "generated", "scenario"),
    path.join(process.cwd(), "public", "generated", "scenario"),
  ];

  const keys: string[] = [];
  const safeKey = getScenarioStorageKey(id);
  if (safeKey) keys.push(safeKey);
  if (id !== safeKey && id.length <= 100) keys.push(id);

  for (const dir of candidateDirs) {
    for (const k of keys) {
      const pngPath = path.join(dir, `${k}.png`);
      if (fs.existsSync(pngPath)) {
        const stat = fs.statSync(pngPath);
        return { filePath: pngPath, type: "png", size: stat.size };
      }

      const gifPath = path.join(dir, `${k}.gif`);
      if (fs.existsSync(gifPath)) {
        const stat = fs.statSync(gifPath);
        return { filePath: gifPath, type: "gif", size: stat.size };
      }
    }
  }

  return null;
}

export function findUploadedFile(fileName: string): string | null {
  const candidateDirs = [
    path.join("/tmp", "generated", "uploads"),
    path.join(process.cwd(), "public", "generated", "uploads"),
  ];

  for (const dir of candidateDirs) {
    const filePath = path.join(dir, fileName);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
}
