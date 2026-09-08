# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Next.js (App Router, React, TypeScript, Tailwind CSS, PixiJS)

## Users
- Developers and AI Agent builders integrating Blue Archive dialogue/scenario visual generation into bots, roleplay systems (e.g. OpenRP, Discord bots), and storytelling apps.
- Blue Archive community creators and fans who want an intuitive, fast, modern web studio to configure, preview, and generate high-fidelity scenario stills (PNG) and animated sequences (GIF) directly in their browser.

## Product Purpose
Deliver an API-first, deterministic Scenario Image Generator and Chat Renderer based on the battle-tested PixiJS engine from `ba-tools`. It converts scenario parameters or natural-language prompts into authentic visual novel stills and animated GIFs without queues, delays, or artificial concurrency limits, while enabling direct Markdown embed integration (`![](URL)`) for AI chat responses.

## Positioning
Unlike generic AI image generators or queue-bound slow services, this engine is a deterministic, instant PixiJS compositor providing 1:1 fidelity with the official Blue Archive game visuals and Joe's original scenario generator, complete with an all-inclusive asset catalog, zero queues, direct multi-agent pipeline, and direct chat image behavior.

## Operating Context
- Web UI: Modern dark studio interface with real-time scenario canvas preview, live parameter inspector, full asset library browser, direct PNG and GIF generation triggers.
- AI Chat / API: Programmatic callers sending HTTP requests (`POST /api/scenario/generate`, `POST /api/scenario/animate`) receiving immediate rendered images with markdown formatting (`![](URL)`) for chat streaming.
- Standalone / Local / Cloud Deployment: Fully self-contained Next.js service with static asset delivery and direct rendering.

## Capabilities and Constraints
- Direct execution without any queue, job worker, semaphore, or artificial concurrency limit.
- Deterministic PixiJS rendering preserving original asset placement, dialogue box, affiliations, characters, backgrounds, fonts, and elements.
- Image generation (PNG) and animation generation (GIF frames encoding).
- ChatImageBehavior emitting `![](URL)` format for instant markdown rendering in chat interfaces.
- Asset Library with comprehensive listing of characters, backgrounds, overlays, elements, and effects, supporting local assets, Google Drive sources, direct upload, and remote URLs.
- Multi-agent orchestration (Planner, Asset Matcher, Composition, Animation, QA, Orchestrator).
- All documentation, UI text, API schemas, and asset lists presented entirely in English.

## Brand Commitments
- Full attribution and preservation of original MIT license from `jozsefsallai/ba-tools`.
- Authentic Blue Archive visual style (dialogue frames, school emblems, nameplates, typography).

## Evidence on Hand
- Original open-source repository: `https://github.com/jozsefsallai/ba-tools`
- Specification and architecture blueprint: `scenario-image-generator-api-prompt.txt`
- Live reference site: `https://ba.joexyz.online/scenario-image-generator`
- Google Drive asset repository folders:
  - Source 1: `https://drive.google.com/drive/u/0/mobile/folders/1lZSWYJAQ_jHVsxksC21zyL0g8YoqmYwm`
  - Source 2: `https://drive.google.com/drive/u/0/mobile/folders/1--5Y77wXkWR1PGpe8BIVwk8SdhCuNiDQ`

## Product Principles
1. Preserve Original Engine Authenticity: Never reinvent or fake the renderer; adapt the exact PixiJS compositor and parameters from `ba-tools`.
2. Direct Synchronous Execution: No queuing, no artificial limits, return immediate results or clear errors.
3. Chat-Native First: Images and GIFs must be directly consumable by LLMs and chat renderers via Markdown `![](URL)`.
4. Total Asset Transparency: Provide complete, un-truncated visibility over all characters, backgrounds, and elements.
5. Impeccable Craft: Clean modern dark studio interface, responsive, intuitive, and distraction-free.

## Accessibility & Inclusion
- High-contrast dark theme adhering to WCAG AA for text and UI controls.
- Keyboard-navigable asset browser and controls with aria-labels.
