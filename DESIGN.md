---
name: Barbería
description: Fluorescent cinema listing for the day’s chair — hour, title, room, box office.
colors:
  ink: "#141820"
  milk: "#f7f9fc"
  vermillion: "#c41230"
  lobby: "#eef1f6"
  paper: "#ffffff"
  wash: "#dce3eb"
  steel: "#4d5666"
  rail: "#c5ceda"
  forest: "#1b6b45"
  amber: "#b86a10"
  sidebar-mist: "#e8edf3"
  sidebar-seam: "#2a3140"
typography:
  display:
    fontFamily: "Barlow Condensed, Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 4vw, 2.25rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "0.025em"
  headline:
    fontFamily: "Barlow Condensed, Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0.025em"
  title:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Barlow Condensed, Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.12em"
rounded:
  sm: "2px"
  md: "3px"
  lg: "5px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  "2xl": "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.milk}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
    typography: "{typography.title}"
  button-primary-hover:
    backgroundColor: "#12161d"
    textColor: "{colors.milk}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
  button-accent:
    backgroundColor: "{colors.vermillion}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
    typography: "{typography.title}"
  button-accent-hover:
    backgroundColor: "#b0102b"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
  button-ghost-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.milk}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
  badge-listing:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.milk}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
    typography: "{typography.label}"
  badge-now:
    backgroundColor: "{colors.vermillion}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
    typography: "{typography.label}"
  listing-sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "16px"
  input-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "4px 12px"
    height: "36px"
    typography: "{typography.body}"
  nav-active:
    backgroundColor: "{colors.vermillion}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "8px"
    height: "32px"
  row-live:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.milk}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
  box-office-production:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.milk}"
    rounded: "{rounded.sm}"
    padding: "20px 16px"
    typography: "{typography.display}"
  box-office-cash:
    backgroundColor: "{colors.vermillion}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "20px 16px"
    typography: "{typography.display}"
---

# Design System: Barbería

## Overview

**Creative North Star: "Cartelera de silla"**

The product reads like a cinema listing under fluorescent lobby light, not like a SaaS dashboard. The operator scans today’s program as hour, name, service, and room on a white sheet; the live session inverts to ink; box office pits production against cash as opposing panes. Vermillion is reserved for Now and for the action that writes the next turn.

The world is cool, high-key, and slightly industrial: lobby fluorescent behind paper sheets, near-square plates, condensed numerals for time and money. Density is listing density — tight rows, generous section gaps — so the day of the chair is scannable on a phone at the station. Confirmed visual rejections: the previous cream + charcoal + gold + Inter look, generic equal-tile KPI grids, and luxury barbershop tropes.

**Key Characteristics:**
- Fluorescent lobby field with white listing sheets and ink type
- Barlow for names and copy; Barlow Condensed for mastheads, hours, money, and column heads
- Vermillion only for Now, primary action, focus, and selection
- Live row and hover invert to ink on milk
- Near-square plates (2px on sheets and controls; 3px CSS radius token)
- Hairline rail + 1px ink-tinted sheet shadow; no hard offset blocks

## Colors

Cool fluorescent paper with a single hot accent. Structure is ink; urgency is vermillion; status greens and ambers stay semantic and quiet.

### Primary
- **Ink** (`ink`): Default buttons, live listing row, sidebar field, chart ink, and inverted hover. The structural dark of the lobby, not a luxury charcoal.
- **Milk** (`milk`): Type and icons on ink. Slightly cooler than pure white so inverted rows stay fluorescent, not chalky.

### Secondary
- **Vermillion** (`vermillion`): Now (in-progress), primary CTAs (Nuevo turno, Ingresar, Canjear), focus ring, caret, text selection, sidebar active item, box-office cash pane, destructive. Rarity is the point.

### Tertiary
- **Forest** (`forest`): Completed, paid, success amounts (discounts). Never a page wash.
- **Amber** (`amber`): Warning, pending payment, overbooking cue. Never a decorative gold.

### Neutral
- **Lobby** (`lobby`): App canvas. The fluorescent field behind every sheet.
- **Paper** (`paper`): Listing sheets, cards, inputs, popovers, sticky staff header.
- **Wash** (`wash`): Secondary fills, muted chips, skeleton pulse, calendar column heads.
- **Steel** (`steel`): Secondary type, placeholders, listing meta.
- **Rail** (`rail`): Borders, input strokes, sheet edges.
- **Sidebar Mist** (`sidebar-mist`): Type on the ink sidebar.
- **Sidebar Seam** (`sidebar-seam`): Sidebar hairline dividers.

`.dark` tokens exist as a mapped inversion in CSS. The shipped product is the light lobby; do not treat dark as the identity.

### Named Rules
**The Vermillion Privilege Rule.** Vermillion marks Now, the one action that advances the day, focus, and selection. It is not a wash, not a left stripe, not a decorative icon tint.

**The Invert-to-Ink Rule.** A live session, a hovered listing row, and a highlighted menu item invert the whole surface to ink on milk. Do not signal “active” with a colored bar or a soft badge alone.

## Typography

**Display Font:** Barlow Condensed (fallback Barlow, then ui-sans-serif)
**Body Font:** Barlow (fallback ui-sans-serif, system-ui)
**Label/Mono Font:** Barlow Condensed with `tabular-nums` for time, money, and dates — not a monospace costume

**Character:** Condensed display is the marquee; Barlow is the spoken name. The pairing is industrial and scannable, never editorial serif and never Inter.

Loaded weights: Barlow 400 / 400 italic / 500 / 600 / 700; Condensed 500 / 600 / 700. Mastheads and listings use 600.

### Hierarchy
- **Display** (600, `clamp(1.875rem, 4vw, 2.25rem)`, tracking 0.025em, uppercase): Org masthead, login wordmark, portal greeting, box-office amounts. Condensed.
- **Headline** (600, 1.125rem, tracking 0.025em, uppercase): Section titles (`Cartelera de hoy`, `Resumen del turno`). Condensed.
- **Title** (600, 1rem): Client names, card titles, default button type. Barlow.
- **Body** (400, 0.875rem / 1rem on mobile inputs): Running copy, form labels (`text-sm font-medium`), service lines. Barlow. Keep measure short on empty states (`max-w-sm`).
- **Label** (600, 11px / 10px on badges, uppercase, tracking 0.08em–0.12em, tabular nums): Column heads (HORA / CLIENTE / SERVICIO / SALA), box-office pane labels, status chips, listing times.

### Named Rules
**The Condensed Listing Rule.** Hours, money, dates, and column heads use Barlow Condensed with tabular numbers. Names and sentences stay in Barlow. Do not add a third family.

**The Masthead Speaks Rule.** The page title is Condensed, semibold, uppercase. It does not sit under a kicker or eyebrow; the heading carries its own weight.

## Layout

Staff chrome is an inset ink sidebar (16rem expanded, 3rem icon) plus a sticky 56px paper header. Main padding steps 16 / 24 / 32 (`p-4` / `md:p-6` / `lg:p-8`). Page blocks stack with 32px (`space-y-8`). Mastheads and page headers share a bottom rail and 16px padding beneath the title row.

Listings are the spatial unit: a paper sheet with 1px rail, divided rows, a 12px column gutter, and a 3.5rem time column. Compact rows are ~14px vertical padding; default appointment sheets use 16px. Mobile collapses the four-column head and shows five upcoming rows; desktop shows eight and the Sala column.

Portal is a single fluorescent column, `max-w-2xl`, with an ink masthead. Auth sheets are `max-w-md` paper plates on lobby. Time-slot grids are 3 / 4 / 5 columns. Filter bars are a sheet that becomes 2 then 4 columns. The mobile breakpoint used by chrome and listings is 768px.

### Named Rules
**The Cartelera Rule.** Today’s program is a divided listing (time | name | service | room), not a grid of equal metric tiles. Box office is one opposing strip under the listing, not four hero numbers.

## Elevation & Depth

Surfaces are tonal: lobby behind paper, paper behind type. Depth is a 1px rail plus a hairline sheet shadow. Hover does not lift; it inverts. Dialogs take a larger shadow because they interrupt; listings and cards do not.

### Shadow Vocabulary
- **Sheet** (`box-shadow: 0 1px 2px rgb(20 24 32 / 0.06)`): `.listing-sheet` and default cards. Always with a 1px rail.
- **Control** (`shadow-xs` on outline buttons, inputs, selects): Barely there stroke companion, not lift.
- **Dialog** (`shadow-lg`): Modal interruption only.

### Named Rules
**The Sheet Rule.** Resting surfaces are flat paper on lobby. No hard offset block shadows, no glass, no colored halo. Invert or change fill for state; do not raise the plate.

## Shapes

Plates are near-square. Sheets, default buttons, badges, inputs, empty states, and listing rows use 2px (`rounded-sm`). The CSS `--radius` token is 3px (`rounded-md`) and appears on some compact/large button sizes. Do not round product surfaces past ~5px. Checkmarks on selected services are the only full-circle control. Dividers are 1px rails, never a thick accent edge.

### Named Rules
**The Plate Rule.** If it is a sheet, a row, a button, or a chip, it is a 2–3px plate. Soft 12px cards and pill chrome belong to the discarded Inter/shadcn look.

## Components

### Buttons
- **Shape:** Near-square plate (2px default; 3px on `sm`/`lg`/`xs` sizes). Height 36px default; 32px small; 40px large. Padding 8×16. Type: 14px semibold Barlow. Disabled at 40% opacity. Focus: 3px vermillion ring at 50%.
- **Primary (ink):** Structural confirm. Hover darkens ink slightly.
- **Accent (vermillion):** The day’s action — Nuevo turno, Ingresar, Canjear. One per viewport when possible.
- **Outline:** Paper fill, rail stroke, hairline shadow. Hover inverts to ink on milk.
- **Ghost:** No fill at rest. Hover inverts to ink on milk (same invert language as listing rows).
- **Link:** Ink underline on hover; used for “Facturación del mes”, not as a fake button.
- **Destructive:** Vermillion fill (same pigment as accent). Prefer accent for constructive CTAs; destructive for irreversible fills.

### Chips
- **Style:** Condensed 10px uppercase, tracking 0.08em, 2px plate, 2×6 padding.
- **Status:** Pending = wash; confirmed = ink; in progress = vermillion; completed/paid = forest; cancelled = muted strike; no-show = vermillion tint + stroke; payment pending = amber.
- **On invert:** Chips on a hovered or live row flip to paper so they survive the ink field.

### Cards / Containers
- **Corner Style:** 2px plate
- **Background:** Paper on lobby
- **Shadow Strategy:** Sheet shadow + 1px rail (Elevation)
- **Border:** Rail
- **Internal Padding:** 16px on people/expense/reward sheets; 24px on default `Card`; 20px on appointment summary; listing rows tighter (12×10)
- **Empty state:** Centered sheet, ink 40px glyph plate, Condensed uppercase title, Barlow caption, accent action

### Inputs / Fields
- **Style:** Paper fill, rail stroke, 2px plate, 36px height, Barlow. Placeholder in steel. Mobile type 16px to avoid iOS zoom; 14px from `md`.
- **Focus:** Vermillion border + 3px vermillion ring at 50%.
- **Error:** Vermillion border and ring; error copy in vermillion, 14px.
- **Disabled:** 40% opacity.
- **Select / menu highlight:** Ink invert, milk type (same as listing hover).

### Navigation
- **Staff sidebar:** Ink field, mist type, vermillion 32px plates for the org mark and the active item. Inactive hover is white at 8% opacity, not a wash of vermillion. Group labels are small caps. Footer identity sits on a seam, not a card.
- **Staff header:** Sticky paper bar, 56px, bottom rail, Condensed org name.
- **Auth / portal masthead:** Full-bleed ink band. Org or product name in Condensed uppercase. Portal signed-in bar is 56px; login/portal-entry bands are taller (py-8) with the vermillion scissors plate.

### Listing row (signature)
Compact cartelera row: tabular Condensed time in a ~3.5rem column, Barlow name, steel service and room, status chip. The in-progress row is ink on milk at rest (not only on hover). Hover on other rows inverts the whole row, including nested ghost/outline buttons (they go paper-on-ink).

### Box-office bar (signature)
One sheet, two opposing panes: production on ink, cash on vermillion, Condensed uppercase labels at 11px / 0.14em, amounts at display size with tabular nums. A steel listing line under the strip carries pending and today’s count. Never split this into four metric tiles.

### Time slots
11px-min plates, 2px radius, 1px rail. Available = paper + invert hover; selected = ink fill; occupied = wash + strike; blocked = faded wash; conflict/overbooking = amber tint. Grid 3/4/5.

## Do's and Don'ts

### Do:
- **Do** set the canvas to lobby and put content on paper sheets with a 1px rail.
- **Do** set live and hover rows to full ink invert, not a tint or a side stripe.
- **Do** put the day’s action on the vermillion accent button (Nuevo turno, Ingresar).
- **Do** set hours, money, and column heads in Barlow Condensed with tabular numbers.
- **Do** keep mastheads Condensed, semibold, uppercase, with the date or caption in listing type beside or below — not as a kicker above.
- **Do** theme selection, caret, and focus from vermillion; scrollbars from steel on wash.

### Don't:
- **Don't** rebuild a page as four equal metric tiles (the discarded Resumen).
- **Don't** use cream, gold, Inter, or soft 12px shadcn cards — that identity is retired.
- **Don't** wash a screen in vermillion or use it as a left/right accent bar.
- **Don't** add a kicker or eyebrow above a heading.
- **Don't** use hard offset block shadows or glass/blur decoration.
- **Don't** introduce a third type family or monospace as a “technical” costume.
- **Don't** treat `.dark` as the product world; the lobby is fluorescent and light.
