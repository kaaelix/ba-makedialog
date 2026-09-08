"use client";

import { useState, useCallback } from "react";
import { scenarioStore, useScenarioStore } from "@/lib/scenario/store";
import { getActiveScenarioRenderer } from "@/lib/scenario/renderer/scenario-renderer";
import {
  Download,
  Copy,
  Check,
  Film,
  Eye,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface GenerationToolbarProps {
  onInspectSnapshot: () => void;
}

export function GenerationToolbar({ onInspectSnapshot }: GenerationToolbarProps) {
  const [copiedImage, setCopiedImage] = useState(false);
  const [isExportingGif, setIsExportingGif] = useState(false);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [gifSpeed, setGifSpeed] = useState<"slow" | "normal" | "fast">("normal");

  const name = useScenarioStore((s) => s.name);

  // Download full 1080p PNG directly from active WebGL canvas
  const handleDownload1080pPNG = useCallback(() => {
    try {
      const renderer = getActiveScenarioRenderer();
      if (!renderer) {
        toast.error("Scenario canvas is still initializing.");
        return;
      }
      const canvas = renderer.renderToCanvas();
      if (!canvas) {
        toast.error("Active canvas context not ready.");
        return;
      }
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            toast.error("Failed to generate canvas image blob.");
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

  const copyDataUrlFallback = useCallback((canvas: HTMLCanvasElement) => {
    try {
      const dataUrl = canvas.toDataURL("image/png");
      navigator.clipboard
        .writeText(dataUrl)
        .then(() => {
          setCopiedImage(true);
          toast.success("Scenario image data URL copied to clipboard.");
          setTimeout(() => setCopiedImage(false), 2000);
        })
        .catch(() => {
          toast.error("Clipboard permission denied.");
        });
    } catch {
      toast.error("Clipboard unavailable.");
    }
  }, []);

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
                copyDataUrlFallback(canvas);
              });
          } else {
            copyDataUrlFallback(canvas);
          }
        },
        "image/png",
        1.0,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Clipboard unavailable.";
      toast.error(msg);
    }
  }, [copyDataUrlFallback]);

  // High-performance 30 FPS GIF Export directly from WebGL canvas (fast compile, zero server lag)
  const handleExportGIF = useCallback(async () => {
    setIsExportingGif(true);
    setExportProgress(0);
    const toastId = toast.loading("Rendering scenario GIF...", { id: "export-gif" });

    try {
      const renderer = getActiveScenarioRenderer();
      const safeName = (name || "Scenario").replace(/\s+/g, "_");

      if (renderer) {
        // Direct WebGL 30 FPS frame capture
        const blob = await renderer.exportGif({
          fps: 30,
          speed: gifSpeed,
          onProgress: (ratio) => setExportProgress(Math.round(ratio * 100)),
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `BlueArchive_${safeName}.gif`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success("Download GIF completed.", { id: "export-gif" });
        return;
      }

      // Fallback to serverless API if WebGL renderer is unmounted
      const config = scenarioStore.exportConfig();
      config.output = { type: "animation", mode: "chat", format: "gif" };
      (config as any).speed = gifSpeed;
      (config as any).fps = 30;

      const res = await fetch("/api/scenario/animate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || "GIF generation failed.");
      }

      const gifSrc = data.dataUrl || data.url;
      if (gifSrc) {
        const link = document.createElement("a");
        link.href = gifSrc;
        link.download = `BlueArchive_${safeName}.gif`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      toast.success("Download GIF completed.", { id: "export-gif" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Export failed.";
      toast.error(msg, { id: "export-gif" });
    } finally {
      setIsExportingGif(false);
      setExportProgress(null);
    }
  }, [name, gifSpeed]);

  return (
    <div
      role="region"
      aria-label="Generation and Export Controls"
      className="py-3 px-1 border-t border-slate-200 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 shrink-0"
    >
      <h2 className="sr-only">Generation and Export Actions</h2>

      <div className="flex flex-wrap items-center gap-2">
        {/* Primary 1080p Download Button */}
        <button
          type="button"
          onClick={handleDownload1080pPNG}
          aria-label="Download full 1920x1080 PNG directly from active WebGL canvas"
          title="Download 1920x1080 PNG directly from active WebGL canvas"
          className="flex items-center gap-2 px-4 py-2 min-h-[44px] bg-ba-gold hover:brightness-105 text-zinc-950 font-bold rounded text-xs transition-all active:scale-[0.98] shadow-sm"
        >
          <Download className="w-4 h-4" />
          <span>Download 1080p PNG</span>
        </button>

        {/* Dedicated GIF Export with Speed Selector */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportGIF}
            disabled={isExportingGif}
            aria-label="Download animated scenario GIF"
            title="Export animated scenario GIF"
            className="flex items-center gap-2 px-3.5 py-2 min-h-[44px] bg-white hover:bg-slate-50 dark:bg-zinc-900/60 dark:hover:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 font-semibold rounded text-xs transition-all active:scale-[0.98] shadow-xs disabled:opacity-50"
          >
            {isExportingGif ? (
              <RefreshCw className="w-4 h-4 animate-spin text-ba-cyan" />
            ) : (
              <Film className="w-4 h-4 text-sky-600 dark:text-ba-cyan" />
            )}
            <span>
              {isExportingGif
                ? exportProgress !== null
                ? `Rendering (${exportProgress}%)...`
                : "Rendering GIF..."
                : "Download GIF"}
            </span>
          </button>

          {/* Typewriter Speed Selector Segmented Pill */}
          <div
            className="flex items-center p-0.5 rounded-md bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800"
            title="Dialogue typewriter reading speed"
            role="group"
            aria-label="Typewriter speed"
          >
            {(["slow", "normal", "fast"] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setGifSpeed(spd)}
                aria-pressed={gifSpeed === spd}
                aria-label={`Set speed to ${spd}`}
                className={`px-2.5 py-1 min-h-[34px] text-xs font-semibold rounded transition-all active:scale-[0.97] flex items-center justify-center ${
                  gifSpeed === spd
                    ? "bg-white text-sky-700 shadow-xs border border-slate-200/80 dark:bg-zinc-800 dark:text-white dark:border-transparent"
                    : "text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
                }`}
              >
                {spd === "slow" ? "Slow" : spd === "normal" ? "Normal" : "Fast"}
              </button>
            ))}
          </div>
        </div>

        {/* Copy Image Button */}
        <button
          type="button"
          onClick={handleCopyImage}
          aria-label="Copy full resolution image to clipboard"
          title="Copy full resolution image to clipboard"
          className="flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] bg-white hover:bg-slate-50 dark:bg-zinc-900/60 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 hover:text-slate-900 dark:hover:text-white font-medium rounded text-xs border border-slate-300 dark:border-zinc-800 transition-all active:scale-[0.98] shadow-xs"
        >
          {copiedImage ? (
            <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          ) : (
            <Copy className="w-4 h-4 text-slate-400 dark:text-zinc-400" />
          )}
          <span>{copiedImage ? "Copied" : "Copy Image"}</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onInspectSnapshot}
          aria-label="Inspect active canvas snapshot in full detail"
          title="Inspect active canvas snapshot in full detail"
          className="flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded bg-white hover:bg-slate-50 dark:bg-zinc-900/60 dark:hover:bg-zinc-800 text-xs font-medium text-slate-800 dark:text-zinc-200 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-zinc-800 transition-all active:scale-[0.98] shadow-xs"
        >
          <Eye className="w-4 h-4 text-sky-600 dark:text-ba-cyan" />
          <span>Inspect Snapshot</span>
        </button>
      </div>
    </div>
  );
}

