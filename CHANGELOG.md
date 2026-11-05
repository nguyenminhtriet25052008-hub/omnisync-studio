# Changelog

All notable changes to **OmniSync Data Studio** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-05

### Added
- **Canonical IR Value Graph Architecture**: Hub-and-spoke $2N$ transformation engine guaranteeing transitive equivalence across JSON, YAML, CSV, XML, and TOML.
- **Universal Parsers & Serializers Layer**:
  - Native JSON parser with 1-based line/column diagnostic coordinates.
  - Pure JS YAML 1.2 subset parser/emitter with Norway problem immunity.
  - RFC 4180 CSV engine with auto-delimiter detection and dot-notation flattening.
  - W3C XML BadgerFish IR engine with attribute preservation and CDATA handling.
  - TOML v1.0.0 parser/serializer supporting section tables and array of tables.
- **Bidirectional Synchronization State Machine**:
  - Keystroke synchronization with 250ms debouncing.
  - `isSyncing` locks preventing recursive conversion feedback loops.
  - Non-destructive syntax error containment preserving valid data.
- **UI/UX Presentation Layer (`ui-ux-pro-max`)**:
  - Dark OLED (`#0F172A`) and Crisp Light (`#FFFFFF`) themes with WCAG AAA contrast (>7:1).
  - Responsive split workbench on desktop and fluid tabbed switcher on mobile.
  - Diagnostic error banner with visual 3-line caret (`^`) code frame and "Jump to Error" cursor navigation.
  - Non-destructive soft-clear with 5-second countdown progress bar and <kbd>Ctrl+Z</kbd> undo.
  - Direction swap (<kbd>Alt+S</kbd>) and proportional synchronized scrolling toggle.
  - File drag-and-drop overlay and verified MIME type file export.
  - 4 production-grade sample presets (IoT Telemetry, Users Table, Cloud Infra, HCMUT Catalog).
  - RFC 6902 Diff Visualizer modal with filter tabs (All, Added, Removed, Modified), structured card view, and raw JSON patch export.
  - Global accessible keyboard shortcuts modal (<kbd>?</kbd> or <kbd>F1</kbd>).
- **Automated QA & Test Infrastructure**:
  - Headless Node.js CLI runner (`tests/runner.js`) with tier filtering (`--tier=1..4`).
  - Interactive browser test harness (`tests/test.html`).
  - 73/73 universal test cases passed across Tiers 1–4.
  - 20/20 Milestone 2 DOM, WCAG AAA, and UX interaction tests passed (`tests/m2_verification.js`).
- **Repository Packaging & Metadata**:
  - Zero-dependency `package.json` with npm test scripts.
  - Clean `.gitignore` and GitHub Actions CI matrix across Node.js 18, 20, and 22.
  - MIT License and comprehensive documentation honoring Lead Architect **Nguyễn Minh Triết** (HCMUT).
