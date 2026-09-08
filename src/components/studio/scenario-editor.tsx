"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { scenarioStore, useScenarioStore } from "@/lib/scenario/store";
import { clientAssetCatalog, type SpriteData } from "@/lib/assets/client-catalog";
import { getActiveScenarioRenderer } from "@/lib/scenario/renderer/scenario-renderer";
import type { ScenarioAssetMetadata, ScenarioCharacterData } from "@/lib/scenario/types";
import {
  MessageSquare,
  User,
  Image as ImageIcon,
  SlidersHorizontal,
  Search,
  ChevronLeft,
  ChevronRight,
  Copy,
  ZoomIn,
  Move,
  Smile,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  REACTION_CATEGORIES,
  ReactionCategory,
  getReactionMeta,
  deduplicateSprites,
  detectDialogueEmotion,
  findSpriteByReactionOrExpression,
} from "@/lib/scenario/reaction-helper";

const SCHOOL_PRESETS = [
  "Abydos High School",
  "Gehenna Academy",
  "Trinity General School",
  "Millennium Science School",
  "Hyakkiyako Academy",
  "Shanhaijing Senior Secondary School",
  "Red Winter Federal Academy",
  "Valkyrie Police Academy",
  "SRT Special Academy",
  "Arius Satellite School",
];

export function ScenarioEditor() {
  const [activeTab, setActiveTab] = useState<"content" | "student" | "background" | "elements">("content");

  // Store subscriptions
  const name = useScenarioStore((s) => s.name);
  const affiliation = useScenarioStore((s) => s.affiliation);
  const content = useScenarioStore((s) => s.content);
  const scrollSpeed = useScenarioStore((s) => s.scrollSpeed);
  const characters = useScenarioStore((s) => s.characters);
  const backgroundUrl = useScenarioStore((s) => s.backgroundUrl);
  const backgroundName = useScenarioStore((s) => s.backgroundName);
  const backgroundScale = useScenarioStore((s) => s.backgroundScale);
  const backgroundXOffset = useScenarioStore((s) => s.backgroundXOffset);
  const backgroundYOffset = useScenarioStore((s) => s.backgroundYOffset);
  const backgroundBlur = useScenarioStore((s) => s.backgroundBlur);
  const displayGradient = useScenarioStore((s) => s.displayGradient);
  const displayLine = useScenarioStore((s) => s.displayLine);
  const displayButtons = useScenarioStore((s) => s.displayButtons);
  const displayTriangle = useScenarioStore((s) => s.displayTriangle);
  const transparentBackground = useScenarioStore((s) => s.transparentBackground);

  // Student picker state
  const [studentSearch, setStudentSearch] = useState("");
  const [studentSchoolFilter, setStudentSchoolFilter] = useState("All");
  const [studentPage, setStudentPage] = useState(1);
  const studentsPerPage = 20;

  // Background picker state
  const [bgSearch, setBgSearch] = useState("");
  const [bgCategoryFilter, setBgCategoryFilter] = useState("All");
  const [bgPage, setBgPage] = useState(1);
  const bgPerPage = 20;

  // Active character selection in multi-character setup
  const [selectedCharIndex, setSelectedCharIndex] = useState(0);
  const safeCharIndex = Math.min(
    selectedCharIndex,
    Math.max(0, characters.length - 1),
  );
  const activeCharacter = characters[safeCharIndex] || characters[0] || {
    id: "student",
    name: "Student",
    spriteUrl: "",
    filename: "student.png",
    timestamp: Date.now(),
    x: 0,
    y: 0,
    scale: 1,
  };

  // Asset Catalog Collections
  const allStudents = useMemo(() => clientAssetCatalog.getCharacters(), []);
  const allBackgrounds = useMemo(() => clientAssetCatalog.getBackgrounds(), []);

  // Dynamic expressions state for current selected student
  const [loadedSprites, setLoadedSprites] = useState<SpriteData[]>(() => {
    return clientAssetCatalog.getCharacterSprites(
      activeCharacter.id || activeCharacter.name || name,
    );
  });

  useEffect(() => {
    const charId = activeCharacter.id || activeCharacter.name || name;
    if (!charId) return;

    // Immediately check if cached
    const cached = clientAssetCatalog.getCharacterSprites(charId);
    if (cached && cached.length > 0) {
      setLoadedSprites(cached);
    }

    let isMounted = true;
    clientAssetCatalog.fetchCharacterSprites(charId).then((sprites) => {
      if (isMounted && sprites && sprites.length > 0) {
        setLoadedSprites(sprites);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [activeCharacter.id, activeCharacter.name, name]);

  const availableSprites = loadedSprites;

  // Active reaction category filter
  const [selectedReactionCategory, setSelectedReactionCategory] = useState<ReactionCategory>("all");

  // Deduplicated unique sprites with enriched emotional reaction metadata
  const uniqueAvailableSprites = useMemo(() => {
    const deduped = deduplicateSprites(availableSprites);
    return deduped.map((s, idx) => ({
      ...s,
      meta: getReactionMeta(s.name, s.fileName, idx),
    }));
  }, [availableSprites]);

  // Dynamically computed reaction categories with counts for current student
  const studentReactionCategories = useMemo(() => {
    const counts: Record<ReactionCategory, number> = {
      all: uniqueAvailableSprites.length,
      neutral: 0,
      happy: 0,
      angry: 0,
      serious: 0,
      sad: 0,
      surprised: 0,
      shy: 0,
      calm: 0,
      special: 0,
    };

    uniqueAvailableSprites.forEach((s) => {
      counts[s.meta.category] = (counts[s.meta.category] || 0) + 1;
    });

    return REACTION_CATEGORIES.filter(
      (cat) => cat.id === "all" || (counts[cat.id] || 0) > 0,
    ).map((cat) => ({
      ...cat,
      count: counts[cat.id] || 0,
    }));
  }, [uniqueAvailableSprites]);

  // Filtered sprites by selected reaction category
  const displayedSprites = useMemo(() => {
    if (selectedReactionCategory === "all") return uniqueAvailableSprites;
    return uniqueAvailableSprites.filter(
      (s) => s.meta.category === selectedReactionCategory,
    );
  }, [uniqueAvailableSprites, selectedReactionCategory]);

  // Currently active sprite reaction emotion info
  const activeSpriteMeta = useMemo(() => {
    const found = uniqueAvailableSprites.find(
      (s) =>
        s.url === activeCharacter.spriteUrl ||
        s.fileName === activeCharacter.filename,
    );
    return found ? found.meta : null;
  }, [uniqueAvailableSprites, activeCharacter.spriteUrl, activeCharacter.filename]);

  // Automatically detect emotion from current dialogue text
  const detectedDialogueEmotion = useMemo(() => {
    return detectDialogueEmotion(content);
  }, [content]);

  // Student selection handler for the active character slot
  const handleSelectStudent = useCallback(
    (student: ScenarioAssetMetadata) => {
      const sprites = clientAssetCatalog.getCharacterSprites(student.id);
      const primarySprite =
        sprites && sprites.length > 0
          ? sprites[0]
          : (student as any).defaultSprite || null;
      const spriteUrl = primarySprite?.url || student.url || student.thumbnail || "";

      const currentChars = scenarioStore.getState().characters;
      const idx = Math.min(selectedCharIndex, Math.max(0, currentChars.length - 1));
      const targetCh = currentChars[idx] || {
        id: student.id,
        name: student.name,
        spriteUrl,
        filename: `${student.name}.png`,
        timestamp: Date.now(),
        x: 0,
        y: 0,
        scale: 1,
      };

      const updatedCh = {
        ...targetCh,
        id: student.id,
        name: student.name,
        spriteUrl,
        filename: primarySprite?.fileName || `${student.name}.png`,
        timestamp: Date.now(),
      };

      const nextChars = [...currentChars];
      nextChars[idx] = updatedCh;

      const storePatch: any = { characters: nextChars };
      if (idx === 0) {
        storePatch.name = student.name;
        storePatch.affiliation = student.school || "Kivotos";
      }

      scenarioStore.set(storePatch);
      setSelectedReactionCategory("all");

      // Asynchronously fetch expressions
      clientAssetCatalog.fetchCharacterSprites(student.id).then((fetched) => {
        if (fetched && fetched.length > 0) {
          setLoadedSprites(fetched);
        }
      });

      const renderer = getActiveScenarioRenderer();
      if (renderer) {
        renderer.sync(scenarioStore.getState());
      }
    },
    [selectedCharIndex],
  );

  // Expression selection handler for the active character slot
  const handleSelectExpression = useCallback(
    (sprite: { name: string; fileName: string; url: string }) => {
      const currentChars = scenarioStore.getState().characters;
      const idx = Math.min(selectedCharIndex, Math.max(0, currentChars.length - 1));
      if (currentChars.length === 0 || !currentChars[idx]) return;

      const nextChars = [...currentChars];
      nextChars[idx] = {
        ...nextChars[idx],
        spriteUrl: sprite.url,
        filename: sprite.fileName,
        selectedExpression: sprite.name,
        timestamp: Date.now(),
      };
      scenarioStore.set({ characters: nextChars });

      const renderer = getActiveScenarioRenderer();
      if (renderer) {
        renderer.sync(scenarioStore.getState());
      }

      const meta = getReactionMeta(sprite.name, sprite.fileName);
      toast.success(`Reaction: ${meta.label} (${meta.code})`, {
        duration: 1800,
      });
    },
    [selectedCharIndex],
  );

  // Character transform handlers for the active character slot
  const handleCharacterTransform = useCallback(
    (patch: { x?: number; y?: number; scale?: number; blur?: boolean }) => {
      const currentChars = scenarioStore.getState().characters;
      const idx = Math.min(selectedCharIndex, Math.max(0, currentChars.length - 1));
      if (currentChars.length === 0 || !currentChars[idx]) return;

      const nextChars = [...currentChars];
      nextChars[idx] = {
        ...nextChars[idx],
        x: patch.x !== undefined ? patch.x : nextChars[idx].x,
        y: patch.y !== undefined ? patch.y : nextChars[idx].y,
        scale: patch.scale !== undefined ? patch.scale : nextChars[idx].scale,
        blur: patch.blur !== undefined ? patch.blur : nextChars[idx].blur,
      };
      scenarioStore.set({ characters: nextChars });

      const renderer = getActiveScenarioRenderer();
      if (renderer) {
        renderer.sync(scenarioStore.getState());
      }
    },
    [selectedCharIndex],
  );

  const handleResetCharacterTransform = useCallback(() => {
    handleCharacterTransform({ x: 0, y: 0, scale: 1 });
  }, [handleCharacterTransform]);

  // Add a new character to scene
  const handleAddCharacter = useCallback(() => {
    const currentChars = scenarioStore.getState().characters;
    if (currentChars.length >= 6) {
      toast.error("Maximum 6 characters on stage.");
      return;
    }

    const existingIds = new Set(currentChars.map((c) => c.id));
    const candidate =
      allStudents.find((s) => !existingIds.has(s.id)) ||
      allStudents[0] || {
        id: "ch_ch0065",
        name: "Shiroko",
        school: "Abydos High School",
        url: "https://lh3.googleusercontent.com/d/10VbI17k2eQ4gP3E4m9vU2-7bQ3R9Z",
      };

    const sprites = clientAssetCatalog.getCharacterSprites(candidate.id);
    const spriteUrl = sprites?.[0]?.url || candidate.url || "";
    const filename = sprites?.[0]?.fileName || `${candidate.name}.png`;

    const newChar: ScenarioCharacterData = {
      id: candidate.id,
      name: candidate.name,
      spriteUrl,
      filename,
      timestamp: Date.now(),
      x: 220,
      y: 0,
      scale: 0.95,
      darken: false,
      hologram: false,
      silhouette: false,
    };

    scenarioStore.addCharacter(newChar);
    setSelectedCharIndex(currentChars.length);
    toast.success(`Added ${candidate.name} to scene!`);

    const renderer = getActiveScenarioRenderer();
    if (renderer) {
      renderer.sync(scenarioStore.getState());
    }
  }, [allStudents]);

  // Remove a character from scene
  const handleRemoveCharacter = useCallback((indexToRemove: number) => {
    const currentChars = scenarioStore.getState().characters;
    if (currentChars.length <= 1) {
      toast.error("Scene must have at least one character.");
      return;
    }
    const removedName = currentChars[indexToRemove]?.name || "Character";
    scenarioStore.removeCharacter(indexToRemove);
    setSelectedCharIndex((prev) => Math.max(0, Math.min(prev, currentChars.length - 2)));
    toast.success(`Removed ${removedName} from scene.`);

    const renderer = getActiveScenarioRenderer();
    if (renderer) {
      renderer.sync(scenarioStore.getState());
    }
  }, []);

  // Set active character as the dialogue speaker
  const handleSetSpeaker = useCallback((index: number) => {
    const currentChars = scenarioStore.getState().characters;
    const target = currentChars[index];
    if (!target) return;
    const studentInfo = target.id ? clientAssetCatalog.getAssetById(target.id) : null;
    scenarioStore.set({
      name: target.name || "Student",
      affiliation: studentInfo?.school || target.affiliation || "Kivotos",
    });
    toast.success(`Speaker set to ${target.name}`);
  }, []);

  // Background selection handler
  const handleSelectBackground = useCallback((bg: ScenarioAssetMetadata) => {
    scenarioStore.set({
      backgroundMode: "url",
      backgroundUrl: bg.url,
      backgroundName: bg.name,
    });

    const renderer = getActiveScenarioRenderer();
    if (renderer) {
      renderer.sync(scenarioStore.getState());
    }
  }, []);

  // Background transform handlers
  const handleBackgroundTransform = useCallback(
    (patch: { x?: number; y?: number; scale?: number }) => {
      scenarioStore.set((curr) => ({
        backgroundXOffset: patch.x !== undefined ? patch.x : curr.backgroundXOffset,
        backgroundYOffset: patch.y !== undefined ? patch.y : curr.backgroundYOffset,
        backgroundScale: patch.scale !== undefined ? patch.scale : curr.backgroundScale,
      }));

      const renderer = getActiveScenarioRenderer();
      if (renderer) {
        renderer.sync(scenarioStore.getState());
      }
    },
    [],
  );

  const handleResetBackgroundTransform = useCallback(() => {
    scenarioStore.set({
      backgroundXOffset: 0,
      backgroundYOffset: 0,
      backgroundScale: 1,
    });

    const renderer = getActiveScenarioRenderer();
    if (renderer) {
      renderer.sync(scenarioStore.getState());
    }
  }, []);

  // Filtered students computation
  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return allStudents.filter((s) => {
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.school && s.school.toLowerCase().includes(q));
      const matchesSchool =
        studentSchoolFilter === "All" ||
        (s.school && s.school.toLowerCase() === studentSchoolFilter.toLowerCase());
      return matchesSearch && matchesSchool;
    });
  }, [allStudents, studentSearch, studentSchoolFilter]);

  const studentTotalPages = Math.max(1, Math.ceil(filteredStudents.length / studentsPerPage));
  const currentStudentPageItems = useMemo(() => {
    const start = (studentPage - 1) * studentsPerPage;
    return filteredStudents.slice(start, start + studentsPerPage);
  }, [filteredStudents, studentPage]);

  // Filtered backgrounds computation
  const filteredBackgrounds = useMemo(() => {
    const q = bgSearch.trim().toLowerCase();
    return allBackgrounds.filter((b) => {
      const matchesSearch =
        !q ||
        b.name.toLowerCase().includes(q) ||
        (b.category && b.category.toLowerCase().includes(q));
      const matchesCategory =
        bgCategoryFilter === "All" ||
        (b.category && b.category.toLowerCase() === bgCategoryFilter.toLowerCase());
      return matchesSearch && matchesCategory;
    });
  }, [allBackgrounds, bgSearch, bgCategoryFilter]);

  const bgTotalPages = Math.max(1, Math.ceil(filteredBackgrounds.length / bgPerPage));
  const currentBgPageItems = useMemo(() => {
    const start = (bgPage - 1) * bgPerPage;
    return filteredBackgrounds.slice(start, start + bgPerPage);
  }, [filteredBackgrounds, bgPage]);

  // WAI-ARIA Accessible Tab Keyboard Navigation Handler
  const handleTabKeyDown = useCallback(
    (
      e: React.KeyboardEvent,
      currentTab: "content" | "student" | "background" | "elements",
    ) => {
      const tabs = ["content", "student", "background", "elements"] as const;
      const currentIndex = tabs.indexOf(currentTab);
      let nextIndex = currentIndex;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        nextIndex = (currentIndex + 1) % tabs.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      } else if (e.key === "Home") {
        e.preventDefault();
        nextIndex = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        nextIndex = tabs.length - 1;
      } else {
        return;
      }

      const nextTab = tabs[nextIndex];
      setActiveTab(nextTab);
      const el = document.getElementById(`tab-${nextTab}`);
      el?.focus();
    },
    [],
  );

  return (
    <section
      aria-label="Scenario Properties Inspector"
      className="flex flex-col h-full min-h-0 overflow-hidden"
    >
      <h2 className="sr-only">Scenario Property Inspector</h2>

      {/* Inspector Tab Bar with WAI-ARIA roving tabindex & arrow-key navigation */}
      <nav
        role="tablist"
        aria-label="Inspector Panels"
        className="flex items-center border-b border-slate-200 dark:border-zinc-800 p-1.5 gap-1.5 bg-slate-100/70 dark:bg-zinc-950/40 overflow-x-auto shrink-0"
      >
        <button
          type="button"
          role="tab"
          id="tab-content"
          tabIndex={activeTab === "content" ? 0 : -1}
          aria-selected={activeTab === "content"}
          aria-controls="panel-content"
          onClick={() => setActiveTab("content")}
          onKeyDown={(e) => handleTabKeyDown(e, "content")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] rounded text-xs font-semibold transition-all active:scale-[0.97] whitespace-nowrap ${
            activeTab === "content"
              ? "bg-sky-600 dark:bg-ba-accent text-white font-bold shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/90 dark:text-slate-300 dark:hover:text-white dark:hover:bg-zinc-800/60"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Content</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-student"
          tabIndex={activeTab === "student" ? 0 : -1}
          aria-selected={activeTab === "student"}
          aria-controls="panel-student"
          onClick={() => setActiveTab("student")}
          onKeyDown={(e) => handleTabKeyDown(e, "student")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] rounded text-xs font-semibold transition-all active:scale-[0.97] whitespace-nowrap ${
            activeTab === "student"
              ? "bg-sky-600 dark:bg-ba-accent text-white font-bold shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/90 dark:text-slate-300 dark:hover:text-white dark:hover:bg-zinc-800/60"
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Student</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-background"
          tabIndex={activeTab === "background" ? 0 : -1}
          aria-selected={activeTab === "background"}
          aria-controls="panel-background"
          onClick={() => setActiveTab("background")}
          onKeyDown={(e) => handleTabKeyDown(e, "background")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] rounded text-xs font-semibold transition-all active:scale-[0.97] whitespace-nowrap ${
            activeTab === "background"
              ? "bg-sky-600 dark:bg-ba-accent text-white font-bold shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/90 dark:text-slate-300 dark:hover:text-white dark:hover:bg-zinc-800/60"
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Background</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-elements"
          tabIndex={activeTab === "elements" ? 0 : -1}
          aria-selected={activeTab === "elements"}
          aria-controls="panel-elements"
          onClick={() => setActiveTab("elements")}
          onKeyDown={(e) => handleTabKeyDown(e, "elements")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] rounded text-xs font-semibold transition-all active:scale-[0.97] whitespace-nowrap ${
            activeTab === "elements"
              ? "bg-sky-600 dark:bg-ba-accent text-white font-bold shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/90 dark:text-slate-300 dark:hover:text-white dark:hover:bg-zinc-800/60"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Elements</span>
        </button>
      </nav>

      {/* Tab Panes (scrollable content area with locked container height) */}
      <div className="p-4 sm:p-5 flex-1 overflow-y-auto min-h-0">
        {/* 1. CONTENT TAB */}
        {activeTab === "content" && (
          <div
            role="tabpanel"
            id="panel-content"
            aria-labelledby="tab-content"
            className="flex flex-col gap-4"
          >
            {characters.length > 1 && (
              <div className="flex flex-col gap-1.5 pb-2 border-b border-slate-200 dark:border-zinc-800">
                <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-ba-cyan" />
                  <span>Select Active Speaker</span>
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto" role="group" aria-label="Select dialogue speaker">
                  {characters.map((char, idx) => {
                    const isSelected = name === char.name;
                    return (
                      <button
                        key={`spk_${char.id || idx}_${idx}`}
                        type="button"
                        onClick={() => handleSetSpeaker(idx)}
                        aria-pressed={isSelected}
                        aria-label={`Set speaker to ${char.name}`}
                        className={`text-xs px-3 py-1.5 min-h-[38px] rounded border transition-all active:scale-[0.97] flex items-center gap-1.5 ${
                          isSelected
                            ? "bg-ba-cyan text-black font-bold border-ba-cyan shadow-sm"
                            : "bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900/60 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800"
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full overflow-hidden bg-slate-200 dark:bg-zinc-800 shrink-0">
                          {char.spriteUrl && <img src={char.spriteUrl} alt="" className="w-full h-full object-cover object-top" />}
                        </div>
                        <span>{char.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="character-name-input"
                className="block text-xs font-semibold text-slate-800 dark:text-zinc-200 mb-1.5"
              >
                Character Name
              </label>
              <input
                id="character-name-input"
                type="text"
                value={name}
                onChange={(e) => scenarioStore.set({ name: e.target.value })}
                placeholder="e.g. Hoshino"
                className="w-full px-3.5 py-2.5 min-h-[40px] rounded bg-white dark:bg-zinc-900/60 border border-slate-300 dark:border-zinc-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition-colors shadow-xs"
              />
            </div>

            <div>
              <label
                htmlFor="school-affiliation-input"
                className="block text-xs font-semibold text-slate-800 dark:text-zinc-200 mb-1.5"
              >
                School Affiliation
              </label>
              <input
                id="school-affiliation-input"
                type="text"
                value={affiliation}
                onChange={(e) => scenarioStore.set({ affiliation: e.target.value })}
                placeholder="e.g. Abydos High School"
                className="w-full px-3.5 py-2.5 min-h-[40px] rounded bg-white dark:bg-zinc-900/60 border border-slate-300 dark:border-zinc-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition-colors mb-2 shadow-xs"
              />
              <div
                className="flex flex-wrap gap-1.5"
                role="group"
                aria-label="Preset school affiliations"
              >
                {SCHOOL_PRESETS.slice(0, 6).map((school) => (
                  <button
                    key={school}
                    type="button"
                    onClick={() => scenarioStore.set({ affiliation: school })}
                    aria-label={`Set affiliation to ${school}`}
                    className={`text-xs px-3 py-1.5 min-h-[38px] rounded border transition-all active:scale-[0.97] flex items-center justify-center ${
                      affiliation === school
                        ? "bg-sky-50 text-sky-700 border-sky-300 font-semibold shadow-xs dark:bg-ba-cyan/20 dark:text-ba-cyan dark:border-ba-cyan/50"
                        : "bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800/60 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-zinc-800"
                    }`}
                  >
                    {school.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1.5">
                <label
                  htmlFor="dialogue-textarea"
                  className="text-xs font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-ba-cyan" />
                  <span>Dialogue Text</span>
                </label>
                <div className="flex items-center gap-2">
                  {detectedDialogueEmotion && (
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded text-ba-cyan bg-sky-500/10 border border-sky-500/30">
                      Tone: {detectedDialogueEmotion.label}
                    </span>
                  )}
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    {content.length} chars
                  </span>
                </div>
              </div>
              <textarea
                id="dialogue-textarea"
                rows={4}
                value={content}
                onChange={(e) => scenarioStore.set({ content: e.target.value })}
                placeholder="Enter scenario dialogue here... (Use *...* for whisper thoughts/monologue)"
                className="w-full px-3.5 py-2.5 min-h-[100px] rounded bg-white dark:bg-zinc-900/60 border border-slate-300 dark:border-zinc-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition-colors leading-relaxed resize-none shadow-xs"
              />

              {/* Tactical Expression Alignment (clean divider row without nested card) */}
              {detectedDialogueEmotion && (
                <div className="mt-2.5 py-2 px-1 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 min-w-0">
                    <span className="font-mono text-[10px] font-semibold text-ba-cyan bg-sky-500/15 px-1.5 py-0.5 rounded">
                      {detectedDialogueEmotion.category}
                    </span>
                    <span className="truncate text-xs text-slate-600 dark:text-slate-300">
                      Tone: <strong className="text-slate-900 dark:text-white font-medium">{detectedDialogueEmotion.label}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const matched = findSpriteByReactionOrExpression(
                        uniqueAvailableSprites,
                        detectedDialogueEmotion.category,
                      );
                      if (matched) {
                        handleSelectExpression(matched);
                        setSelectedReactionCategory(detectedDialogueEmotion.category);
                        toast.success(
                          `Aligned sprite: ${matched.meta.label} (${matched.meta.code})`,
                        );
                      } else {
                        toast.info(
                          `No specific ${detectedDialogueEmotion.label} sprite found for ${name}.`,
                        );
                      }
                    }}
                    className="px-3 py-1.5 min-h-[34px] rounded bg-ba-cyan/15 hover:bg-ba-cyan/25 text-ba-cyan border border-ba-cyan/40 text-xs font-semibold shrink-0 transition-all active:scale-[0.97]"
                  >
                    Sync Sprite
                  </button>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="scroll-speed-slider"
                  className="text-xs font-semibold text-slate-800 dark:text-zinc-200"
                >
                  Typewriter Scroll Speed
                </label>
                <span className="text-xs font-mono font-bold text-ba-cyan">
                  {scrollSpeed}x
                </span>
              </div>
              <input
                id="scroll-speed-slider"
                type="range"
                min={0.2}
                max={3.0}
                step={0.1}
                value={scrollSpeed}
                onChange={(e) => scenarioStore.set({ scrollSpeed: parseFloat(e.target.value) })}
                aria-label="Typewriter scroll speed"
                aria-valuemin={0.2}
                aria-valuemax={3.0}
                aria-valuenow={scrollSpeed}
                className="w-full accent-ba-cyan cursor-pointer h-2"
              />
              <div className="flex justify-between text-xs font-mono text-slate-500 dark:text-slate-400 mt-1.5">
                <span>0.2x (Slow)</span>
                <span>1.0x (Standard)</span>
                <span>3.0x (Instant)</span>
              </div>
            </div>
          </div>
        )}

        {/* 2. STUDENT TAB */}
        {activeTab === "student" && (
          <div
            role="tabpanel"
            id="panel-student"
            aria-labelledby="tab-student"
            className="flex flex-col gap-4"
          >
            {/* Characters on Stage Slots Bar */}
            <div className="pb-3 border-b border-slate-200 dark:border-zinc-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  <Users className="w-3.5 h-3.5 text-ba-cyan" />
                  <span>Characters on Stage ({characters.length})</span>
                </div>
                {characters.length < 6 && (
                  <button
                    type="button"
                    onClick={handleAddCharacter}
                    aria-label="Add student to scene"
                    className="flex items-center gap-1 px-2.5 py-1 min-h-[34px] rounded bg-ba-cyan hover:bg-cyan-300 text-black font-bold text-xs transition-all active:scale-[0.96] shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Student</span>
                  </button>
                )}
              </div>

              {/* Slot Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Character slots">
                {characters.map((char, idx) => {
                  const isSelected = safeCharIndex === idx;
                  const isSpeaker = name === char.name;
                  return (
                    <div
                      key={`slot_${char.id || idx}_${idx}`}
                      className={`flex items-center rounded border transition-all ${
                        isSelected
                          ? "border-ba-cyan bg-ba-cyan/15 text-ba-cyan shadow-sm"
                          : "border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900/60 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedCharIndex(idx)}
                        aria-label={`Select slot ${idx + 1}: ${char.name}`}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 min-h-[38px] text-xs font-semibold"
                      >
                        <div className="w-5 h-5 rounded-full overflow-hidden shrink-0 bg-slate-200 dark:bg-zinc-800">
                          {char.spriteUrl ? (
                            <img src={char.spriteUrl} alt="" className="w-full h-full object-cover object-top" />
                          ) : (
                            <User className="w-3 h-3 text-slate-400" />
                          )}
                        </div>
                        <span className="truncate max-w-[80px]">{char.name || `Student ${idx + 1}`}</span>
                        {isSpeaker ? (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-400/20 text-amber-500 font-bold border border-amber-400/40">
                            Speaker
                          </span>
                        ) : (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-500/20 text-zinc-400 font-medium border border-zinc-500/30">
                            Inactive
                          </span>
                        )}
                      </button>
                      {characters.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCharacter(idx)}
                          aria-label={`Remove ${char.name} from stage`}
                          title={`Remove ${char.name}`}
                          className="pr-2 pl-1 py-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Student Info */}
            <div className="py-3 px-1 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                  {activeCharacter.spriteUrl ? (
                    <img
                      src={activeCharacter.spriteUrl}
                      alt={`Portrait of ${activeCharacter.name}`}
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <User className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 dark:text-white truncate flex items-center gap-2">
                    <span>{activeCharacter.name || "Student"}</span>
                    {name === activeCharacter.name ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-ba-cyan/20 text-ba-cyan border border-ba-cyan/40 font-semibold">
                        Dialogue Speaker
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetSpeaker(safeCharIndex)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-ba-cyan/20 text-slate-600 dark:text-zinc-300 hover:text-ba-cyan transition-colors border border-slate-300 dark:border-zinc-700"
                      >
                        Set as Speaker
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-ba-cyan truncate">
                    {activeCharacter.affiliation || (activeCharacter.name === name ? affiliation : "Kivotos Student")}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
                      ID: <span className="text-ba-cyan font-bold">{activeCharacter.id}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const id = activeCharacter.id || "student";
                        navigator.clipboard.writeText(id);
                        toast.success(`Copied student ID: ${id}`);
                      }}
                      aria-label={`Copy student ID ${activeCharacter.id || "student"}`}
                      className="p-1.5 min-h-[34px] min-w-[34px] rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center justify-center"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Expression Sprites Grid */}
            {uniqueAvailableSprites.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Smile className="w-3.5 h-3.5 text-ba-cyan" />
                    <span>Expressions ({uniqueAvailableSprites.length})</span>
                  </span>
                  {activeSpriteMeta && (
                    <span className="text-xs font-mono text-ba-cyan font-semibold">
                      Current: {activeSpriteMeta.label}
                    </span>
                  )}
                </div>

                {/* Category Filter Pills */}
                <div
                  className="flex items-center gap-1.5 overflow-x-auto pb-1"
                  role="group"
                  aria-label="Reaction emotion categories"
                >
                  {studentReactionCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedReactionCategory(cat.id)}
                      aria-label={`Filter by ${cat.label} reactions`}
                      className={`text-xs px-3 py-1.5 min-h-[38px] rounded border whitespace-nowrap transition-all active:scale-[0.97] flex items-center justify-center ${
                        selectedReactionCategory === cat.id
                          ? "bg-ba-cyan/20 text-ba-cyan border-ba-cyan/50 font-semibold"
                          : "bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800/60 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-zinc-800"
                      }`}
                    >
                      {cat.label} ({cat.count})
                    </button>
                  ))}
                </div>

                {/* Sprites Thumbnails Grid (flat grid without nested card container) */}
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-52 overflow-y-auto py-1">
                  {displayedSprites.map((sprite) => {
                    const isSelected =
                      activeCharacter.spriteUrl === sprite.url ||
                      activeCharacter.filename === sprite.fileName;
                    return (
                      <button
                        key={sprite.fileName}
                        type="button"
                        onClick={() => handleSelectExpression(sprite)}
                        aria-label={`Select expression ${sprite.meta.label}`}
                        className={`group flex flex-col items-center p-1.5 rounded text-left transition-all active:scale-[0.97] ${
                          isSelected
                            ? "bg-ba-cyan/20 ring-1 ring-ba-cyan"
                            : "hover:bg-slate-100 dark:hover:bg-zinc-800/60"
                        }`}
                      >
                        <div className="w-full aspect-square rounded bg-slate-100 dark:bg-zinc-900 overflow-hidden flex items-center justify-center mb-1 relative border border-slate-200/60 dark:border-zinc-800/60">
                          <img
                            src={sprite.url}
                            alt={sprite.meta.label}
                            className="w-full h-full object-cover object-top transition-transform duration-200 group-hover:scale-105"
                            loading="lazy"
                          />
                          <span
                            className={`absolute bottom-0.5 right-0.5 text-[9px] font-mono font-bold px-1 rounded border ${sprite.meta.badgeClass}`}
                          >
                            {sprite.meta.code}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold leading-tight truncate w-full text-slate-700 dark:text-slate-200 group-hover:text-ba-cyan transition-colors">
                          {sprite.meta.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Character Transform Controls */}
            <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <Move className="w-3.5 h-3.5 text-ba-cyan" />
                  <span>Character Placement ({activeCharacter.name || "Student"})</span>
                </span>
                <button
                  type="button"
                  onClick={handleResetCharacterTransform}
                  className="text-xs text-ba-cyan hover:underline font-mono min-h-[38px] px-2 flex items-center"
                >
                  Reset
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 mb-1">
                    <label htmlFor="char-x-offset" className="cursor-pointer">X Offset</label>
                    <span className="font-mono text-ba-cyan">{activeCharacter.x || 0}px</span>
                  </div>
                  <input
                    id="char-x-offset"
                    type="range"
                    min={-600}
                    max={600}
                    step={10}
                    value={activeCharacter.x || 0}
                    onChange={(e) =>
                      handleCharacterTransform({ x: parseInt(e.target.value, 10) })
                    }
                    aria-label="Character horizontal offset"
                    className="w-full accent-ba-cyan cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 mb-1">
                    <label htmlFor="char-y-offset" className="cursor-pointer">Y Offset</label>
                    <span className="font-mono text-ba-cyan">{activeCharacter.y || 0}px</span>
                  </div>
                  <input
                    id="char-y-offset"
                    type="range"
                    min={-300}
                    max={300}
                    step={10}
                    value={activeCharacter.y || 0}
                    onChange={(e) =>
                      handleCharacterTransform({ y: parseInt(e.target.value, 10) })
                    }
                    aria-label="Character vertical offset"
                    className="w-full accent-ba-cyan cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 mb-1">
                  <label htmlFor="char-scale" className="cursor-pointer">Scale (Size)</label>
                  <span className="font-mono text-ba-cyan">{(activeCharacter.scale || 1).toFixed(2)}x</span>
                </div>
                <input
                  id="char-scale"
                  type="range"
                  min={0.4}
                  max={2.0}
                  step={0.05}
                  value={activeCharacter.scale || 1}
                  onChange={(e) =>
                    handleCharacterTransform({ scale: parseFloat(e.target.value) })
                  }
                  aria-label="Character scale"
                  className="w-full accent-ba-cyan cursor-pointer"
                />
              </div>

              {/* Character Blur (Bokeh) Toggle */}
              <div className="pt-2.5 mt-2.5 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 min-h-[44px]">
                <div>
                  <span id="label-char-blur" className="text-xs font-semibold text-slate-800 dark:text-zinc-200 block">
                    Character Blur (Bokeh)
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Soft out-of-focus blur for background or secondary students
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  id="switch-char-blur"
                  aria-checked={!!activeCharacter.blur}
                  aria-labelledby="label-char-blur"
                  onClick={() => {
                    handleCharacterTransform({ blur: !activeCharacter.blur });
                  }}
                  className={`w-12 h-7 rounded-full transition-colors relative p-0.5 min-w-[48px] ${
                    activeCharacter.blur
                      ? "bg-ba-accent"
                      : "bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform block ${
                      activeCharacter.blur ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Force Dim & Step Back Toggle */}
              <div className="pt-2.5 mt-2.5 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 min-h-[44px]">
                <div>
                  <span id="label-char-darken" className="text-xs font-semibold text-slate-800 dark:text-zinc-200 block">
                    Dim &amp; Step Back (Abu-abu &amp; Mundur)
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Shade character grey-ish &amp; 0.93x scale as non-speaking listener
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  id="switch-char-darken"
                  aria-checked={!!activeCharacter.darken}
                  aria-labelledby="label-char-darken"
                  onClick={() => {
                    handleCharacterTransform({ darken: !activeCharacter.darken });
                  }}
                  className={`w-12 h-7 rounded-full transition-colors relative p-0.5 min-w-[48px] ${
                    activeCharacter.darken
                      ? "bg-ba-accent"
                      : "bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform block ${
                      activeCharacter.darken ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Student Roster Browser */}
            <div className="border-t border-slate-200 dark:border-zinc-800 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  Student Roster (819 Total)
                </span>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  {filteredStudents.length} matches
                </span>
              </div>

              {/* Search & School Filter */}
              <div className="flex gap-2 mb-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => {
                      setStudentSearch(e.target.value);
                      setStudentPage(1);
                    }}
                    placeholder="Search student or school..."
                    aria-label="Search student by name or school"
                    className="w-full pl-9 pr-3 py-2 min-h-[38px] rounded bg-slate-50 dark:bg-zinc-900/60 border border-slate-300 dark:border-zinc-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-ba-cyan"
                  />
                </div>

                <select
                  value={studentSchoolFilter}
                  onChange={(e) => {
                    setStudentSchoolFilter(e.target.value);
                    setStudentPage(1);
                  }}
                  aria-label="Filter student by school"
                  className="px-2.5 py-2 min-h-[38px] rounded bg-slate-50 dark:bg-zinc-900/60 border border-slate-300 dark:border-zinc-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-ba-cyan"
                >
                  <option value="All">All Schools</option>
                  {SCHOOL_PRESETS.map((sch) => (
                    <option key={sch} value={sch}>
                      {sch}
                    </option>
                  ))}
                </select>
              </div>

              {/* Student Grid (flat grid without nested card container) */}
              <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto py-1">
                {currentStudentPageItems.map((st) => {
                  const isCurrent = activeCharacter.id === st.id || activeCharacter.name === st.name;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => handleSelectStudent(st)}
                      aria-label={`Select student ${st.name}`}
                      className={`flex items-center gap-2.5 p-2 rounded text-left transition-all active:scale-[0.98] ${
                        isCurrent
                          ? "bg-ba-cyan/20 ring-1 ring-ba-cyan"
                          : "hover:bg-slate-100 dark:hover:bg-zinc-800/60"
                      }`}
                    >
                      <div className="w-10 h-10 rounded bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                        {st.thumbnail || st.url ? (
                          <img
                            src={st.thumbnail || st.url}
                            alt={st.name}
                            className="w-full h-full object-cover object-top"
                            loading="lazy"
                          />
                        ) : (
                          <User className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{st.name}</div>
                        <div className="text-[11px] text-ba-cyan truncate">{st.school || "Kivotos"}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Pagination with accessible 38px touch targets */}
              {studentTotalPages > 1 && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200 dark:border-zinc-800 text-xs text-slate-600 dark:text-slate-300">
                  <button
                    type="button"
                    disabled={studentPage <= 1}
                    onClick={() => setStudentPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous student page"
                    className="px-3 py-1.5 min-h-[38px] min-w-[38px] rounded border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30 flex items-center justify-center transition-all active:scale-[0.96]"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                    Page {studentPage} of {studentTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={studentPage >= studentTotalPages}
                    onClick={() => setStudentPage((p) => Math.min(studentTotalPages, p + 1))}
                    aria-label="Next student page"
                    className="px-3 py-1.5 min-h-[38px] min-w-[38px] rounded border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30 flex items-center justify-center transition-all active:scale-[0.96]"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. BACKGROUND TAB */}
        {activeTab === "background" && (
          <div
            role="tabpanel"
            id="panel-background"
            aria-labelledby="tab-background"
            className="flex flex-col gap-4"
          >
            {/* Active Background Card */}
            <div className="py-3 px-1 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-16 h-10 rounded bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                  {backgroundUrl ? (
                    <img
                      src={backgroundUrl}
                      alt={backgroundName || "Current scenario background"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {backgroundName || "Default Background"}
                  </div>
                  <div className="text-[11px] text-ba-cyan truncate font-mono mt-0.5">
                    {backgroundUrl ? "Custom / Asset Scene" : "Default Classroom"}
                  </div>
                </div>
              </div>
            </div>

            {/* Background Transform Controls */}
            <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <ZoomIn className="w-3.5 h-3.5 text-ba-cyan" />
                  <span>Background Transform</span>
                </span>
                <button
                  type="button"
                  onClick={handleResetBackgroundTransform}
                  className="text-xs text-ba-cyan hover:underline font-mono min-h-[38px] px-2 flex items-center"
                >
                  Reset
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 mb-1">
                    <label htmlFor="bg-x-offset" className="cursor-pointer">X Offset</label>
                    <span className="font-mono text-ba-cyan">{backgroundXOffset}px</span>
                  </div>
                  <input
                    id="bg-x-offset"
                    type="range"
                    min={-600}
                    max={600}
                    step={10}
                    value={backgroundXOffset}
                    onChange={(e) =>
                      handleBackgroundTransform({ x: parseInt(e.target.value, 10) })
                    }
                    aria-label="Background horizontal offset"
                    className="w-full accent-ba-cyan cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 mb-1">
                    <label htmlFor="bg-y-offset" className="cursor-pointer">Y Offset</label>
                    <span className="font-mono text-ba-cyan">{backgroundYOffset}px</span>
                  </div>
                  <input
                    id="bg-y-offset"
                    type="range"
                    min={-300}
                    max={300}
                    step={10}
                    value={backgroundYOffset}
                    onChange={(e) =>
                      handleBackgroundTransform({ y: parseInt(e.target.value, 10) })
                    }
                    aria-label="Background vertical offset"
                    className="w-full accent-ba-cyan cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 mb-1">
                  <label htmlFor="bg-zoom-scale" className="cursor-pointer">Zoom Scale</label>
                  <span className="font-mono text-ba-cyan">{backgroundScale.toFixed(2)}x</span>
                </div>
                <input
                  id="bg-zoom-scale"
                  type="range"
                  min={0.5}
                  max={2.5}
                  step={0.05}
                  value={backgroundScale}
                  onChange={(e) =>
                    handleBackgroundTransform({ scale: parseFloat(e.target.value) })
                  }
                  aria-label="Background zoom scale"
                  className="w-full accent-ba-cyan cursor-pointer"
                />
              </div>

              {/* Background Blur Toggle */}
              <div className="pt-2.5 mt-2.5 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 min-h-[44px]">
                <div>
                  <span id="label-bg-blur-tab" className="text-xs font-semibold text-slate-800 dark:text-zinc-200 block">
                    Background Blur (Depth of Field)
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Cinematic bokeh blur to emphasize foreground students
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  id="switch-bg-blur-tab"
                  aria-checked={backgroundBlur}
                  aria-labelledby="label-bg-blur-tab"
                  onClick={() => {
                    const nextVal = !backgroundBlur;
                    scenarioStore.set({ backgroundBlur: nextVal });
                    const renderer = getActiveScenarioRenderer();
                    if (renderer) renderer.sync(scenarioStore.getState());
                  }}
                  className={`w-12 h-7 rounded-full transition-colors relative p-0.5 min-w-[48px] ${
                    backgroundBlur
                      ? "bg-ba-accent"
                      : "bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform block ${
                      backgroundBlur ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Background Catalog Browser */}
            <div className="border-t border-slate-200 dark:border-zinc-800 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  Scene Catalog (830 Total)
                </span>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  {filteredBackgrounds.length} scenes
                </span>
              </div>

              {/* Search */}
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={bgSearch}
                  onChange={(e) => {
                    setBgSearch(e.target.value);
                    setBgPage(1);
                  }}
                  placeholder="Search background scene..."
                  aria-label="Search background scene"
                  className="w-full pl-9 pr-3 py-2 min-h-[38px] rounded bg-slate-50 dark:bg-zinc-900/60 border border-slate-300 dark:border-zinc-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-ba-cyan"
                />
              </div>

              {/* Background Grid (flat grid without nested card container) */}
              <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto py-1">
                {currentBgPageItems.map((bg) => {
                  const isCurrent = backgroundUrl === bg.url;
                  return (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => handleSelectBackground(bg)}
                      aria-label={`Select background ${bg.name}`}
                      className={`flex flex-col p-1.5 rounded text-left transition-all active:scale-[0.98] ${
                        isCurrent
                          ? "bg-ba-cyan/20 ring-1 ring-ba-cyan"
                          : "hover:bg-slate-100 dark:hover:bg-zinc-800/60"
                      }`}
                    >
                      <div className="w-full aspect-video rounded bg-slate-100 dark:bg-zinc-900 overflow-hidden mb-1.5 border border-slate-200/60 dark:border-zinc-800/60">
                        <img
                          src={bg.thumbnail || bg.url}
                          alt={bg.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-white truncate w-full">
                        {bg.name}
                      </div>
                      <div className="flex items-center justify-between mt-1 w-full">
                        <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 truncate max-w-[130px]">
                          {bg.id}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Pagination with accessible 38px touch targets */}
              {bgTotalPages > 1 && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200 dark:border-zinc-800 text-xs text-slate-600 dark:text-slate-300">
                  <button
                    type="button"
                    disabled={bgPage <= 1}
                    onClick={() => setBgPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous background page"
                    className="px-3 py-1.5 min-h-[38px] min-w-[38px] rounded border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30 flex items-center justify-center transition-all active:scale-[0.96]"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                    Page {bgPage} of {bgTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={bgPage >= bgTotalPages}
                    onClick={() => setBgPage((p) => Math.min(bgTotalPages, p + 1))}
                    aria-label="Next background page"
                    className="px-3 py-1.5 min-h-[38px] min-w-[38px] rounded border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30 flex items-center justify-center transition-all active:scale-[0.96]"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. ELEMENTS TAB (Accessible Switch Toggles) */}
        {activeTab === "elements" && (
          <div
            role="tabpanel"
            id="panel-elements"
            aria-labelledby="tab-elements"
            className="flex flex-col"
          >
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
              Toggle scenario HUD visual elements and transparent rendering options in real time.
            </p>

            {/* Gradient Vignette Switch */}
            <div className="py-3 px-1 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 min-h-[56px]">
              <div>
                <span id="label-gradient" className="text-xs font-semibold text-slate-900 dark:text-white block">
                  Gradient Vignette
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Cinematic lower gradient for dialogue readability
                </span>
              </div>
              <button
                type="button"
                role="switch"
                id="switch-gradient"
                aria-checked={displayGradient}
                aria-labelledby="label-gradient"
                onClick={() => scenarioStore.set({ displayGradient: !displayGradient })}
                className={`w-12 h-7 rounded-full transition-colors relative p-0.5 min-w-[48px] ${
                  displayGradient ? "bg-ba-accent" : "bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform block ${
                    displayGradient ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Divider Line Switch */}
            <div className="py-3 px-1 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 min-h-[56px]">
              <div>
                <span id="label-divider" className="text-xs font-semibold text-slate-900 dark:text-white block">
                  Divider Line
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Horizontal rule between student info and dialogue text
                </span>
              </div>
              <button
                type="button"
                role="switch"
                id="switch-divider"
                aria-checked={displayLine}
                aria-labelledby="label-divider"
                onClick={() => scenarioStore.set({ displayLine: !displayLine })}
                className={`w-12 h-7 rounded-full transition-colors relative p-0.5 min-w-[48px] ${
                  displayLine ? "bg-ba-accent" : "bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform block ${
                    displayLine ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Auto Play HUD Button Switch */}
            <div className="py-3 px-1 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 min-h-[56px]">
              <div>
                <span id="label-autoplay" className="text-xs font-semibold text-slate-900 dark:text-white block">
                  Auto Play HUD Button
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Top right Kivotos visual novel auto button indicator
                </span>
              </div>
              <button
                type="button"
                role="switch"
                id="switch-autoplay"
                aria-checked={displayButtons}
                aria-labelledby="label-autoplay"
                onClick={() => scenarioStore.set({ displayButtons: !displayButtons })}
                className={`w-12 h-7 rounded-full transition-colors relative p-0.5 min-w-[48px] ${
                  displayButtons ? "bg-ba-accent" : "bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform block ${
                    displayButtons ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Bouncing Triangle Switch */}
            <div className="py-3 px-1 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 min-h-[56px]">
              <div>
                <span id="label-triangle" className="text-xs font-semibold text-slate-900 dark:text-white block">
                  Bouncing Triangle Indicator
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Animated prompt indicator when dialogue finishes typing
                </span>
              </div>
              <button
                type="button"
                role="switch"
                id="switch-triangle"
                aria-checked={displayTriangle}
                aria-labelledby="label-triangle"
                onClick={() => scenarioStore.set({ displayTriangle: !displayTriangle })}
                className={`w-12 h-7 rounded-full transition-colors relative p-0.5 min-w-[48px] ${
                  displayTriangle ? "bg-ba-accent" : "bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform block ${
                    displayTriangle ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Transparent Background Mode Switch */}
            <div className="py-3 px-1 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 min-h-[56px]">
              <div>
                <span id="label-transparent" className="text-xs font-semibold text-slate-900 dark:text-white block">
                  Transparent PNG Mode
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Renders transparent backdrop for student sprite cutouts
                </span>
              </div>
              <button
                type="button"
                role="switch"
                id="switch-transparent"
                aria-checked={transparentBackground}
                aria-labelledby="label-transparent"
                onClick={() =>
                  scenarioStore.set({
                    transparentBackground: !transparentBackground,
                  })
                }
                className={`w-12 h-7 rounded-full transition-colors relative p-0.5 min-w-[48px] ${
                  transparentBackground ? "bg-ba-accent" : "bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform block ${
                    transparentBackground ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Background Blur Switch */}
            <div className="py-3 px-1 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 min-h-[56px] last:border-b-0">
              <div>
                <span id="label-blur-elem" className="text-xs font-semibold text-slate-900 dark:text-white block">
                  Background Blur (Depth of Field)
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Cinematic depth blur on the background scene
                </span>
              </div>
              <button
                type="button"
                role="switch"
                id="switch-blur-elem"
                aria-checked={backgroundBlur}
                aria-labelledby="label-blur-elem"
                onClick={() => {
                  const nextVal = !backgroundBlur;
                  scenarioStore.set({ backgroundBlur: nextVal });
                  const renderer = getActiveScenarioRenderer();
                  if (renderer) renderer.sync(scenarioStore.getState());
                }}
                className={`w-12 h-7 rounded-full transition-colors relative p-0.5 min-w-[48px] ${
                  backgroundBlur ? "bg-ba-accent" : "bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform block ${
                    backgroundBlur ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

