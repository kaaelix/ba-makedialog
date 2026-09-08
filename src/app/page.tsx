"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useScenarioStore } from "@/lib/scenario/store";
import { getActiveScenarioRenderer } from "@/lib/scenario/renderer/scenario-renderer";
import { clientAssetCatalog } from "@/lib/assets/client-catalog";
import { Code, Eye, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { ScenarioCanvas } from "@/components/studio/scenario-canvas";
import { GenerationToolbar } from "@/components/studio/generation-toolbar";
import { ScenarioEditor } from "@/components/studio/scenario-editor";
import {
  SnapshotModal,
  ApiReferenceModal,
} from "@/components/studio/asset-browser-modal";

export default function ScenarioStudioPage() {
  const [previewSnapshotOpen, setPreviewSnapshotOpen] = useState(false);
  const [previewSnapshotSrc, setPreviewSnapshotSrc] = useState<string | null>(null);
  const [apiReferenceOpen, setApiReferenceOpen] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Sync and persist theme
  useEffect(() => {
    const stored = localStorage.getItem("ba-theme");
    if (stored === "dark") {
      setTheme("dark");
      document.documentElement.classList.add("dark");
    } else if (stored === "light") {
      setTheme("light");
      document.documentElement.classList.remove("dark");
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
      document.documentElement.classList.add("dark");
    } else {
      setTheme("light");
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      if (next === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      localStorage.setItem("ba-theme", next);
      return next;
    });
  }, []);

  // Store data for API reference and export metadata
  const name = useScenarioStore((s) => s.name);
  const content = useScenarioStore((s) => s.content);
  const characters = useScenarioStore((s) => s.characters);
  const backgroundUrl = useScenarioStore((s) => s.backgroundUrl);

  const primaryCharacter = characters[0] || {
    id: "student",
    name: "Student",
    spriteUrl: "",
    filename: "student.png",
    timestamp: Date.now(),
    x: 0,
    y: 0,
    scale: 1,
  };

  const allBackgrounds = useMemo(() => clientAssetCatalog.getBackgrounds(), []);
  const activeBgId = useMemo(() => {
    const found = allBackgrounds.find((b) => b.url === backgroundUrl);
    return found?.id || "bg_bg_abandonedcorridor_night";
  }, [allBackgrounds, backgroundUrl]);

  // Snapshot Inspection Handler
  const handleInspectSnapshot = useCallback(() => {
    const renderer = getActiveScenarioRenderer();
    const canvas = renderer?.renderToCanvas();
    if (!canvas) {
      toast.error("Scenario canvas is still initializing.");
      return;
    }
    const dataUrl = canvas.toDataURL("image/png");
    setPreviewSnapshotSrc(dataUrl);
    setPreviewSnapshotOpen(true);
  }, []);

  // Modal Download Handler
  const handleDownload1080pPNG = useCallback(() => {
    try {
      const renderer = getActiveScenarioRenderer();
      if (!renderer) {
        toast.error("Scenario canvas is still initializing.");
        return;
      }
      const canvas = renderer.renderToCanvas();
      if (!canvas) {
        toast.error("Active canvas not ready.");
        return;
      }
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            toast.error("Failed to generate canvas image.");
            return;
          }
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          const safeName = (name || "Scenario").replace(/\s+/g, "_");
          link.download = `BlueArchive_${safeName}_1080p.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
          toast.success("Download 1080p PNG completed.");
        },
        "image/png",
        1.0,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to export image.";
      toast.error(msg);
    }
  }, [name]);

  // Modal Copy Image Handler
  const handleCopyImage = useCallback(() => {
    try {
      const renderer = getActiveScenarioRenderer();
      if (!renderer) {
        toast.error("Scenario canvas is not ready.");
        return;
      }
      const canvas = renderer.renderToCanvas();
      if (!canvas) {
        toast.error("Canvas context unavailable.");
        return;
      }

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            toast.error("Failed to extract image blob.");
            return;
          }

          if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
            const item = new ClipboardItem({ "image/png": blob });
            navigator.clipboard
              .write([item])
              .then(() => {
                setCopiedImage(true);
                toast.success("Scenario image copied to clipboard.");
                setTimeout(() => setCopiedImage(false), 2000);
              })
              .catch(() => {
                const dataUrl = canvas.toDataURL("image/png");
                navigator.clipboard.writeText(dataUrl).then(() => {
                  setCopiedImage(true);
                  toast.success("Scenario image data URL copied to clipboard.");
                  setTimeout(() => setCopiedImage(false), 2000);
                });
              });
          } else {
            const dataUrl = canvas.toDataURL("image/png");
            navigator.clipboard.writeText(dataUrl).then(() => {
              setCopiedImage(true);
              toast.success("Scenario image data URL copied to clipboard.");
              setTimeout(() => setCopiedImage(false), 2000);
            });
          }
        },
        "image/png",
        1.0,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Clipboard unavailable.";
      toast.error(msg);
    }
  }, []);

  return (
    <main className="min-h-[100dvh] bg-[#f1f5f9] text-slate-900 dark:bg-[#0a0a0b] dark:text-[#f4f4f5] flex flex-col antialiased selection:bg-ba-cyan/30 selection:text-ba-cyan transition-colors duration-150">
      {/* Top Studio Header */}
      <header className="h-16 border-b border-slate-200 dark:border-zinc-800/80 bg-white/95 dark:bg-[#0a0a0b]/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-4 select-none shrink-0 sticky top-0 z-30 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Blue Archive Scenario Studio
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 hidden sm:block">
            Visual novel dialogue generator and deterministic scenario editor
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 font-mono">
            <span>819 students</span>
            <span className="text-slate-300 dark:text-zinc-700">/</span>
            <span>830 scenes</span>
          </div>

          {/* Theme Switcher (Dual-Mode Kivotos Light / Dark) */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center justify-center p-2 min-h-[38px] min-w-[38px] rounded border border-slate-300 dark:border-zinc-800 hover:border-slate-400 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/60 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-all active:scale-[0.96] shadow-xs"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setApiReferenceOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded border border-slate-300 dark:border-zinc-800 hover:border-slate-400 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/60 hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:text-slate-900 dark:hover:text-white transition-all active:scale-[0.98] shadow-xs"
            title="View API endpoints and asset IDs"
            aria-label="Open API Endpoints and Asset Identifiers modal"
          >
            <Code className="w-3.5 h-3.5 text-sky-600 dark:text-ba-cyan" />
            <span className="hidden sm:inline">API & Asset IDs</span>
          </button>

          <button
            type="button"
            onClick={handleInspectSnapshot}
            className="flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded border border-slate-300 dark:border-zinc-800 hover:border-slate-400 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/60 hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:text-slate-900 dark:hover:text-white transition-all active:scale-[0.98] shadow-xs"
            title="Inspect active canvas snapshot in full detail"
            aria-label="Inspect active canvas snapshot in full detail"
          >
            <Eye className="w-3.5 h-3.5 text-sky-600 dark:text-ba-cyan" />
            <span className="hidden sm:inline">Inspect Snapshot</span>
          </button>
        </div>
      </header>

      {/* Main Unified Studio Workbench */}
      <div className="flex-1 max-w-[1360px] w-full mx-auto p-2 sm:p-3 lg:p-4 flex flex-col justify-start">
        <div className="grid grid-cols-1 lg:grid-cols-12 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#0e1014] overflow-hidden shadow-sm lg:h-[calc(100dvh-5.5rem)] lg:min-h-[580px] lg:max-h-[740px]">
          {/* Left Studio Column: Canvas Viewport & Action Toolbar */}
          <div className="lg:col-span-7 xl:col-span-7 flex flex-col p-3 sm:p-4 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-zinc-800 gap-3 justify-start overflow-hidden">
            <div className="w-full shrink-0">
              <ScenarioCanvas />
            </div>
            <div className="shrink-0">
              <GenerationToolbar onInspectSnapshot={handleInspectSnapshot} />
            </div>
          </div>

          {/* Right Studio Column: Scenario Editor Property Inspector */}
          <div className="lg:col-span-5 xl:col-span-5 flex flex-col h-full min-h-0 overflow-hidden">
            <ScenarioEditor />
          </div>
        </div>
      </div>

      {/* Full-Detail Snapshot Inspection Modal */}
      <SnapshotModal
        isOpen={previewSnapshotOpen}
        onClose={() => setPreviewSnapshotOpen(false)}
        snapshotSrc={previewSnapshotSrc}
        name={name}
        onCopyImage={handleCopyImage}
        copiedImage={copiedImage}
        onDownloadPNG={handleDownload1080pPNG}
      />

      {/* REST API & Asset Catalog Discovery Modal */}
      <ApiReferenceModal
        isOpen={apiReferenceOpen}
        onClose={() => setApiReferenceOpen(false)}
        characterId={primaryCharacter.id || "student"}
        backgroundId={activeBgId}
        emotionSlug={primaryCharacter.filename || "neutral"}
        dialogueContent={content}
        characterX={primaryCharacter.x || 0}
        characterY={primaryCharacter.y || 0}
        characterScale={primaryCharacter.scale || 1}
        gifSpeed="normal"
      />
    </main>
  );
}
