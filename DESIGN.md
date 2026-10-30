---
name: Bright Path English
description: Friendly, structured English learning for students and families.
colors:
  navy: "#123d68"
  navy-deep: "#092b4c"
  red: "#d91f2a"
  red-deep: "#b9141d"
  ink: "#171717"
  muted: "#667085"
  line: "#e7e9ee"
  paper: "#ffffff"
  surface: "#f3f6fa"
  surface-strong: "#eaf0f6"
typography:
  display:
    fontFamily: "Be Vietnam Pro, Arial, sans-serif"
    fontSize: "clamp(2.5rem, 5vw, 4rem)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Be Vietnam Pro, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "Be Vietnam Pro, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
rounded:
  control: "10px"
  card: "14px"
  feature: "14px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.red}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "50px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "24px"
---

# Design System: Bright Path English

## Overview

**Creative North Star: "The Clear Learning Path"**

Bright Path combines the reassurance of a local education center with the precision of a dependable learning tool. Marketing surfaces may be warm and image-led; working surfaces are quieter, denser and task-first. The interface uses navy for authority, red sparingly for action, generous white space and direct Vietnamese copy.

Public information pages use a split navy introduction: the title owns the main field while supporting copy sits in a darker companion field. Learning and staff workspaces switch to cool-paper surfaces, persistent task navigation, metric strips and quiet list structures so the interface recedes behind the work.

**Key Characteristics:**
- Clear hierarchy before decoration.
- Warm education imagery paired with restrained operational UI.
- Red reserved for primary action, progress and high-value emphasis.
- Consistent controls across public, student and staff surfaces.

## Colors

The palette is anchored by Trust Navy and Action Red, supported by cool neutral surfaces.

**The One Red Rule.** Red identifies the primary action or the most important state; it does not decorate every heading.

## Typography

**Display Font:** Be Vietnam Pro (Arial fallback)  
**Body Font:** Be Vietnam Pro (Arial fallback)

Vietnamese diacritics must remain crisp and comfortable at small sizes. Headings are compact and confident; body copy uses relaxed leading and a readable measure.

**The 11px Floor Rule.** Functional labels, metadata and status text never render below 11px.

## Layout

Public pages use a centered 1200px maximum container with 24px desktop and 14px mobile side gutters. Marketing sections breathe vertically; forms and dashboards use tighter task groups. Internal page introductions use a 65/35 split on desktop and a single reading column on mobile. Staff workspaces use a 272px persistent sidebar on desktop and a two-column task menu on mobile. Multi-column layouts collapse before controls or text become cramped.

## Elevation & Depth

Depth is ambient and scarce. Primary surfaces use `0 16px 42px rgba(17, 43, 68, .07)` without a second outline; dialogs use `0 26px 70px rgba(6, 29, 52, .2)`. Interactive lift is limited to hover-capable pointers.

**The Modal Supremacy Rule.** No animated or elevated surface may create a stacking context that competes with dialogs.

## Shapes

Controls use 10px corners and content surfaces use 14px corners. Large image frames may use the same 14px silhouette; pills are reserved for statuses, account controls and compact filters.

## Components

### Buttons
Primary buttons are red, rectangular and decisive. Secondary buttons are white with a navy border. Every button has visible focus, disabled and loading states and at least a 44px touch target.

### Cards / Containers
Cards group a real task or content unit. Comparable courses, applications, attempts and learning steps use divided rows rather than repeated cards. Metric strips share one outer surface and use internal rules instead of separate floating tiles.

### Inputs / Fields
Inputs have white backgrounds, a cool border and navy focus ring. Placeholder and error text meet WCAG AA.

### Navigation
Desktop navigation is horizontal and restrained. Mobile uses a clear drawer. Authenticated users are represented by an avatar menu; staff areas use a persistent task sidebar.

### Workspace
Staff screens use a navy sidebar, a task-specific page title and subtitle, a system-status indicator, metric strips and white operational panels. Student screens use the same cool-paper ground with a profile header, progress strip and list-based history.

## Do's and Don'ts

### Do:
- **Do** balance headings and use pretty wrapping for paragraphs.
- **Do** distinguish marketing persuasion from task-focused learning screens.
- **Do** preserve clear answer, status and recovery states in exam flows.

### Don't:
- **Don't** place a tracked uppercase kicker above every heading.
- **Don't** stack a rounded icon tile above heading and body as the default card pattern.
- **Don't** fabricate teacher credentials, testimonials, addresses or performance claims.
