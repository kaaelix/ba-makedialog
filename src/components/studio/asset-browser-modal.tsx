"use client";

import { useEffect, useRef } from "react";
import {
  X,
  Copy,
  Check,
  Download,
  Camera,
  Code,
} from "lucide-react";
import { toast } from "sonner";

/**
 * WAI-ARIA Focus Trap Hook for Modals
 * Ensures focus stays contained inside the dialog when open and restores focus to trigger on close.
 */
function useModalFocusTrap(isOpen: boolean, onClose: () => void) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    prevFocusRef.current = document.activeElement as HTMLElement | null;
    const modal = modalRef.current;
    if (!modal) return;

    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    // Delay slight tick to allow DOM animation/paint
    const timer = setTimeout(() => {
      const focusables = modal.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        modal.focus();
      }
    }, 20);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        const focusables = Array.from(
          modal.querySelectorAll<HTMLElement>(focusableSelector),
        );
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !modal.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !modal.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
      prevFocusRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  return modalRef;
}

export interface SnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshotSrc: string | null;
  name: string;
  onCopyImage: () => void;
  copiedImage: boolean;
  onDownloadPNG: () => void;
}

export function SnapshotModal({
  isOpen,
  onClose,
  snapshotSrc,
  name,
  onCopyImage,
  copiedImage,
  onDownloadPNG,
}: SnapshotModalProps) {
  const modalRef = useModalFocusTrap(isOpen, onClose);

  if (!isOpen || !snapshotSrc) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="snapshot-modal-title"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-4xl bg-ba-card border border-ba-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] outline-none"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-ba-border bg-ba-dark">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-ba-cyan" />
            <h3 id="snapshot-modal-title" className="text-sm font-semibold text-white">
              Scenario Snapshot Inspector
            </h3>
            <span className="text-[11px] px-2 py-0.5 rounded bg-ba-cyan/15 text-ba-cyan border border-ba-cyan/30 font-mono font-semibold">
              1920 &times; 1080 WebGL
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Snapshot Inspector"
            className="p-2 min-h-[44px] min-w-[44px] rounded-lg text-slate-400 hover:text-white hover:bg-ba-cardHover transition-colors flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Preview Body */}
        <div className="p-4 bg-black/60 flex items-center justify-center overflow-auto flex-1">
          <img
            src={snapshotSrc}
            alt={`1080p scenario dialogue snapshot preview for ${name || "current character"}`}
            className="max-h-[60vh] max-w-full rounded-lg shadow-2xl object-contain border border-ba-border"
          />
        </div>

        {/* Modal Actions Footer */}
        <div className="p-3.5 bg-ba-dark border-t border-ba-border flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400 font-mono">
            Deterministic Single Source of Truth: Active PixiJS Render
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCopyImage}
              aria-label="Copy scenario image to clipboard"
              className="flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-ba-surface hover:bg-ba-cardHover text-slate-200 hover:text-white rounded-lg text-xs font-semibold border border-ba-border transition-colors"
            >
              {copiedImage ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4 text-ba-cyan" />
              )}
              <span>{copiedImage ? "Copied" : "Copy Image"}</span>
            </button>
            <button
              type="button"
              onClick={onDownloadPNG}
              aria-label="Download full 1080p PNG file"
              className="flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-ba-gold hover:brightness-110 text-slate-950 rounded-lg text-xs font-bold transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Download 1080p PNG</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface ApiReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterId: string;
  backgroundId: string;
  emotionSlug: string;
  dialogueContent: string;
  characterX: number;
  characterY: number;
  characterScale: number;
  gifSpeed: "slow" | "normal" | "fast";
}

export function ApiReferenceModal({
  isOpen,
  onClose,
  characterId,
  backgroundId,
  emotionSlug,
  dialogueContent,
  characterX,
  characterY,
  characterScale,
  gifSpeed,
}: ApiReferenceModalProps) {
  const modalRef = useModalFocusTrap(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-modal-title"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-2xl bg-ba-card border border-ba-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-ba-border bg-ba-dark">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-ba-cyan" />
            <h3 id="api-modal-title" className="text-sm font-semibold text-white">
              Scenario Generator API & Asset IDs
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close API Reference"
            className="p-2 min-h-[44px] min-w-[44px] rounded-lg text-slate-400 hover:text-white hover:bg-ba-cardHover transition-colors flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex flex-col gap-4 text-xs">
          {/* Current Active IDs */}
          <div className="p-3.5 rounded-lg bg-ba-dark border border-ba-border flex flex-col gap-2">
            <span className="text-xs font-semibold text-zinc-200">
              Active Scene Asset Identifiers
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="p-2.5 rounded bg-ba-surface border border-ba-border flex items-center justify-between">
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 block font-mono">Character ID</span>
                  <span className="font-mono font-bold text-ba-cyan truncate block">{characterId}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(characterId);
                    toast.success(`Copied character ID: ${characterId}`);
                  }}
                  aria-label={`Copy character ID ${characterId}`}
                  className="p-2 min-h-[44px] min-w-[44px] rounded hover:bg-ba-cardHover text-slate-300 transition-colors flex items-center justify-center"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-2.5 rounded bg-ba-surface border border-ba-border flex items-center justify-between">
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 block font-mono">Background ID</span>
                  <span className="font-mono font-bold text-ba-cyan truncate block">{backgroundId}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(backgroundId);
                    toast.success(`Copied background ID: ${backgroundId}`);
                  }}
                  aria-label={`Copy background ID ${backgroundId}`}
                  className="p-2 min-h-[44px] min-w-[44px] rounded hover:bg-ba-cardHover text-slate-300 transition-colors flex items-center justify-center"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-2.5 rounded bg-ba-surface border border-ba-border flex items-center justify-between">
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 block font-mono">Emotion Slug</span>
                  <span className="font-mono font-bold text-ba-cyan truncate block">{emotionSlug}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(emotionSlug);
                    toast.success(`Copied emotion slug: ${emotionSlug}`);
                  }}
                  aria-label={`Copy emotion slug ${emotionSlug}`}
                  className="p-2 min-h-[44px] min-w-[44px] rounded hover:bg-ba-cardHover text-slate-300 transition-colors flex items-center justify-center"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* cURL Generation Example */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">Generate Scenario (POST API)</span>
              <button
                type="button"
                onClick={() => {
                  const curlCmd = `curl -X POST https://makedialogbluearchive.vercel.app/api/scenario/generate \\
  -H "Content-Type: application/json" \\
  -d '{
    "character": "${characterId}",
    "emotion": "${emotionSlug}",
    "background": "${backgroundId}",
    "dialogue": "${dialogueContent.replace(/"/g, '\\"')}",
    "x": ${characterX || 0},
    "y": ${characterY || 0},
    "scale": ${characterScale || 1}
  }'`;
                  navigator.clipboard.writeText(curlCmd);
                  toast.success("Copied cURL command!");
                }}
                className="flex items-center gap-1.5 text-xs text-ba-cyan hover:underline p-2 min-h-[44px]"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy cURL</span>
              </button>
            </div>
            <pre className="p-3 rounded bg-ba-dark border border-ba-border font-mono text-[11px] text-slate-300 overflow-x-auto whitespace-pre">
{`curl -X POST https://makedialogbluearchive.vercel.app/api/scenario/generate \\
  -H "Content-Type: application/json" \\
  -d '{
    "character": "${characterId}",
    "emotion": "${emotionSlug}",
    "background": "${backgroundId}",
    "dialogue": "${dialogueContent.slice(0, 45)}...",
    "x": ${characterX || 0},
    "y": ${characterY || 0},
    "scale": ${characterScale || 1}
  }'`}
            </pre>
          </div>

          {/* Adding Multiple Characters (Multi-Student Scenarios) */}
          <div className="p-3.5 rounded-lg bg-ba-dark border border-ba-border flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">Adding Multiple Characters (Multi-Student)</span>
              <button
                type="button"
                onClick={() => {
                  const multiCurl = `curl -X POST https://makedialogbluearchive.vercel.app/api/scenario/generate \\
  -H "Content-Type: application/json" \\
  -d '{
    "background": "${backgroundId}",
    "dialogue": "${dialogueContent.replace(/"/g, '\\"')}",
    "characters": [
      { "id": "Hoshino", "emotion": "smile", "x": -220, "scale": 0.95 },
      { "id": "Shiroko", "emotion": "neutral", "x": 220, "scale": 0.95, "blur": false }
    ],
    "backgroundBlur": true
  }'`;
                  navigator.clipboard.writeText(multiCurl);
                  toast.success("Copied multi-character cURL!");
                }}
                className="flex items-center gap-1.5 text-xs text-ba-cyan hover:underline p-1 min-h-[36px]"
              >
                <Copy className="w-3.5 h-3.5" /> Copy Multi-Char cURL
              </button>
            </div>
            <p className="text-slate-400 text-[11px]">
              Pass multiple students via the <code className="text-ba-cyan">characters</code> array in POST or <code className="text-ba-cyan">char1, char2</code> query parameters in GET:
            </p>
            <pre className="p-2.5 rounded bg-ba-surface border border-ba-border font-mono text-[11px] text-emerald-300 overflow-x-auto whitespace-pre">
{`// 1. JSON POST Payload:
{
  "background": "bg_bg_committeeroom_night",
  "backgroundBlur": true,
  "dialogue": "Uhe~ Sensei, look who joined us today!",
  "characters": [
    { "id": "Hoshino", "emotion": "smile", "x": -240, "scale": 0.95 },
    { "id": "Shiroko", "emotion": "neutral", "x": 240, "scale": 0.95, "blur": false }
  ]
}

// 2. Direct GET URL Query Parameters:
/api/scenario/generate?char1=Hoshino&char2=Shiroko&char1_x=-240&char2_x=240&bgBlur=true`}
            </pre>
          </div>

          {/* Direct Animated GIF Generation Endpoints */}
          <div className="p-3.5 rounded-lg bg-ba-dark border border-ba-border flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">Direct Animated GIF Generation (No Queues)</span>
              <button
                type="button"
                onClick={() => {
                  const gifCurl = `curl -X POST https://makedialogbluearchive.vercel.app/api/scenario/animate \\
  -H "Content-Type: application/json" \\
  -d '{
    "character": "${characterId}",
    "dialogue": "${dialogueContent.replace(/"/g, '\\"')}",
    "speed": "${gifSpeed}"
  }'`;
                  navigator.clipboard.writeText(gifCurl);
                  toast.success("Copied GIF cURL command!");
                }}
                className="flex items-center gap-1.5 text-xs text-fuchsia-400 hover:underline p-1 min-h-[36px]"
              >
                <Copy className="w-3.5 h-3.5" /> Copy GIF cURL
              </button>
            </div>
            <p className="text-slate-400 text-[11px]">
              Generate animated typewriter visual novel GIFs directly via dedicated animation endpoints:
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-300">Method A: Dedicated Animate Endpoint (Returns direct binary GIF):</span>
                <code className="p-2 rounded bg-ba-surface border border-ba-border font-mono text-[11px] text-fuchsia-300 block truncate">
                  {`https://makedialogbluearchive.vercel.app/api/scenario/animate?character=${characterId}&dialogue=${encodeURIComponent(dialogueContent.slice(0, 30))}&speed=${gifSpeed}&format=gif`}
                </code>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-300">Method B: Generate Endpoint with format=gif:</span>
                <code className="p-2 rounded bg-ba-surface border border-ba-border font-mono text-[11px] text-fuchsia-300 block truncate">
                  {`https://makedialogbluearchive.vercel.app/api/scenario/generate?character=${characterId}&format=gif&speed=${gifSpeed}&dialogue=${encodeURIComponent(dialogueContent.slice(0, 30))}`}
                </code>
              </div>
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5">
              Speed options: <span className="text-ba-cyan">speed=slow</span> (relaxed ~3.5s), <span className="text-emerald-300">speed=normal</span> (standard ~2.4s), <span className="text-amber-300">speed=fast</span> (brisk ~1.4s).
            </span>
          </div>

          {/* Direct Binary Image & GIF URLs */}
          <div className="flex flex-col gap-2">
            <span className="font-bold text-slate-200">Direct Scenario Embed URLs (GET)</span>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">PNG Image:</span>
                <button
                  type="button"
                  onClick={() => {
                    const getUrl = `https://makedialogbluearchive.vercel.app/api/scenario/generate?character=${encodeURIComponent(characterId)}&background=${encodeURIComponent(backgroundId)}&emotion=${encodeURIComponent(emotionSlug)}&format=png`;
                    navigator.clipboard.writeText(getUrl);
                    toast.success("Copied PNG URL!");
                  }}
                  className="text-ba-cyan hover:underline flex items-center gap-1 min-h-[44px] p-2"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy PNG URL
                </button>
              </div>
              <code className="p-2.5 rounded bg-ba-dark border border-ba-border font-mono text-[11px] text-emerald-400 block truncate">
                {`https://makedialogbluearchive.vercel.app/api/scenario/generate?character=${characterId}&background=${backgroundId}&emotion=${emotionSlug}&format=png`}
              </code>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Animated GIF ({gifSpeed}):</span>
                <button
                  type="button"
                  onClick={() => {
                    const gifUrl = `https://makedialogbluearchive.vercel.app/api/scenario/generate?character=${encodeURIComponent(characterId)}&background=${encodeURIComponent(backgroundId)}&emotion=${encodeURIComponent(emotionSlug)}&format=gif&speed=${gifSpeed}`;
                    navigator.clipboard.writeText(gifUrl);
                    toast.success("Copied GIF URL!");
                  }}
                  className="text-fuchsia-400 hover:underline flex items-center gap-1 min-h-[44px] p-2"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy GIF URL
                </button>
              </div>
              <code className="p-2.5 rounded bg-ba-dark border border-ba-border font-mono text-[11px] text-fuchsia-300 block truncate">
                {`https://makedialogbluearchive.vercel.app/api/scenario/generate?character=${characterId}&background=${backgroundId}&emotion=${emotionSlug}&format=gif&speed=${gifSpeed}`}
              </code>
            </div>
          </div>

          {/* Asset Discovery Endpoints */}
          <div className="p-3 rounded-lg bg-ba-dark border border-ba-border flex flex-col gap-1.5">
            <span className="font-bold text-slate-200">Asset Discovery Endpoints</span>
            <p className="text-slate-400 text-[11px]">
              Query all 819 students and 830 background scenes programmatically:
            </p>
            <div className="flex flex-col gap-1 font-mono text-[11px]">
              <div className="text-slate-300">
                <span className="text-ba-cyan font-semibold">GET</span> /api/assets?type=character&limit=50
              </div>
              <div className="text-slate-300">
                <span className="text-ba-cyan font-semibold">GET</span> /api/assets?type=background&limit=50
              </div>
              <div className="text-slate-300">
                <span className="text-ba-cyan font-semibold">GET</span> /api/assets/[id]
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-ba-dark border-t border-ba-border flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 min-h-[44px] rounded-lg bg-ba-accent hover:brightness-110 text-white text-xs font-bold transition-colors flex items-center justify-center"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
