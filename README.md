<div align="center">

<img src="assets/logo.svg" alt="OmniSync Data Studio Logo" width="84" height="84" />

# OmniSync Data Studio

### Universal Structured Data Converter, Real-Time Synchronizer & Schema Diagnostic Workbench

[![Zero External Dependencies](https://img.shields.io/badge/dependencies-0%20external-brightgreen.svg?style=flat-square)](package.json)
[![WCAG AAA Accessibility](https://img.shields.io/badge/accessibility-WCAG%20AAA-blue.svg?style=flat-square)](https://www.w3.org/WAI/standards-guidelines/wcag/)
[![Automated Tests](https://img.shields.io/badge/tests-73%2F73%20passed-success.svg?style=flat-square)](tests/)
[![MIT License](https://img.shields.io/badge/license-MIT-purple.svg?style=flat-square)](LICENSE)
[![Platform Native](https://img.shields.io/badge/platform-browser%20%7C%20node.js-orange.svg?style=flat-square)](https://nodejs.org)

*A 100% browser-native, zero-dependency, bidirectional structured data converter and real-time synchronizer for **JSON**, **YAML**, **CSV**, **XML**, and **TOML**.*

[Live Demo](#getting-started) • [Key Features](#core-features-f01f30) • [Architecture](#canonical-ir-architecture) • [UI/UX Highlights](#uiux-highlights) • [Testing Guide](#automated-testing--verification) • [Author & Attribution](#author--academic-attribution)

---

</div>

## Overview

**OmniSync Data Studio** is a client-side engineering workbench engineered for developers, data engineers, and cloud architects. It provides seamless, instantaneous bidirectional synchronization and conversion across five fundamental data serialization formats:
- **JSON** (JavaScript Object Notation — RFC 8259)
- **YAML** (YAML Ain't Markup Language — 1.2 Core Subset)
- **CSV** (Comma-Separated Values — RFC 4180 with hierarchical dot-notation)
- **XML** (Extensible Markup Language — W3C DOM with BadgerFish IR convention)
- **TOML** (Tom's Obvious Minimal Language — v1.0.0)

Built entirely with standard Web APIs (DOM, Canvas, Web Storage, Clipboard, DataTransfer) and pure vanilla JavaScript, OmniSync requires **zero build steps, zero bundling, and zero `node_modules`**. It runs immediately when opening `index.html` in any browser, keeping your sensitive data 100% local, secure, and private.

---

## Canonical IR Architecture

Instead of implementing $O(N^2)$ point-to-point converters ($5 \times 4 = 20$ direct translators), OmniSync implements a **Hub-and-Spoke Architecture** centered around a universal **Canonical Intermediate Representation (IR)**. This reduces converter complexity to $2N$ ($10$ total translators: $5$ parsers and $5$ serializers), guaranteeing cyclic transitivity ($A \to B \to C \to A$) and semantic equivalence.

```
                  ┌──────────────────────┐
                  │    Canonical IR      │
                  │   Value Graph        │
                  │ (Scalars, Maps, Arr) │
                  └──────────┬───────────┘
                             │
       ┌──────────────┬──────┴───────┬──────────────┐
       │              │              │              │
┌──────▼──────┐┌──────▼──────┐┌──────▼──────┐┌──────▼──────┐
│ JSON Parser ││ YAML Parser ││ CSV Parser  ││ XML Parser  │
│ & Serializer││ & Serializer││ & Serializer││ & Serializer│
└─────────────┘└─────────────┘└─────────────┘└─────────────┘
                             │
                       ┌─────▼────────┐
                       │ TOML Parser  │
                       │ & Serializer │
                       └──────────────┘
```

### Core Engine Pipeline:
1. **Parsers & Serializers Layer** (`js/parsers/`):
   - **JSON**: Native high-speed parsing with custom token coordinate scanner providing exact 1-based line/column numbers.
   - **YAML**: Pure JS subset engine supporting scalars, mappings, block sequences, inline lists, comments, multiline pipes (`|`), and protection against the Norway problem (`no`/`yes`).
   - **CSV**: RFC 4180 parser with auto-delimiter detection (comma, semicolon, tab, pipe), quote escaping, and automatic dot-notation flattening/unflattening (`address.city`).
   - **XML**: BadgerFish DOM mapping preserving element hierarchies, XML attributes (`@attr`), text nodes (`#text`), CDATA payloads, and synthetic root wrapping.
   - **TOML**: Parser/serializer handling section tables, nested tables, array-of-tables (`[[table]]`), dotted keys, and typed primitives.
2. **Sync & Coordination Layer** (`js/engine/`):
   - **Canonical IR Normalizer** (`js/engine/ir.js`): Sanitizes types, normalizes numeric keys, and guarantees deterministic deep equality.
   - **Bidirectional Sync State Machine** (`js/engine/sync.js`): Coordinates Left $\leftrightarrow$ Right data flow, manages 250ms keystroke debounce, enforces `isSyncing` locks to prevent infinite loops, and isolates syntax errors without overwriting valid data.
   - **Tree Diff & RFC 6902 Patch Engine** (`js/engine/diff.js`): Computes structural differences between panes and produces valid JSON Patch arrays (`add`, `remove`, `replace`).
   - **Diagnostic Error Locator** (`js/engine/validator.js`): Calculates exact 1-based line/column coordinates and generates visual 3-line caret (`^`) code frames.

---

## Core Features (F01–F30)

| ID | Feature Name | Description | Status |
|:---|:---|:---|:---:|
| **F01** | **JSON Bidirectional Engine** | RFC 8259 parser/serializer with line/column coordinates and 2-space/compact/tab indentation | Passed |
| **F02** | **YAML Bidirectional Engine** | Pure JS parser/emitter supporting scalars, maps, lists, multiline blocks, and comments | Passed |
| **F03** | **CSV Bidirectional Engine** | RFC 4180 parser/emitter with auto-delimiter detection and dot-notation flattening | Passed |
| **F04** | **XML Bidirectional Engine** | BadgerFish IR mapping preserving attributes (`@`), text nodes, CDATA, and synthetic roots | Passed |
| **F05** | **TOML Bidirectional Engine** | Full TOML v1.0.0 support for tables, array of tables, dotted keys, and typed values | Passed |
| **F06** | **Canonical IR Value Graph** | Single intermediate representation guaranteeing transitive equivalence ($A \to B \to A$) | Passed |
| **F07** | **Bidirectional Sync State Machine** | 250ms debounced keystroke sync, active-pane tracking, and loop prevention locks | Passed |
| **F08** | **Diagnostic Error Locator** | Exact 1-based line and column extraction with visual 3-line caret (`^`) code frames | Passed |
| **F09** | **RFC 6902 Diff Visualizer** | Real-time tree diffing generating RFC 6902 JSON Patch arrays with card and raw views | Passed |
| **F10** | **Dual-Pane Split Workbench** | Side-by-side desktop layout and responsive mobile tabbed switcher with line gutters | Passed |
| **F11** | **OLED Dark & Crisp Light Themes** | WCAG AAA contrast ratio (>7:1) with OLED black (`#0F172A`) and Crisp light (`#FFFFFF`) | Passed |
| **F12** | **Live Status & Latency Badges** | Real-time status indicators (Synced, Converting, Error, Validating) with millisecond latency | Passed |
| **F13** | **Clickable Diagnostic Banner** | Interactive error notification with direct "Jump to Error" cursor positioning | Passed |
| **F14** | **Quick Clipboard Copy** | Instant copy button with checkmark visual state transition and toast notifications | Passed |
| **F15** | **Soft-Clear & Undo Snackbar** | Non-destructive reset with 5-second countdown progress bar and <kbd>Ctrl+Z</kbd> undo | Passed |
| **F16** | **Verified MIME-Type Export** | One-click file download with standard MIME types (`application/json`, `text/yaml`, etc.) | Passed |
| **F17** | **Drag-and-Drop File Import** | Full drag-and-drop dropzone overlay for importing `.json`, `.yaml`, `.csv`, `.xml`, `.toml` | Passed |
| **F18** | **Format Swapping & Hotkeys** | Instant conversion direction inversion (<kbd>Alt+S</kbd>) and full keyboard navigation | Passed |
| **F19** | **Built-in Real-World Presets** | 4 preloaded datasets: IoT Sensor Fleet, Users Table, Cloud Infra, University Catalog | Passed |
| **F20** | **Synchronized Scrolling** | Proportional scroll synchronization toggle across left and right editor panes | Passed |
| **F21** | **Zero-Dependency Architecture** | 100% browser-native static site; no Node modules, npm build, or CDN required | Passed |
| **F22** | **Open-Source Repository** | Complete documentation, MIT license, contributing guidelines, and CI workflows | Passed |
| **F23** | **Browser GitHub Upload Script** | In-browser uploader script using `DataTransfer` and `webkitRelativePath` | Passed |
| **F24** | **Project Packager Bundler** | Node.js bundler script packaging the entire workspace for browser upload | Passed |
| **F25** | **Dual Test Harness** | Headless Node.js test runner (`runner.js`) and in-browser interactive dashboard (`test.html`) | Passed |
| **F26** | **Tier 1 Isolated Feature Tests** | 30 test cases covering isolated syntax and format features across all 5 formats | Passed |
| **F27** | **Tier 2 Boundary & Edge Cases** | 30 boundary cases covering Unicode, BOM, ragged CSV, deep nesting, and error anchors | Passed |
| **F28** | **Tier 3 Pairwise Round-Trip Tests**| 8 cross-format round-trip tests verifying cyclic fidelity across all format pairs | Passed |
| **F29** | **Tier 4 Real-World Workloads** | 5 production-grade workflows (REST API, IoT Telemetry, E-Commerce, Kubernetes, HCMUT) | Passed |
| **F30** | **Milestone 2 Verification Suite**| 20 automated tests validating DOM structure, WCAG AAA compliance, and UX interactions | Passed |

---

## UI/UX Highlights

- **Dual-Pane Responsive Layout**: Clean horizontal split on desktop with independent line numbering gutters; fluid tabbed switcher on mobile screens (< 768px).
- **Dark OLED & Crisp Light Themes**: Handcrafted color system built for extended engineering sessions. Passes WCAG AAA accessibility requirements with contrast ratios exceeding 7:1.
- **Diagnostic Caret Banner**: When a syntax error occurs, a diagnostic alert appears showing the exact error message, line/column coordinate, and an ASCII code frame with a caret indicator (`^`). Clicking **"Jump to Error"** smoothly scrolls the editor and places the cursor directly at the error token.
- **5-Second Soft-Clear Undo Snackbar**: Clearing content is non-destructive. A non-blocking toast displays a 5-second animated progress bar and allows instant restoration via button or <kbd>Ctrl+Z</kbd>.
- **RFC 6902 Diff Inspection Modal**: Click the **Diff** badge in the header to view a granular tree diff between source and target datasets. Filter operations by `Added (+)` , `Removed (-)`, or `Modified (~)`, or switch between card view and raw JSON patch format.
- **Keyboard Shortcuts Dialog**: Press <kbd>?</kbd> or <kbd>F1</kbd> to inspect the global shortcut matrix.

### Keyboard Shortcuts Reference

| Shortcut | Action | Scope |
|:---|:---|:---|
| <kbd>Ctrl</kbd> + <kbd>Enter</kbd> | Force Immediate Manual Synchronization | Global |
| <kbd>Alt</kbd> + <kbd>S</kbd> | Swap Conversion Direction (Left $\leftrightarrow$ Right) | Global |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>C</kbd> | Copy Converted Output to Clipboard | Global |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd> | Format / Prettify Active Editor Content | Global |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | Undo Soft-Clear (while snackbar is visible) | Global |
| <kbd>Escape</kbd> | Dismiss Active Modals, Popups, and Error Banners | Global |
| <kbd>?</kbd> or <kbd>F1</kbd> | Open Keyboard Shortcuts Cheat Sheet | Global |

---

## Getting Started

Because OmniSync Data Studio has zero build steps and zero dependencies, setup takes under 5 seconds.

### Method 1: Direct File Execution (Recommended)
1. Clone or download the repository:
   ```bash
   git clone https://github.com/nguyenminhtriet25052008-hub/omnisync-studio.git
   cd omnisync-studio
   ```
2. Double-click **`index.html`** or open it in any modern browser (Google Chrome, Microsoft Edge, Mozilla Firefox, Apple Safari).
3. Start converting and synchronizing immediately!

### Method 2: Local HTTP Server (Optional)
If you prefer running through a local web server:
```bash
# Using Python 3
python -m http.server 8000

# Or using Node.js npx
npx serve .
```
Then navigate to `http://localhost:8000` in your browser.

---

## Automated Testing & Verification

OmniSync includes a comprehensive automated test infrastructure that runs both headlessly in Node.js and interactively in web browsers.

### 1. Headless CLI Test Runner
Run the 4-tier universal test suite from your terminal (Node.js 18+ required, 0 npm dependencies):

```bash
# Run all 73 E2E test cases
node tests/runner.js

# Run a specific tier
node tests/runner.js --tier=1    # Tier 1: Feature Coverage (30 tests)
node tests/runner.js --tier=2    # Tier 2: Boundary & Edge Cases (30 tests)
node tests/runner.js --tier=3    # Tier 3: Pairwise Round-Trip Fidelity (8 tests)
node tests/runner.js --tier=4    # Tier 4: Real-World Workloads (5 tests)

# Filter tests by keyword
node tests/runner.js --filter="Unicode"
```

### 2. Milestone 2 UI & Interaction Verification Suite
Run the automated DOM structure and interaction verification suite:

```bash
node tests/m2_verification.js
```
*Validates 20 assertions covering DOM structure, WCAG AAA compliance, coordinate math, jump-to-line scrolling, soft clear undo, and runtime exception immunity.*

### 3. Milestone 3 Packaging Verification Suite
Run the automated repository packaging and upload verification suite:

```bash
node tests/m3_verification.js
```

### 4. In-Browser Interactive Test Dashboard
Open **`tests/test.html`** in your browser. The dashboard automatically runs the entire test matrix, displaying execution times, progress bars, and granular pass/fail metrics.

---

## Repository Structure

```
omnisync-studio/
├── index.html                     # Main workbench application entry point
├── css/
│   ├── style.css                  # Design tokens, themes, layouts, animations
│   └── syntax.css                 # Gutter styles, diagnostics, and code frames
├── js/
│   ├── app.js                     # Application controller and keyboard wiring
│   ├── ui.js                      # UI presentation, toasts, modals, and undo
│   ├── engine/
│   │   ├── ir.js                  # Canonical Intermediate Representation normalizer
│   │   ├── sync.js                # Bidirectional synchronization state machine
│   │   ├── diff.js                # Tree diff & RFC 6902 patch generator
│   │   └── validator.js           # Line/column locator and schema validator
│   └── parsers/
│       ├── json.js                # JSON parser & serializer with token locator
│       ├── yaml.js                # Pure JS YAML parser & emitter
│       ├── csv.js                 # RFC 4180 CSV parser & emitter with flattening
│       ├── xml.js                 # XML BadgerFish parser & serializer
│       └── toml.js                # TOML table & array-of-tables parser/serializer
├── assets/
│   ├── logo.svg                   # Vector brand logo
│   └── icons.svg                  # SVG symbol sprite sheet
├── tests/
│   ├── runner.js                  # Headless Node.js CLI test runner
│   ├── test.html                  # In-browser interactive test harness
│   ├── test_suites.js             # Universal isomorphic test suites (Tiers 1-4)
│   ├── m1_verification.js         # Milestone 1 core engine verification
│   ├── m2_verification.js         # Milestone 2 DOM & interaction test suite
│   └── m3_verification.js         # Milestone 3 packaging & upload verification
├── .github/
│   └── workflows/
│       └── ci.yml                 # Automated GitHub Actions test workflow
├── package.json                   # Project metadata and test scripts (0 deps)
├── .gitignore                     # Standard clean ignore patterns
├── README.md                      # Comprehensive project guide and documentation
├── CONTRIBUTING.md                # Contribution guidelines and architecture tenets
├── CHANGELOG.md                   # v1.0.0 release notes
└── LICENSE                        # MIT License
```

---

## Author & Academic Attribution

**OmniSync Data Studio** was conceived, architected, and engineered by:

**Nguyễn Minh Triết**  
*Faculty of Electrical & Electronic Engineering (Khoa Điện - Điện tử)*  
*Ho Chi Minh City University of Technology (HCMUT — Trường Đại học Bách Khoa TP.HCM)*  
- **GitHub Profile**: [@nguyenminhtriet25052008-hub](https://github.com/nguyenminhtriet25052008-hub)  
- **Repository**: [nguyenminhtriet25052008-hub/omnisync-studio](https://github.com/nguyenminhtriet25052008-hub/omnisync-studio)  

### Dedication
*Dedicated to the pursuit of human-centered software engineering, accessible interface design, and resilient, zero-dependency computing.*

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for complete details.

Copyright (c) 2026 **Nguyễn Minh Triết**. All rights reserved.
