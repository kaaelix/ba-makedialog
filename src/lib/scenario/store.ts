import {
  SCENARIO_TEXT_FONT_SIZE,
  SCENARIO_TEXT_SCROLL_SPEED,
} from "@/lib/scenario/constants";
import { SCENARIO_FONT_EN } from "@/lib/scenario/fonts";
import type {
  BackgroundMode,
  ScenarioCharacterData,
  ScenarioConfig,
  ScenarioFontData,
} from "@/lib/scenario/types";
import { useSyncExternalStore } from "react";

export type ScenarioState = {
  backgroundMode: BackgroundMode;
  name: string;
  affiliation: string;
  content: string;
  font: ScenarioFontData;
  fontSize: number;
  scrollSpeed: number;
  backgroundImage: string | null;
  backgroundUrl: string | null;
  backgroundScale: number;
  backgroundXOffset: number;
  backgroundYOffset: number;
  backgroundBlur: boolean;
  characters: ScenarioCharacterData[];
  displayButtons: boolean;
  autoEnabled: boolean;
  displayLine: boolean;
  displayGradient: boolean;
  displayTriangle: boolean;
  transparentBackground: boolean;
  animate: boolean;
  recordingMode: boolean;
  backgroundName: string | null;
  script: string;
  scriptPlaying: boolean;
  chatMode: boolean;
};

export const initialScenarioState: ScenarioState = {
  backgroundMode: "url",
  name: "Hoshino",
  affiliation: "Abydos High School",
  content: "Uhe~ Sensei, are you still awake? Working this late isn't good for your health, you know~",
  font: SCENARIO_FONT_EN,
  fontSize: SCENARIO_TEXT_FONT_SIZE,
  scrollSpeed: SCENARIO_TEXT_SCROLL_SPEED,
  backgroundImage: null,
  backgroundUrl: "https://lh3.googleusercontent.com/d/1_BxnV-AyJui7SCHGbYZxxNzG4vGo_ydh",
  backgroundScale: 1,
  backgroundXOffset: 0,
  backgroundYOffset: 0,
  backgroundBlur: false,
  characters: [
    {
      id: "ch_ch0241",
      name: "Hoshino",
      spriteUrl: "https://lh3.googleusercontent.com/d/1ftSBvFiJf5qZj90vXKCUclOqrhBV6FlH",
      filename: "CH0241_default_00.png",
      timestamp: Date.now(),
      x: 0,
      y: 0,
      scale: 1,
      darken: false,
      hologram: false,
      silhouette: false,
      silhouetteColor: 0x000000,
    },
  ],
  displayButtons: true,
  autoEnabled: false,
  displayLine: true,
  displayGradient: true,
  displayTriangle: true,
  transparentBackground: false,
  animate: false,
  recordingMode: false,
  backgroundName: "Abandonedcorridor (Night)",
  script: "",
  scriptPlaying: false,
  chatMode: true,
};

type Listener = () => void;

export class ScenarioStore {
  private state: ScenarioState = { ...initialScenarioState };
  private listeners = new Set<Listener>();

  getState = (): ScenarioState => {
    return this.state;
  };

  set = (
    partial:
      | Partial<ScenarioState>
      | ((state: ScenarioState) => Partial<ScenarioState>),
  ): void => {
    const patch = typeof partial === "function" ? partial(this.state) : partial;
    this.state = { ...this.state, ...patch };

    for (const listener of this.listeners) {
      listener();
    }
  };

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  loadConfig = (config: ScenarioConfig): void => {
    this.set((current) => ({
      name: config.content?.characterName ?? current.name,
      affiliation: config.content?.affiliation ?? current.affiliation,
      content: config.content?.dialogue ?? current.content,
      backgroundMode: config.background?.mode ?? (config.background?.url ? "url" : current.backgroundMode),
      backgroundUrl: config.background?.url !== undefined ? config.background.url : current.backgroundUrl,
      backgroundImage: config.background?.image !== undefined ? config.background.image : current.backgroundImage,
      backgroundScale: config.background?.scale ?? current.backgroundScale,
      backgroundXOffset: config.background?.xOffset ?? current.backgroundXOffset,
      backgroundYOffset: config.background?.yOffset ?? current.backgroundYOffset,
      backgroundBlur: config.background?.blur ?? current.backgroundBlur,
      characters: config.characters ?? current.characters,
      font: config.font ?? current.font,
      fontSize: config.fontSize ?? current.fontSize,
      displayButtons: config.elements?.displayButtons ?? current.displayButtons,
      autoEnabled: config.elements?.autoEnabled ?? current.autoEnabled,
      displayLine: config.elements?.displayLine ?? current.displayLine,
      displayGradient: config.elements?.displayGradient ?? current.displayGradient,
      displayTriangle: config.elements?.displayTriangle ?? current.displayTriangle,
      transparentBackground: config.elements?.transparentBackground ?? current.transparentBackground,
      animate: config.behavior?.animate ?? current.animate,
      scrollSpeed: config.behavior?.scrollSpeed ?? current.scrollSpeed,
      script: config.script ?? current.script,
      chatMode: config.output?.mode === "chat" || config.behavior?.type === "chat_image",
    }));
  };

  exportConfig = (): ScenarioConfig => {
    const s = this.state;
    return {
      content: {
        characterName: s.name,
        affiliation: s.affiliation,
        dialogue: s.content,
      },
      background: {
        mode: s.backgroundMode,
        url: s.backgroundUrl,
        image: s.backgroundImage,
        scale: s.backgroundScale,
        xOffset: s.backgroundXOffset,
        yOffset: s.backgroundYOffset,
        blur: s.backgroundBlur,
      },
      characters: s.characters,
      font: s.font,
      fontSize: s.fontSize,
      elements: {
        displayButtons: s.displayButtons,
        autoEnabled: s.autoEnabled,
        displayLine: s.displayLine,
        displayGradient: s.displayGradient,
        displayTriangle: s.displayTriangle,
        transparentBackground: s.transparentBackground,
      },
      behavior: {
        type: s.chatMode ? "chat_image" : "default",
        markdown: s.chatMode,
        scrollSpeed: s.scrollSpeed,
        animate: s.animate,
      },
      output: {
        type: s.animate ? "animation" : "image",
        mode: s.chatMode ? "chat" : "normal",
        format: s.animate ? "gif" : "png",
      },
      script: s.script,
    };
  };

  addCharacter = (char: ScenarioCharacterData): void => {
    const current = this.state.characters;
    if (current.length >= 6) return;
    const next = [...current, char];
    const count = next.length;
    // Auto-layout horizontally
    if (count === 2) {
      next[0] = { ...next[0], x: -240, scale: 0.95 };
      next[1] = { ...next[1], x: 240, scale: 0.95 };
    } else if (count === 3) {
      next[0] = { ...next[0], x: -360, scale: 0.9 };
      next[1] = { ...next[1], x: 0, scale: 0.9 };
      next[2] = { ...next[2], x: 360, scale: 0.9 };
    } else if (count >= 4) {
      const span = 1100;
      const step = span / (count - 1);
      for (let i = 0; i < count; i++) {
        next[i] = { ...next[i], x: Math.round(-span / 2 + i * step), scale: 0.85 };
      }
    }
    this.set({ characters: next });
  };

  removeCharacter = (index: number): void => {
    const current = this.state.characters;
    if (current.length <= 1) return;
    const next = current.filter((_, idx) => idx !== index);
    if (next.length === 1) {
      next[0] = { ...next[0], x: 0, scale: 1.0 };
    }
    this.set({ characters: next });
  };

  updateCharacter = (
    index: number,
    patch: Partial<ScenarioCharacterData>,
  ): void => {
    const current = this.state.characters;
    if (index < 0 || index >= current.length) return;
    const next = [...current];
    next[index] = { ...next[index], ...patch };
    this.set({ characters: next });
  };
}

export const scenarioStore = new ScenarioStore();

export function useScenarioStore<T>(selector: (state: ScenarioState) => T): T {
  return useSyncExternalStore(
    scenarioStore.subscribe,
    () => selector(scenarioStore.getState()),
    () => selector(scenarioStore.getState()),
  );
}

export function selectBackground(state: ScenarioState): string | null {
  if (state.backgroundMode === "image" && state.backgroundImage) {
    return state.backgroundImage;
  }
  return state.backgroundUrl || state.backgroundImage || null;
}
