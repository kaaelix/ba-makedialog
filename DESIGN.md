# Design System: Blue Archive Scenario Studio

## Visual Identity & World
The design language takes inspiration from Blue Archive's Kivotos tactical terminal UI, combined with modern studio design craft:
- Deep obsidian backdrop (`#0b1219`) representing nighttime command consoles
- Translucent navy slate cards (`#121d27`, `#15212e`) with fine 1px structural borders (`#1e2e3d`)
- Distinctive Kivotos cyan (`#7accf9`) and electric blue (`#208bfe`) as primary focal and active indicators
- Warm gold and crimson badges for school affiliations and priority tags

## Typography & Hierarchy
- **Primary Display Font**: Noto Sans Bold (700) for dialogue character names (57pt) with `#2b435b` stroke outline.
- **Affiliation Label**: Noto Sans Bold (700) with `#7accf9` text fill and `#2b435b` stroke outline (41pt).
- **Dialogue Body**: Noto Sans Regular (400) at 41pt with line height 1.4x and word-wrap at 1548px width.
- **Multilingual Support**: GyeonggiTitle for Korean typography, Shin Maru Go (ShinMGoUpr) for Japanese typography.
- **Interface UI Font**: System sans-serif stack (Inter / SF Pro / Roboto) with clean tabular numerals.

## Spatial System & Coordinates
- **Canvas Resolution**: Fixed deterministic 1920x1080 (16:9 aspect ratio).
- **Text Anchor Margins**: Dialogue area centered at `X = 186` (`(1920 - 1548) / 2`).
- **Divider Line**: `Y = 844`, width `1548px`, height `3px`, opacity `0.5`.
- **Character Base**: Centered horizontally at `X = 960` with anchor `(0.5, 0)` and base `Y = 50`.
- **Bottom Gradient Banner**: Height `410px` from `Y = 670` to `Y = 1080`.
- **Interactive Spacing**: 8pt grid with 12px/16px/24px component padding.

## Components & Affordances
- **Scenario Canvas**: Real-time WebGL PixiJS canvas with responsive container wrapper.
- **Asset Browser**: Grid cards with 4:3 image previews, school tag pill, student name, and one-click scene placement.
- **Generation Toolbar**: Tactile action buttons with visual loading feedback ("Preparing...", "Rendering...", "Finalizing...").
- **Chat Markdown Embed**: Dedicated copy button outputting `![](URL)` format ready for direct chat paste.

## Accessibility
- WCAG AA compliant contrast ratio (minimum 4.5:1) for all interactive text and controls.
- Keyboard accessible navigation and aria-labels for all asset browser tiles.
