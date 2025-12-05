# Visual Design Foundation

*This foundation builds on the Design System Foundation (Step 6) and Ixflare Brand Guidelines to establish comprehensive visual design principles for all touchpoints.*

---

## Color System

**Brand Color Palette (Ixian Identity):**

The Ixflare color system expresses the "forbidden Ixian technology" narrative through precise, sophisticated colors that evoke technical mastery and edge computing's distributed nature.

**Primary Colors:**

1. **Ixflare Blue (#0F62FE)** - Primary brand color
   - **Usage:** Primary actions, links, interactive elements, CLI primary output
   - **Psychology:** Trust, technical precision, edge network connections
   - **Accessibility:** AA compliant on white/light backgrounds, AAA on dark backgrounds
   - **Variations:**
     - 50: #E6F0FF (subtle backgrounds)
     - 100: #B3D4FF (hover states)
     - 500: #0F62FE (primary)
     - 700: #0043CE (pressed states)
     - 900: #002D9C (dark mode accents)

2. **Ixflare Purple (#8B5CF6)** - Secondary brand color
   - **Usage:** Secondary actions, accents, data visualization, gradient pairings
   - **Psychology:** Innovation, sophistication, premium positioning
   - **Accessibility:** AA compliant on white backgrounds with proper contrast adjustments
   - **Variations:**
     - 50: #F3EDFF
     - 100: #E0CFFF
     - 500: #8B5CF6 (secondary)
     - 700: #6D28D9
     - 900: #4C1D95

3. **Ixflare Orange (#FF6B35)** - Accent/emphasis color
   - **Usage:** Highlights, warnings (degraded states), CTAs, energy accents
   - **Psychology:** Energy, urgency, edge location activity
   - **Accessibility:** Use with caution—requires dark text for readability
   - **Variations:**
     - 50: #FFF3ED
     - 100: #FFD9C2
     - 500: #FF6B35 (accent)
     - 700: #E8590C
     - 900: #B83E05

**Neutral Palette:**

Comprehensive grayscale for backgrounds, text, borders, and UI chrome:

- **950 (#0A0A0A):** Darkest background (Edge Telescope, code blocks)
- **900 (#171717):** Primary dark background
- **800 (#262626):** Dark UI elements
- **700 (#404040):** Dark borders, dividers
- **600 (#525252):** Secondary dark text
- **500 (#737373):** Muted text
- **400 (#A3A3A3):** Placeholder text
- **300 (#D4D4D4):** Light borders
- **200 (#E5E5E5):** Light backgrounds
- **100 (#F5F5F5):** Subtle backgrounds
- **50 (#FAFAFA):** Lightest background

**Semantic Colors (Functional UI States):**

- **Success:** #10B981 (Green) - Successful deployments, passing tests, healthy edge locations
- **Warning:** #F59E0B (Amber) - Degraded performance, non-critical issues, cautionary states
- **Error:** #EF4444 (Red) - Failed deployments, errors, unhealthy edge locations
- **Info:** #3B82F6 (Blue) - Informational messages, helpful tips, neutral alerts

**Color Application Strategy:**

**Dark Mode (Primary Theme):**
- Background: Neutral-950 (#0A0A0A) → Neutral-900 (#171717) gradient
- Surface: Neutral-900 with slight elevation
- Text: White (#FFFFFF) for primary, Neutral-300 for secondary
- Borders: Neutral-800 with subtle Ixflare Blue glow on interaction
- **Rationale:** Matches developer preference, reduces eye strain, aligns with terminal/IDE aesthetic

**Light Mode (Secondary Theme):**
- Background: White (#FFFFFF) → Neutral-50 (#FAFAFA)
- Surface: White with subtle shadows
- Text: Neutral-900 for primary, Neutral-600 for secondary
- Borders: Neutral-200 with Ixflare Blue accent on interaction
- **Rationale:** Accessibility for bright environments, presentation/documentation clarity

**Color Usage Rules:**

1. **Ixflare Blue is Primary Interactive Color**
   - All buttons, links, active states use Ixflare Blue
   - Hover states: +5% lightness
   - Pressed states: Blue-700 (#0043CE)

2. **Purple is Secondary/Accent**
   - Used sparingly for differentiation (e.g., secondary nav, special features)
   - Gradient pairings: Blue → Purple for premium features (Edge Telescope, paid tiers)

3. **Orange is Energy/Urgency**
   - Warnings (degraded but not failed states)
   - Real-time activity indicators (requests flowing through edge locations)
   - Call-to-action emphasis (e.g., "Deploy Now" button)

4. **Neutrals are Foundation**
   - 90% of UI is neutral palette
   - Brand colors used intentionally for meaning, not decoration

**Accessibility Compliance:**

- **WCAG 2.1 AA Minimum:** All text meets 4.5:1 contrast ratio
- **WCAG 2.1 AAA Target:** Body text aims for 7:1 contrast ratio
- **Color Blindness:** Never rely on color alone—always pair with icons/text
- **Dark Mode Considerations:** Reduce white text brightness to #F5F5F5 (not pure white) to prevent eye strain

---

## Typography System

**Typeface Selection:**

Ixflare uses a three-font system balancing modern aesthetics, technical precision, and code readability:

**1. Inter (Body Text & UI)**
- **Role:** Primary sans-serif for all body text, UI labels, navigation, forms
- **Weights Used:** 400 (Regular), 500 (Medium), 600 (Semibold), 700 (Bold)
- **Rationale:**
  - Exceptional readability at small sizes (designed for screens)
  - Neutral personality (doesn't compete with content)
  - Wide character set with excellent OpenType features
  - Open source (no licensing concerns)
- **Usage:** Documentation prose, UI labels, button text, form inputs, CLI output (non-code)

**2. Space Grotesk (Display & Headings)**
- **Role:** Display typeface for marketing headlines, hero sections, large headings
- **Weights Used:** 500 (Medium), 600 (Semibold), 700 (Bold)
- **Rationale:**
  - Geometric precision aligns with Ixian brand identity
  - Modern, distinctive personality for differentiation
  - Strong presence at large sizes (landing page headlines)
  - Slightly technical feel without being cold
- **Usage:** H1 headings, hero text, marketing copy, brand moments

**3. JetBrains Mono (Code & Technical)**
- **Role:** Monospace font for all code, technical output, CLI, Edge Telescope traces
- **Weights Used:** 400 (Regular), 500 (Medium), 700 (Bold)
- **Rationale:**
  - Designed specifically for developers by JetBrains
  - Excellent character differentiation (0 vs O, 1 vs l vs I)
  - Ligatures for common programming symbols (=>, !=, >=)
  - Comfortable for extended code reading
- **Usage:** Code blocks, CLI output, Edge Telescope traces, inline code, file paths

**Type Scale (Fluid Typography):**

Responsive type scale using clamp() for fluid sizing across devices:

```css
/* Desktop (1440px+) → Mobile (375px) */
--font-size-xs: clamp(0.75rem, 0.7rem + 0.25vw, 0.75rem);     /* 12px */
--font-size-sm: clamp(0.875rem, 0.8rem + 0.375vw, 0.875rem);  /* 14px */
--font-size-base: clamp(1rem, 0.95rem + 0.25vw, 1rem);        /* 16px */
--font-size-lg: clamp(1.125rem, 1rem + 0.625vw, 1.125rem);    /* 18px */
--font-size-xl: clamp(1.25rem, 1.1rem + 0.75vw, 1.25rem);     /* 20px */
--font-size-2xl: clamp(1.5rem, 1.3rem + 1vw, 1.5rem);         /* 24px */
--font-size-3xl: clamp(1.875rem, 1.5rem + 1.875vw, 1.875rem); /* 30px */
--font-size-4xl: clamp(2.25rem, 1.75rem + 2.5vw, 2.25rem);    /* 36px */
--font-size-5xl: clamp(3rem, 2.25rem + 3.75vw, 3rem);         /* 48px */
```

**Type Hierarchy Application:**

| Element | Font | Size | Weight | Line Height | Usage |
|---------|------|------|--------|-------------|-------|
| H1 Display | Space Grotesk | 5xl (48px) | Bold 700 | 1.1 | Landing page hero |
| H1 Page | Space Grotesk | 4xl (36px) | Semibold 600 | 1.2 | Page titles |
| H2 | Space Grotesk | 3xl (30px) | Semibold 600 | 1.25 | Major sections |
| H3 | Inter | 2xl (24px) | Semibold 600 | 1.3 | Subsections |
| H4 | Inter | xl (20px) | Medium 500 | 1.4 | Minor headings |
| Body Large | Inter | lg (18px) | Regular 400 | 1.6 | Intro paragraphs |
| Body | Inter | base (16px) | Regular 400 | 1.5 | Default body text |
| Body Small | Inter | sm (14px) | Regular 400 | 1.5 | Captions, metadata |
| Code Inline | JetBrains Mono | base (16px) | Regular 400 | 1.5 | Inline code |
| Code Block | JetBrains Mono | sm (14px) | Regular 400 | 1.6 | Code examples |
| UI Label | Inter | sm (14px) | Medium 500 | 1.4 | Form labels, buttons |

**Typography Principles:**

1. **Hierarchy Through Size + Weight**
   - Don't rely on size alone—pair with weight changes
   - H1: Largest + Bold, H2: Large + Semibold, H3: Medium + Semibold

2. **Comfortable Reading Line Length**
   - Body text: 60-80 characters per line (ideal: 66)
   - Wide content: 90 characters max
   - Narrow content (mobile): 45-60 characters

3. **Generous Line Height for Readability**
   - Body text: 1.5-1.6 (24-26px at 16px base)
   - Headings: 1.1-1.3 (tighter for impact)
   - Code blocks: 1.6 (extra space for code readability)

4. **Vertical Rhythm (Baseline Grid)**
   - Base unit: 4px
   - Line heights: Multiples of 4px (20px, 24px, 28px, 32px)
   - Margins: Consistent 4px-based spacing

5. **Font Loading Strategy**
   - Critical: Inter Regular 400, Inter Semibold 600 (inline in head)
   - Deferred: Space Grotesk, JetBrains Mono (load async)
   - Fallback stack: `system-ui, -apple-system, sans-serif` (prevents FOIT)

**Accessibility Considerations:**

- **Minimum Size:** 14px body text (16px preferred)
- **Contrast:** Neutral-900 on White (21:1 ratio) exceeds WCAG AAA
- **User Zoom:** Fluid typography scales gracefully to 200% zoom
- **Dyslexia-Friendly:** Inter's open apertures and generous spacing aid readability

---

## Spacing & Layout Foundation

**Spacing Scale (4px Base Unit):**

Ixflare uses a consistent 4px base unit for all spacing, creating visual rhythm and predictability:

```css
--space-0: 0;
--space-1: 0.25rem;  /* 4px  - Tight spacing, icon gaps */
--space-2: 0.5rem;   /* 8px  - Small gaps, inline elements */
--space-3: 0.75rem;  /* 12px - Button padding, compact UI */
--space-4: 1rem;     /* 16px - Default spacing unit */
--space-5: 1.25rem;  /* 20px - Comfortable spacing */
--space-6: 1.5rem;   /* 24px - Section spacing */
--space-8: 2rem;     /* 32px - Large spacing */
--space-10: 2.5rem;  /* 40px - Very large spacing */
--space-12: 3rem;    /* 48px - Major section breaks */
--space-16: 4rem;    /* 64px - Page-level spacing */
--space-20: 5rem;    /* 80px - Extra large spacing */
--space-24: 6rem;    /* 96px - Hero section spacing */
```

**Spacing Application Rules:**

1. **Micro Spacing (1-3):** Component internals
   - Button padding: space-3 (12px vertical) × space-4 (16px horizontal)
   - Icon gaps: space-2 (8px)
   - Form input padding: space-3 (12px)

2. **Component Spacing (4-6):** Between related elements
   - Label to input: space-2 (8px)
   - Paragraph to paragraph: space-4 (16px)
   - Related components: space-6 (24px)

3. **Section Spacing (8-12):** Between major sections
   - Subsection to subsection: space-8 (32px)
   - Section to section: space-12 (48px)
   - Page-level breaks: space-16 (64px)

4. **Macro Spacing (16-24):** Page structure
   - Hero to content: space-24 (96px)
   - Footer spacing: space-20 (80px)

**Layout Systems:**

**1. Grid System (Documentation Site)**

12-column responsive grid with fluid gutters:

```css
.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 var(--space-6); /* 24px horizontal padding */
}

/* Responsive breakpoints */
@media (max-width: 640px) {  /* Mobile: 4-column grid */
  .grid { grid-template-columns: repeat(4, 1fr); }
}
@media (min-width: 641px) and (max-width: 1024px) { /* Tablet: 8-column */
  .grid { grid-template-columns: repeat(8, 1fr); }
}
@media (min-width: 1025px) { /* Desktop: 12-column */
  .grid { grid-template-columns: repeat(12, 1fr); }
}
```

**2. Content Width Constraints**

- **Narrow (Prose):** 65ch (ideal reading line length)
- **Medium (Forms):** 720px max-width
- **Wide (Documentation):** 1024px max-width
- **Full (Edge Telescope):** 100% viewport width

**3. Vertical Rhythm**

All vertical spacing follows 4px baseline grid:

```css
/* Consistent vertical rhythm */
h1 { margin-top: var(--space-12); margin-bottom: var(--space-6); }
h2 { margin-top: var(--space-10); margin-bottom: var(--space-4); }
h3 { margin-top: var(--space-8); margin-bottom: var(--space-3); }
p  { margin-top: 0; margin-bottom: var(--space-4); }
```

**Layout Principles:**

1. **Airy, Not Cramped**
   - Developer tools benefit from generous whitespace
   - Edge Telescope: Breathing room between traces (space-6 minimum)
   - Documentation: Comfortable reading with space-8 between sections

2. **Geometric Precision**
   - All spacing multiples of 4px (aligns with Ixian identity)
   - Consistent gaps create visual harmony
   - Predictable spacing aids in rapid UI scanning

3. **Responsive Scaling**
   - Mobile: Reduce spacing by 25-50% (space-12 → space-6)
   - Tablet: Standard spacing
   - Desktop: Full spacing, utilize horizontal space

4. **Content Density Adaptation**
   - **Dense (Edge Telescope traces):** Tight spacing (space-2 to space-4) for information density
   - **Standard (Documentation):** Comfortable spacing (space-4 to space-8) for readability
   - **Spacious (Landing page):** Generous spacing (space-12 to space-24) for visual impact

**Component Spacing Examples:**

**Button:**
```css
.button {
  padding: var(--space-3) var(--space-4);  /* 12px vertical, 16px horizontal */
  gap: var(--space-2);  /* 8px between icon and text */
  border-radius: var(--radii-md);  /* 8px */
}
```

**Card:**
```css
.card {
  padding: var(--space-6);  /* 24px internal padding */
  gap: var(--space-4);  /* 16px between card elements */
  margin-bottom: var(--space-6);  /* 24px between cards */
}
```

**Form:**
```css
.form-group {
  margin-bottom: var(--space-6);  /* 24px between form groups */
}

.form-label {
  margin-bottom: var(--space-2);  /* 8px label to input */
}

.form-input {
  padding: var(--space-3);  /* 12px input padding */
}
```

---

## Border Radius & Elevation

**Border Radius Scale:**

```css
--radii-none: 0;
--radii-sm: 0.25rem;  /* 4px  - Small elements (badges, pills) */
--radii-md: 0.5rem;   /* 8px  - Default (buttons, inputs) */
--radii-lg: 0.75rem;  /* 12px - Cards, modals */
--radii-xl: 1rem;     /* 16px - Large containers */
--radii-full: 9999px; /* Fully rounded (avatars, pills) */
```

**Border Radius Application:**
- **Buttons, Inputs:** radii-md (8px) - Friendly but professional
- **Cards, Panels:** radii-lg (12px) - Softer, container feel
- **Modals, Overlays:** radii-xl (16px) - Premium, elevated feel
- **Edge Telescope UI:** radii-md (8px) - Technical precision, not overly soft

**Elevation (Shadow System):**

```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);

/* Dark mode: Add subtle colored glow */
--shadow-dark: 0 0 20px 0 rgb(15 98 254 / 0.15);  /* Ixflare Blue glow */
```

**Elevation Hierarchy:**
- **Level 0 (Flat):** Base background, no shadow
- **Level 1 (Hover):** shadow-sm - Subtle lift on hover
- **Level 2 (Card):** shadow-md - Standard card elevation
- **Level 3 (Modal):** shadow-lg - Overlay floating above page
- **Level 4 (Dropdown):** shadow-xl - Highest elevation

---

## Accessibility Considerations

**Color Contrast:**
- **Body Text:** Minimum 4.5:1 (AA), target 7:1 (AAA)
- **Large Text (18px+):** Minimum 3:1 (AA)
- **UI Components:** Minimum 3:1 for borders, icons, interactive elements
- **Testing:** Use WebAIM Contrast Checker for all color pairings

**Typography Accessibility:**
- **Minimum Font Size:** 14px (prefer 16px for body)
- **Maximum Line Length:** 80 characters (66 ideal)
- **Line Height:** 1.5 minimum for body text
- **Font Weight:** Avoid weights below 400 for small text

**Spacing Accessibility:**
- **Touch Targets:** Minimum 44×44px (iOS) or 48×48px (Android)
- **Button Padding:** Ensure adequate space for finger taps
- **Focus Indicators:** 2px outline with 2px offset (highly visible)

**Motion & Animation:**
- **Respect `prefers-reduced-motion`:** Disable animations for users who request it
- **Essential Motion Only:** Animations should enhance understanding, not distract
- **Duration:** Keep transitions short (150-350ms)

**Focus Management:**
- **Visible Focus Indicators:** 2px Ixflare Blue outline with 2px offset
- **Logical Tab Order:** Follow visual layout (left-to-right, top-to-bottom)
- **Skip Links:** Provide skip-to-main-content for keyboard users

**Screen Reader Support:**
- **Semantic HTML:** Use proper heading hierarchy (H1 → H2 → H3)
- **ARIA Labels:** Provide context for icon-only buttons
- **Alt Text:** Descriptive alternative text for all images
- **Form Labels:** Always associate labels with inputs

**Dark Mode Considerations:**
- **Reduce Pure White:** Use #F5F5F5 instead of #FFFFFF (reduces eye strain)
- **Soften Pure Black:** Use Neutral-950 (#0A0A0A) instead of #000000
- **Test Both Modes:** Ensure contrast ratios meet WCAG in both light and dark modes

---

## Visual Foundation Summary

**Core Design Principles:**

1. **Geometric Precision (Ixian Identity)**
   - 4px base unit for all spacing
   - Consistent border radius (8px standard)
   - Mathematical harmony in type scale

2. **Technical Sophistication**
   - Dark mode first (developer preference)
   - Monospace code font (JetBrains Mono)
   - Blue-purple brand colors (technical + premium)

3. **Developer-Centric Aesthetics**
   - Clean, uncluttered layouts
   - Generous whitespace for focus
   - Code-first presentation

4. **Accessibility Without Compromise**
   - WCAG 2.1 AA minimum (AAA target)
   - Keyboard navigation throughout
   - Screen reader friendly markup

**Application Across Touchpoints:**

| Touchpoint | Color | Typography | Spacing | Notes |
|------------|-------|------------|---------|-------|
| Documentation Site | Dark mode primary, light mode available | Inter body, Space Grotesk headings | Comfortable (space-8 sections) | Readability priority |
| CLI | Ixflare Blue primary output, semantic colors for states | JetBrains Mono exclusively | Tight (space-2 to space-4) | Information density |
| Edge Telescope | Dark mode only, geometric precision | Inter UI, JetBrains Mono traces | Medium-tight (space-4 to space-6) | Balance density and readability |
| IDE Extensions | Match IDE theme (adapt to VS Code, IntelliJ) | Match IDE fonts | Match IDE spacing | Native feel |
| Landing Page | Dark mode hero, brand colors prominent | Space Grotesk display, Inter body | Spacious (space-16 to space-24) | Visual impact |

**Design Tokens Implementation:**

All values documented here are available via the `@ixflare/design-tokens` package, ensuring consistency across all implementations. Design system changes propagate automatically to all touchpoints.

**Next Steps:**

With this visual foundation established, we can now create specific design directions and UI patterns that express these foundations across different contexts and use cases.
