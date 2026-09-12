---
name: Update Controller
description: The approved graphite Windows utility for deliberate update control.
colors:
  base: "#141c23"
  surface: "#18232d"
  title: "#203144"
  text: "#edf4fb"
  muted: "#a6b9cc"
  border: "#31404d"
  accent: "#7fc9ff"
  accent-strong: "#1479c7"
  selected: "#213a50"
  positive: "#65dbc1"
  warning: "#f0c780"
  error: "#ffada8"
  button-text: "#102435"
  hover: "#233340"
  track: "#25343f"
  light-base: "#f6f8fb"
  light-surface: "#ffffff"
  light-title: "#e8eff6"
  light-text: "#152331"
  light-muted: "#526579"
  light-border: "#d0dbe6"
  light-accent: "#075e9f"
  light-accent-strong: "#0968ae"
  light-selected: "#e0effb"
  light-positive: "#14735e"
  light-warning: "#855507"
  light-error: "#b52b33"
  light-button-text: "#ffffff"
  light-hover: "#eaf0f6"
  light-track: "#dbe4ed"
typography:
  headline:
    fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif'
    fontSize: "25px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  detail-title:
    fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif'
    fontSize: "27px"
    fontWeight: 600
    lineHeight: 1.22
    letterSpacing: "-0.025em"
  title:
    fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif'
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif'
    fontSize: "14px"
  reading:
    fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif'
    fontSize: "14px"
    lineHeight: 1.75
  label:
    fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif'
    fontSize: "10px"
    fontWeight: 600
    letterSpacing: "0.09em"
rounded:
  checkbox: "3px"
  field: "5px"
  control: "6px"
  dialog: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  wide: "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.button-text}"
    rounded: "{rounded.control}"
    padding: "8px 15px"
  button-outline:
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "8px 15px"
  filter-selected:
    backgroundColor: "{colors.accent-strong}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "7px 14px"
  search:
    backgroundColor: "{colors.base}"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    padding: "8px 10px"
  package-reading:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
  operation-summary:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "20px"
---

# Design System: Update Controller

## Overview

**Creative North Star: "Approved graphite Windows utility"**

The approved graphite Windows utility is the visual authority (docs/frontend-concept.png). This document finalizes its first implementation; it introduces no replacement visual direction. Compact controls, a blue accent, tonal surfaces, and a generous reading pane support deliberate update decisions.

The interface uses restrained Windows typography and monoline Lucide icons with an authored four-pane mark. Its subtle title gradient suggests the approved glass character; the implementation uses opaque CSS tonal layers and retains native Windows decorations.

**Key Characteristics:**

- Graphite surfaces with a restrained blue accent.
- Independent reading and package selection.
- Persistent status and deliberate bottom-bar actions.
- Dark and light themes with compact list-to-detail navigation.

## Colors

Cool graphite neutrals support pale blue controls in dark mode; cool paper surfaces support deeper blue in light mode. Frontmatter captures the actual values from `src/styles.css`. Unprefixed entries map to its CSS variables; `light-` entries replace the corresponding variables under `:root[data-theme="light"]`. Dark is the default, and the theme is persisted in local storage. Automatic system-theme mode is not implemented.

### Primary

- **Control Blue (accent):** primary actions, focus rings, active navigation, reading-row stripe, detail eyebrow, and official-note links.
- **Filter Blue (accent-strong):** selected filter fill and license-checkbox accent; filter text stays white.
- **Reading Blue (selected):** open package, selection count, and operation banner.

### Neutral

- **Graphite / Cool Paper (base):** canvas and recessed search/license fields.
- **Raised Graphite / White (surface):** list, action bar, summary, and dialog.
- **Title Slate / Pale Slate (title):** title-gradient start.
- **Reading Ink (text), Secondary Ink (muted), Divider Slate (border):** hierarchy and thin structural separation.
- **Control Ink (button-text)** supplies primary-button/checkbox contrast; **Hover Slate (hover)** supplies hover fill. **Track Slate (track)** is declared but currently unused.

### Semantic feedback

Positive mint/green marks positive state, amber marks warnings and restart information, and soft/deep red marks errors. Banners mix small percentages of their semantic color with the canvas. Text and icons accompany color.

## Typography

**Display Font:** Segoe UI Variable, Segoe UI, sans-serif.  
**Body Font:** The same Windows stack.  
**Label/Mono Font:** No separate display or monospace family.

Frontmatter records baseline roles. Secondary headings use (20px/1.35, weight 600). Package titles use (15px/1.4, weight 500); metadata and help use (10–13px). Reading text preserves paragraph breaks, wraps long strings, and caps line length at (72ch). The detail eyebrow uses the label role and remains an approved signature. Count badges use tabular numerals.

## Layout

The shell fills (100dvh), has CSS minimum height (500px), and keeps title, status, navigation, actions, and footer outside the scrolling workspace. The Tauri window starts at (1280 × 850px), with minimum dimensions (680 × 560px), retaining native decorations. The in-app brand strip does not replace native window controls.

Above (800px), Updates uses a (43% / 57%) list-to-reader grid with independent scrolling. Baseline chrome: title (44px), control strip minimum (75px), navigation (54px), actions minimum (71px), footer minimum (37px). Chrome has (24–25px) side padding, the reader (30px 36px 25px), and rows minimum height (84px). Settings is centered with maximum width (1040px); both secondary pages scroll within the workspace.

- **At least 1450px:** grid (46% / 54%); title (50px), control minimum (86px), navigation minimum (62px), actions minimum (82px), footer minimum (43px). Chrome side padding (40px); rows minimum (96px). Package title (18px), subtitle (14px), page heading (29px), detail title (32px), reader text (16px), subsection heading (22px). Reader padding (34px 44px). These are the final values after both wide media blocks cascade.
- **At most 1100px:** hide status description/divider, package-side metadata, action hint, and title preview eyebrow. Reader padding (26px), detail title (24px), section headings stack with (4px) gaps.
- **At most 800px:** single-column list-to-detail navigation. Opening a package replaces the list with the reader and a Back to updates button; focus moves to Back and returns to the originating package. Package metadata returns; section headings return to a row; reader top padding (18px). Hide title note, second footer group, and operation secondary text. First footer group retains “Preview only.” Navigation gap (8px), action padding (14px 20px), page padding (26px), control padding (14px 22px).
- **At most 540px:** browser fallback stacks status/actions/settings, makes the check and primary-action buttons full width, hides package metadata/history outcomes, tightens navigation/filter spacing, and reverses stacked dialog actions. Dialog padding (20px). This is below the native window minimum.

Repeated spacing steps are captured in frontmatter; local text/control adjustments are not a rigid uniform scale. The review dialog uses width `min(620px, calc(100vw - 40px))`, maximum height (85dvh), and internal scrolling.

## Elevation & Depth

One-pixel borders and tonal gradients separate resting surfaces without shadows. The review dialog alone uses structural shadow (`0 20px 80px #0005`) and backdrop (`#07121bb3`) with (4px) blur. Title, status, list, and footer gradients use existing theme colors. No acrylic or Mica material is implemented.

## Shapes

Compact softly rounded controls and full filter pills coexist with divider-separated rows. Radius primitives are in frontmatter. Icon buttons use (5px), count badges (20px), category badges (30px), and the four-pane mark (1px). Preserve the open row's left accent stripe (3px) and softly rounded blue background.

## Components

### Buttons

Compact actions have minimum height (36px), (13px) text, and weight (500). Primary uses accent/control ink. Outlined actions use a thin border and an (85%) surface mix. Hover changes fill/border, enabled press uses brightness (0.93), and disabled opacity is (0.46). Icon buttons have minimum size (30px).

Button color/background/border transitions use (140ms ease-out). Buttons, inputs, and summaries have accent keyboard outlines (2px) offset (4px). Reduced motion disables CSS transitions, animation, and smooth scrolling.

### Chips

Filter pills have minimum height (32px) and thin borders. Selected filters use strong blue and white text with exposed pressed state. Category badges are informational; recommended packages are not automatically checked.

### Cards / Containers

Primary information uses bordered panes and divided rows. The existing operation summary uses the surface color, control radius, and (20px) padding. Avoid converting every section into a raised card.

### Inputs / Fields

Search uses a recessed base fill, thin border, field radius, and a leading icon. Package checkboxes are (18px) square, with muted outline and accent/check contrast when checked; disabled opacity is (0.45). Forced-colors mode restores native checkbox appearance and system-color indicators for reading rows, filters, buttons, status dots, and the mark.

### Navigation

Updates, History, and Settings stay horizontal. Inactive text is muted, hover uses surface/text, and active items use accent with a bottom stripe (3px). Theme control sits at the trailing edge.

### Package reader and action bar

Opening a package is independent of checking its selection box. The open row keeps its stripe and the reader keeps its detail eyebrow. The Motion reader transition enters from (4px) below at opacity (0.8), lasting (150ms); reduced motion sets displacement and duration to zero.

The bottom bar reports explicit selection and offers download until all selected packages are downloaded, then review/install. Native HTML modal dialogs show the concrete review and license text before execution; closing restores focus to the invoker or the active navigation button. Separate modal review handles policy changes.

### Status, preview, and feedback

Browser mode uses interactive sample data and cannot operate Windows. It identifies itself in the title when space allows, always in the first footer group, and in operation review. Preview wording can match the approved fictional mock; native status instead uses helper results and “Manual mode configured.” Configuration, verification, conflicts, unavailable status, and pending restarts remain distinct.

The native footer's “No automatic restarts” describes app behavior, not a guarantee about other Windows actors; Settings exposes verification details. Empty, unavailable, error, warning, busy, and completed states use explicit copy and semantic icons.

## Do's and Don'ts

### Do:

- Do preserve the approved reading-row stripe and detail eyebrow.
- Do keep package viewing independent from its checkbox selection.
- Do use semantic color tokens for both themes.
- Do retain visible keyboard focus and reduced-motion behavior.
- Do keep preview labels and distinguish configured policy from verified behavior.

### Don't:

- Don't turn the approved utility into a new visual direction.
- Don't imply that a highlighted row is selected for installation.
- Don't present browser sample data as the actual PC state.
- Don't claim policy effectiveness from configuration alone.
