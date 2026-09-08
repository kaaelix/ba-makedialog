"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ScenarioRenderer,
  setActiveScenarioRenderer,
  getActiveScenarioRenderer,
} from "@/lib/scenario/renderer/scenario-renderer";
import { scenarioStore, useScenarioStore } from "@/lib/scenario/store";
import {
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Minimize2,
  RefreshCw,
  Activity,
} from "lucide-react";
import { toast } from "sonner";

const SPEED_PRESETS = [0.5, 1, 1.5, 2];

export function ScenarioCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const animate = useScenarioStore((s) => s.animate);
  const scrollSpeed = useScenarioStore((s) => s.scrollSpeed);
  const transparentBackground = useScenarioStore((s) => s.transparentBackground);

  // WebGL Renderer Lifecycle Initialization
  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    let disposed = false;
    let rendererInstance: ScenarioRenderer | null = null;
    let unsubscribe: (() => void) | null = null;

    host.replaceChildren();

    ScenarioRenderer.create()
      .then((created) => {
        if (disposed) {
          created.destroy();
          return;
        }

        rendererInstance = created;
        setActiveScenarioRenderer(created);

        // Explicitly set responsive scaling on mounted canvas
        created.canvas.style.width = "100%";
        created.canvas.style.height = "100%";
        created.canvas.style.maxWidth = "100%";
        created.canvas.style.maxHeight = "100%";
        created.canvas.style.objectFit = "contain";
        created.canvas.style.display = "block";

        host.replaceChildren(created.canvas);
        created.sync(scenarioStore.getState());

        unsubscribe = scenarioStore.subscribe(() => {
          if (!disposed && rendererInstance) {
            rendererInstance.sync(scenarioStore.getState());
          }
        });

        setEngineReady(true);
      })
      .catch((err) => {
        console.error("Failed to initialize PixiJS ScenarioRenderer:", err);
        setEngineReady(false);
        toast.error("Failed to initialize WebGL scenario renderer.");
      });

    return () => {
      disposed = true;
      unsubscribe?.();
      setActiveScenarioRenderer(null);
      rendererInstance?.destroy();
      host.replaceChildren();
    };
  }, []);

  // Respect system prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      scenarioStore.set({ animate: false });
    }
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) {
        scenarioStore.set({ animate: false });
      }
    };
    mediaQuery.addEventListener?.("change", handler);
    return () => mediaQuery.removeEventListener?.("change", handler);
  }, []);

  // Keyboard shortcut listener for Fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const handleTogglePlay = useCallback(() => {
    const current = scenarioStore.getState().animate;
    const next = !current;
    scenarioStore.set({ animate: next });
    const renderer = getActiveScenarioRenderer();
    if (next && renderer) {
      renderer.restartAnimation();
    }
  }, []);

  const handleReplay = useCallback(() => {
    scenarioStore.set({ animate: true });
    const renderer = getActiveScenarioRenderer();
    if (renderer) {
      renderer.restartAnimation();
      toast.success("Animation replayed from beginning.");
    }
  }, []);

  const handleSetSpeed = useCallback((speedVal: number) => {
    scenarioStore.set({ scrollSpeed: speedVal });
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  return (
    <section
      aria-label="Scenario Preview Viewport"
      className={`relative w-full aspect-video overflow-hidden bg-[#070b10] flex items-center justify-center select-none rounded-lg border border-slate-300 dark:border-zinc-800 shadow-xs ${
        isFullscreen ? "h-screen w-screen max-w-none z-50 fixed inset-0 rounded-none border-0" : ""
      }`}
    >
      <h2 className="sr-only">Scenario Canvas Viewport</h2>
      {/* Initializing Spinner Screen */}
      {!engineReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0b] z-30 gap-3">
          <RefreshCw className="w-6 h-6 text-ba-cyan animate-spin" />
          <div className="text-center">
            <p className="text-sm font-semibold text-zinc-100">
              Initializing WebGL Engine
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              Loading 1920x1080 canvas and typography
            </p>
          </div>
        </div>
      )}

      {/* PixiJS Canvas Mounting Container */}
      <div
        ref={containerRef}
        className={`w-full h-full max-w-full max-h-full flex items-center justify-center overflow-hidden [&>canvas]:!w-full [&>canvas]:!h-full [&>canvas]:!max-w-full [&>canvas]:!max-h-full [&>canvas]:!object-contain [&>canvas]:block ${
          engineReady ? "opacity-100 transition-opacity duration-200" : "opacity-0"
        }`}
      />

      {/* Top Fullscreen Action */}
      <div className="absolute top-3 right-3 z-20">
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          title={isFullscreen ? "Exit Fullscreen (Esc)" : "Enter Fullscreen"}
          className="p-2 min-h-[44px] min-w-[44px] rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-100 hover:text-white border border-zinc-700/80 transition-colors flex items-center justify-center"
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Flat Player Controls Bar */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={handleTogglePlay}
          aria-label={animate ? "Pause Typewriter Animation" : "Start Typewriter Animation"}
          title={animate ? "Pause Typewriter Animation" : "Start Typewriter Animation"}
          className={`flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded text-xs font-bold transition-all active:scale-[0.98] ${
            animate
              ? "bg-amber-400 hover:bg-amber-300 text-black"
              : "bg-ba-cyan hover:bg-cyan-300 text-black"
          }`}
        >
          {animate ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Play</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleReplay}
          aria-label="Replay animation from start"
          title="Replay animation sequence"
          className="flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded bg-black/60 hover:bg-black/90 backdrop-blur-sm text-zinc-200 hover:text-white text-xs font-medium border border-white/15 transition-all active:scale-[0.98]"
        >
          <RotateCcw className="w-3.5 h-3.5 text-ba-cyan" />
          <span>Replay</span>
        </button>

        {/* Speed Controls */}
        <div className="items-center gap-1 hidden sm:flex px-1 min-h-[44px]">
          <span className="text-xs text-zinc-300 font-medium mr-1 drop-shadow-sm">
            Speed
          </span>
          {SPEED_PRESETS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleSetSpeed(s)}
              aria-label={`Set speed to ${s}x`}
              className={`px-2.5 py-1 min-h-[36px] min-w-[36px] rounded text-xs font-mono font-medium transition-all active:scale-[0.96] flex items-center justify-center border ${
                scrollSpeed === s
                  ? "bg-ba-cyan text-black font-bold border-ba-cyan shadow-sm"
                  : "bg-black/60 hover:bg-black/90 backdrop-blur-sm text-zinc-200 hover:text-white border-white/15"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

