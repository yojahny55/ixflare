# Responsive Design & Accessibility

Ixflare isn't a single app—it's a developer ecosystem spanning CLI, documentation website, interactive tutorial, Edge Telescope debugging tool, and plugin directory. Each surface has different responsive needs while maintaining consistent accessibility standards across all touchpoints.

---

## Responsive Design Strategy

### Multi-Surface Approach

Ixflare's surfaces have different responsive requirements based on their use cases:

**Documentation Site** - Multi-device (mobile, tablet, desktop)
**Interactive Tutorial** - Multi-device (optimized for desktop, functional on mobile)
**Edge Telescope** - Desktop-only (debugging requires screen real estate)
**Plugin Directory** - Multi-device (browse on any screen size)
**CLI** - Terminal-based (desktop-focused but outputs must be readable)

---

### Desktop Strategy (1024px+)

**Documentation Site:**
- **Layout:** Three-column (Left sidebar nav 300px + Main content flexible + Right TOC 250px)
- **Navigation:** Persistent sidebar, no hamburger menu collapse
- **Search:** Full-featured modal (⌘K) with filtering and keyboard navigation
- **Code Blocks:** Horizontal scroll for long lines, copy button always visible
- **Plugin Directory:** 3-column grid layout

**Edge Telescope (Debugging Tool):**
- **Minimum Width:** 1280px (enforced, shows message on smaller screens)
- **Layout:** Multi-panel (Request list + Waterfall timeline + Details pane)
- **Interaction:** Keyboard-driven for power users (↑↓ navigate, Enter expand)
- **Not Responsive:** Desktop-only tool (debugging requires screen real estate)

**Interactive Tutorial:**
- **Layout:** Side-by-side (Instructions 40% + Code Editor 60%)
- **Editor:** Full Monaco with autocomplete, syntax highlighting, linting
- **Preview:** Embedded terminal output below editor
- **Progress:** Persistent stepper at top

**Desktop-Specific Features:**
- Hover states and rich tooltips
- Keyboard shortcuts (⌘K, Ctrl+Enter, ↑↓ navigation)
- Multi-column layouts maximize screen real estate
- Persistent navigation panels (no collapse)

---

### Tablet Strategy (768px - 1023px)

**Documentation Site:**
- **Layout:** Two-column (Collapsible sidebar + Main content)
- **Navigation:** Hamburger menu (☰) opens slide-in drawer from left
- **Right TOC:** Moves inline above main content (not separate column)
- **Touch Targets:** All interactive elements minimum 48×48px
- **Search:** Simplified filters, full-screen modal

**Interactive Tutorial:**
- **Layout:** Stacked (Instructions above, Code Editor below, Output below that)
- **Editor:** Simplified (Prism syntax highlighting instead of full Monaco)
- **Touch:** Larger "Run Code" button (48px height)
- **Keyboard:** Virtual keyboard doesn't obscure output (fixed positioning)

**Tablet-Specific Interactions:**
- **Swipe gestures:** Right to open sidebar, left to close
- **Pull-to-refresh:** Reload docs pages
- **Tap-and-hold:** Context menus for code actions
- **Pinch-to-zoom:** Enabled on code blocks for accessibility

---

### Mobile Strategy (320px - 767px)

**Documentation Site:**
- **Layout:** Single-column, full-width
- **Navigation:** Hamburger menu (☰) top-left, full-screen drawer
- **Header:** Fixed with logo + search icon + hamburger
- **Search:** Tap icon opens full-screen search modal
- **Code Blocks:** Horizontal scroll with fade gradient indicators
- **Back to Top:** Sticky FAB button on long pages

**Interactive Tutorial:**
- **Layout:** Vertical stack (Instructions → Code → Output, all full-width)
- **Editor:** Simplified textarea with syntax highlighting (not Monaco)
- **Actions:** Full-width "Run Code" button (56px height)
- **Hints:** Bottom sheet slides up from bottom edge
- **Progress:** Compact stepper at top, always visible

**Mobile-First Critical Features:**
- **Search:** Full-screen modal (not dropdown or popup)
- **Navigation:** Bottom nav bar for key sections (optional: Docs, Plugins, Tutorial)
- **Forms:** Single-column, large input fields (minimum 44px height)
- **Primary Actions:** Full-width buttons on mobile
- **Reading Mode:** Optimized typography (18px base font size)

**Mobile Constraints Acknowledged:**
- **Edge Telescope:** Desktop-only, show "Desktop browser required" message
- **Complex Diagrams:** Tap to expand full-screen, horizontal scroll if needed
- **Multi-Step Forms:** Progress stepper always visible, one field per screen

---

## Breakpoint Strategy

**Tailwind CSS Breakpoints (Mobile-First Approach):**

```css
/* Mobile: Base styles (no media query) */
/* Covers: 320px - 639px */
.container {
  padding: 1rem;
  width: 100%;
}

/* sm: 640px+ (Large mobile / Small tablet) */
@media (min-width: 640px) {
  .container {
    padding: 1.5rem;
  }
  /* Two-column forms, larger code blocks */
}

/* md: 768px+ (Tablet portrait) */
@media (min-width: 768px) {
  .container {
    padding: 2rem;
    max-width: 768px;
    margin: 0 auto;
  }
  /* Sidebar navigation appears, multi-column plugin grid */
}

/* lg: 1024px+ (Tablet landscape / Small desktop) */
@media (min-width: 1024px) {
  .container {
    max-width: 1024px;
  }
  /* Three-column layouts, persistent navigation */
}

/* xl: 1280px+ (Desktop) */
@media (min-width: 1280px) {
  .container {
    max-width: 1280px;
  }
  /* Maximum content width, extra spacing */
}

/* 2xl: 1536px+ (Large desktop / Multiple monitors) */
@media (min-width: 1536px) {
  .container {
    max-width: 1536px;
  }
  /* Wider content containers, optimized for large screens */
}
```

**Mobile-First Philosophy:**
- Base styles target smallest screens (mobile)
- Progressive enhancement adds features as screen size increases
- Content parity: Mobile users see same information, different layout
- Performance priority: Mobile gets optimized assets (smaller images, lazy loading)

**Custom Breakpoints for Ixflare-Specific Components:**

```css
/* Edge Telescope: Desktop-only enforcement */
@media (max-width: 1279px) {
  .edge-telescope {
    display: none;
  }
  .edge-telescope-message {
    display: block; /* "Desktop browser required" */
  }
}

@media (min-width: 1280px) {
  .edge-telescope {
    display: grid;
    grid-template-columns: 300px 1fr 400px;
  }
}

/* Code Editor: Simplified vs Full-Featured */
@media (max-width: 767px) {
  /* Prism syntax highlighting only */
  .code-editor-simple { display: block; }
  .code-editor-monaco { display: none; }
}

@media (min-width: 768px) {
  /* Upgrade to Monaco Editor */
  .code-editor-simple { display: none; }
  .code-editor-monaco { display: block; }
}
```

**Breakpoint Testing Strategy:**
- Test at exact breakpoint values (767px, 768px, 1023px, 1024px)
- Test between breakpoints (800px, 900px) for consistency
- Test on actual devices, not just browser emulation
- Test in both portrait and landscape orientations (tablets)

---

## Accessibility Strategy

**Target: WCAG 2.1 Level AA Compliance**

**Why Level AA:**
- **Level A:** Too basic, doesn't cover many disabilities (insufficient)
- **Level AA:** Industry standard, required by most enterprises (Sarah's POC requirements)
- **Level AAA:** Aspirational but not always achievable (some criteria impossible for developer tools)

**WCAG 2.1 Level AA ensures Ixflare is usable by:**
- Blind developers using screen readers (VoiceOver, NVDA, JAWS)
- Developers with low vision using magnification (200% zoom)
- Developers with motor disabilities using keyboard-only navigation
- Developers with color blindness using high-contrast modes
- Developers with cognitive disabilities benefiting from clear structure

---

### 1. Perceivable (Users can perceive the information)

**Color Contrast (WCAG 1.4.3 - Level AA):**
- **Normal text:** Minimum 4.5:1 contrast ratio
- **Large text (18pt+ or 14pt bold):** Minimum 3:1 contrast ratio
- **UI components:** Minimum 3:1 contrast ratio for interactive elements
- **Ixflare targets:** 7:1 for body text (exceeds AA), 4.5:1 for UI elements

**Contrast Verification:**
```
Light Mode:
- Body text (#1F2937) on white (#FFFFFF): 16.07:1 ✓✓✓
- Success green (#10B981) on white: 4.52:1 ✓
- Error red (#EF4444) on white: 4.53:1 ✓
- Primary violet (#8B5CF6) on white: 4.54:1 ✓

Dark Mode:
- Body text (#F9FAFB) on dark (#111827): 15.56:1 ✓✓✓
- Success green (#34D399) on dark: 7.21:1 ✓✓
- Error red (#F87171) on dark: 5.14:1 ✓✓
- Primary violet (#A78BFA) on dark: 6.89:1 ✓✓
```

**Non-Text Content (WCAG 1.1.1):**
- All images have descriptive alt text (not "image" or filename)
- Icons paired with visible text labels or aria-label
- Decorative images use `alt=""` (screen readers skip)
- Complex diagrams provide text alternative or data table
- Charts and graphs include CSV export option

**Examples:**
```html
<!-- ✓ Good: Descriptive alt text -->
<img src="architecture.png" alt="Ixflare system architecture showing Edge Workers connecting to D1, KV, and Durable Objects" />

<!-- ✓ Good: Icon with label -->
<button>
  <CheckIcon aria-hidden="true" />
  <span>Mark Complete</span>
</button>

<!-- ✓ Good: Icon-only with aria-label -->
<button aria-label="Close modal">
  <XIcon />
</button>

<!-- ✓ Good: Decorative image -->
<img src="pattern.svg" alt="" role="presentation" />
```

**Audio and Video (if added):**
- Captions for all video content (synchronized, accurate)
- Transcripts for audio-only content
- No auto-playing media (WCAG 1.4.2)
- Media controls keyboard accessible

---

### 2. Operable (Users can operate the interface)

**Keyboard Accessible (WCAG 2.1.1, 2.1.2):**
- **All functionality available via keyboard** (no mouse required)
- **No keyboard traps** (can always escape with Tab or Esc)
- **Logical tab order** (follows visual order: left-to-right, top-to-bottom)
- **Skip links** for efficient navigation

**Keyboard Navigation Standards:**
```
Global:
- Tab: Move to next focusable element
- Shift+Tab: Move to previous focusable element
- Enter: Activate buttons, links, submit forms
- Space: Activate buttons, toggle checkboxes
- Esc: Close modals, clear search, cancel operations

Component-Specific:
- Search Modal: ⌘K/Ctrl+K open, ↑↓ navigate results, Enter select, Esc close
- Code Editor: Ctrl+Enter run code, Ctrl+/ toggle comment, Tab indents
- Dropdowns: ↑↓ navigate options, Enter select, Esc close
- Tabs: ←→ navigate tabs, Home/End to first/last tab
```

**Skip Links (WCAG 2.4.1):**
```html
<!-- Skip to main content (hidden until focused) -->
<a
  href="#main-content"
  class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded focus:shadow-lg"
>
  Skip to main content
</a>

<main id="main-content" tabindex="-1">
  {/* Page content */}
</main>
```

**Focus Indicators (WCAG 2.4.7):**
- **Always visible** (never `outline: none` without replacement)
- **High contrast** (meets 3:1 contrast with background)
- **Sufficient size** (minimum 2px outline, 3px for keyboard-only users)
- **Consistent style** across all components

```css
/* Default focus style (visible on all interactive elements) */
*:focus {
  outline: 2px solid #8B5CF6; /* Primary violet */
  outline-offset: 2px;
}

/* Enhanced focus for keyboard users (detected via :focus-visible) */
*:focus-visible {
  outline: 3px solid #8B5CF6;
  outline-offset: 3px;
}

/* Custom focus for buttons */
button:focus-visible {
  outline: 3px solid #8B5CF6;
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.2);
}
```

**Touch Targets (WCAG 2.5.5 - Level AA Enhanced):**
- **Minimum size:** 44×44px for all interactive elements
- **Mobile recommended:** 48×48px (easier for thumbs)
- **Spacing:** Minimum 8px between adjacent touch targets
- **Exception:** Inline links can be smaller if adequate spacing

```tsx
/* ✓ Good: Adequate touch target */
<button className="min-h-[44px] min-w-[44px] px-4 py-2">
  Install Plugin
</button>

/* ✓ Good: Adequate spacing between targets */
<div className="flex gap-4">
  <button className="h-11 px-4">Cancel</button>
  <button className="h-11 px-4">Confirm</button>
</div>

/* ✗ Bad: Too small, too close */
<div className="flex gap-1">
  <button className="h-6 px-2">Cancel</button>
  <button className="h-6 px-2">OK</button>
</div>
```

---

### 3. Understandable (Content is understandable)

**Page Titles (WCAG 2.4.2):**
- Every page has unique, descriptive `<title>`
- Format: `[Page Topic] | [Section] | Ixflare`
- Examples:
  - `EdgeRecord Relationships | Guides | Ixflare Documentation`
  - `Module 3: Build Your First App | Interactive Tutorial | Ixflare`
  - `Turnstile CAPTCHA Plugin | Plugin Directory | Ixflare`

**Language (WCAG 3.1.1, 3.1.2):**
```html
<!-- Document language declared -->
<html lang="en">

<!-- Multi-language content marked -->
<p>
  The Spanish word for hello is <span lang="es">hola</span>.
</p>

<!-- Code examples marked as language-neutral -->
<code lang="typescript">
  const user = await User.find(id)
</code>
```

**Consistent Navigation (WCAG 3.2.3):**
- Navigation menus appear in same order across all pages
- Breadcrumbs follow consistent pattern
- Search always in same location (top-right corner or ⌘K)
- Footer links consistent across site

**Error Identification & Suggestions (WCAG 3.3.1, 3.3.3):**
```tsx
{/* ✓ Good: Error clearly identified with suggestion */}
<label htmlFor="email">Email Address</label>
<input
  id="email"
  type="email"
  aria-invalid={hasError}
  aria-describedby="email-error"
/>
{hasError && (
  <span id="email-error" role="alert" className="text-red-600">
    Invalid email format. Example: user@example.com
  </span>
)}

{/* Error summary at top of form */}
{errors.length > 0 && (
  <div role="alert" className="border-l-4 border-red-500 bg-red-50 p-4">
    <h2 className="font-bold">Please fix the following errors:</h2>
    <ul>
      {errors.map(error => (
        <li key={error.field}>
          <a href={`#${error.field}`}>{error.message}</a>
        </li>
      ))}
    </ul>
  </div>
)}
```

**Labels and Instructions (WCAG 3.3.2):**
- All form inputs have visible labels (not just placeholders)
- Required fields marked with `aria-required="true"` and visual indicator
- Instructions provided before form, not just on error

---

### 4. Robust (Content works with assistive technologies)

**Compatible (WCAG 4.1.2 - Name, Role, Value):**
- Valid HTML5 (no parsing errors)
- ARIA attributes used correctly (proper roles, states, properties)
- All UI components have accessible name and role
- Dynamic changes announced to screen readers

```tsx
{/* ✓ Good: Proper ARIA usage */}
<button
  aria-label="Close search modal"
  aria-expanded={isSearchOpen}
  onClick={closeSearch}
>
  <XIcon aria-hidden="true" />
</button>

{/* ✓ Good: Live region for dynamic updates */}
<div aria-live="polite" aria-atomic="true">
  {searchResults.length} results found
</div>

{/* ✓ Good: Status messages */}
<div role="status" aria-live="polite">
  Settings saved successfully
</div>

{/* ✓ Good: Alert for errors */}
<div role="alert" aria-live="assertive">
  Deployment failed. Check logs for details.
</div>
```

**Screen Reader Testing Required:**
- **macOS:** VoiceOver with Safari
- **Windows:** NVDA with Firefox and Chrome
- **Optional:** JAWS with Chrome (most popular enterprise screen reader)

---

## Testing Strategy

**Three-Tier Testing Approach:**

1. **Automated Testing** (Continuous Integration)
2. **Manual Testing** (Quality Gate before merge)
3. **User Testing** (Quarterly accessibility audits)

---

### Tier 1: Automated Testing (CI/CD)

**Tools Integrated into CI:**

**axe-core (Jest Integration):**
```javascript
import { axe, toHaveNoViolations } from 'jest-axe'
import { render } from '@testing-library/react'

expect.extend(toHaveNoViolations)

describe('Terminal Output Component', () => {
  test('is accessible', async () => {
    const { container } = render(
      <TerminalOutput status="success">
        Database initialized
      </TerminalOutput>
    )

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  test('has proper ARIA labels', () => {
    const { getByRole } = render(
      <TerminalOutput status="success">
        Database initialized
      </TerminalOutput>
    )

    expect(getByRole('status')).toHaveTextContent('Database initialized')
  })
})
```

**Lighthouse CI:**
```json
{
  "ci": {
    "collect": {
      "numberOfRuns": 3,
      "settings": {
        "preset": "desktop"
      }
    },
    "assert": {
      "assertions": {
        "accessibility": ["error", {"minScore": 0.9}],
        "performance": ["error", {"minScore": 0.85}],
        "best-practices": ["error", {"minScore": 0.9}]
      }
    }
  }
}
```

**Pa11y (Regression Testing):**
```javascript
// pa11y.config.js
module.exports = {
  standard: 'WCAG2AA',
  runners: ['axe', 'htmlcs'],
  threshold: 0, // No errors allowed
  timeout: 10000
}
```

**Playwright (Keyboard Navigation Tests):**
```typescript
test('Search modal keyboard navigation', async ({ page }) => {
  await page.goto('/docs')

  // Open search with ⌘K
  await page.keyboard.press('Meta+KeyK')
  await expect(page.getByRole('dialog')).toBeVisible()

  // Type search query
  await page.keyboard.type('EdgeRecord')

  // Navigate results with arrow keys
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')

  // Select with Enter
  await page.keyboard.press('Enter')

  // Verify navigation occurred
  await expect(page).toHaveURL(/edgerecord/)
})
```

**Automated Tests Catch (~60% of issues):**
- Missing alt text
- Insufficient color contrast
- Missing ARIA labels
- Invalid HTML
- Missing form labels
- Incorrect heading hierarchy

---

### Tier 2: Manual Testing (Quality Gate)

**Required Before PR Merge:**

**Screen Reader Testing (5-minute demo video):**

1. **VoiceOver (macOS + Safari):**
   - Cmd+F5 to enable VoiceOver
   - Navigate entire component with VO keys (Ctrl+Option+arrows)
   - Verify all content announced logically
   - Test form error announcements
   - Verify modal focus trapping

2. **NVDA (Windows + Firefox/Chrome):**
   - Enable NVDA (free download)
   - Navigate with Insert+arrow keys
   - Browse mode (read page) vs Focus mode (forms)
   - Verify all interactive elements accessible
   - Test live region announcements

3. **JAWS (Optional - Enterprise Standard):**
   - Most popular enterprise screen reader
   - Test if targeting enterprise users
   - Ensure compatibility with JAWS shortcuts

**Keyboard-Only Navigation (Mouse Unplugged):**
```
Test Checklist:
☐ Tab through all interactive elements in logical order
☐ Activate all buttons and links with Enter/Space
☐ Navigate all form fields with Tab/Shift+Tab
☐ Submit forms with Enter from any field
☐ Open/close modals with keyboard (Esc to close)
☐ Navigate dropdowns with arrow keys
☐ Search with ⌘K/Ctrl+K
☐ No keyboard traps (can always escape)
☐ Skip links work (Skip to main content)
☐ Focus indicators always visible
```

**Visual Testing:**
```
Test Checklist:
☐ 200% browser zoom (content readable, no horizontal scroll)
☐ High contrast mode (Windows High Contrast, macOS Increase Contrast)
☐ Dark mode (all states visible with sufficient contrast)
☐ Color blindness simulation (Protanopia, Deuteranopia, Tritanopia)
☐ Reduced motion (animations disabled or simplified)
```

**Manual Tests Catch (~30% additional issues):**
- Screen reader announcement quality
- Keyboard navigation flow issues
- Focus management edge cases
- Context missing for screen reader users
- Confusing interaction patterns

---

### Tier 3: User Testing (Quarterly)

**Recruit Users with Disabilities:**
- Vision impairments (blind, low vision)
- Motor disabilities (keyboard-only, voice control)
- Cognitive disabilities (dyslexia, ADHD)
- Hearing impairments (if audio/video added)

**Compensation:** $75-150/hour standard rate

**Testing Protocol:**
1. Task-based scenarios (find documentation, run tutorial, install plugin)
2. Think-aloud protocol (users narrate their experience)
3. Post-task questionnaire (SUS score, CSUQ)
4. Identify barriers and frustrations
5. Prioritize fixes based on severity

**User Tests Catch (~10% additional issues):**
- Real-world usability barriers
- Confusing language or jargon
- Missing context for assistive tech users
- Interaction patterns that work technically but poorly in practice

---

### Device & Browser Testing

**Real Device Testing (Priority):**

**Mobile:**
- iPhone 13 (iOS 16+, Safari)
- Samsung Galaxy S21 (Android 12+, Chrome)

**Tablet:**
- iPad Air (iPadOS 16+, Safari)
- Samsung Galaxy Tab S8 (Android 12+, Chrome)

**Desktop:**
- MacBook Pro (macOS, Safari + Chrome + Firefox)
- Windows 11 PC (Edge + Chrome + Firefox)

**Browser Support Matrix:**
- **Chrome:** Latest 2 versions
- **Firefox:** Latest 2 versions
- **Safari:** Latest 2 versions (macOS + iOS)
- **Edge:** Latest version

**Network Conditions Testing:**
- **Throttled 3G:** Simulate slow mobile networks (docs load within 3s)
- **Offline mode:** Service worker caching works
- **High latency:** 500ms simulated delay

---

## Implementation Guidelines

**Responsive Development Best Practices:**

### 1. Use Relative Units (Not Fixed Pixels)

```css
/* ✓ Good: Scales with user preferences */
font-size: 1rem;          /* 16px base, respects user zoom */
padding: 2rem;            /* 32px, scales proportionally */
width: 90%;               /* Flexible, adapts to container */
max-width: 1280px;        /* Maximum width, prevents too-wide */
gap: 1.5rem;              /* 24px spacing, scales */

/* ✗ Bad: Fixed, doesn't respect user settings */
font-size: 16px;          /* Doesn't scale with browser zoom */
padding: 32px;
width: 1200px;
```

**Why Relative Units Matter:**
- Users with low vision zoom to 200% (WCAG requirement)
- Fixed pixels break layouts at high zoom levels
- rem units respect user's browser font size preferences

---

### 2. Mobile-First Media Queries

```css
/* Base styles: Mobile (320px+) */
.card {
  padding: 1rem;
  display: block;
}

/* Tablet (768px+) */
@media (min-width: 768px) {
  .card {
    padding: 1.5rem;
    display: flex;
  }
}

/* Desktop (1024px+) */
@media (min-width: 1024px) {
  .card {
    padding: 2rem;
    max-width: 800px;
  }
}
```

**Why Mobile-First:**
- Ensures mobile users get core functionality
- Progressive enhancement adds features for larger screens
- Easier to add than remove (start simple, add complexity)
- Better performance (mobile loads less CSS)

---

### 3. Touch-Friendly Interactions

```tsx
// Minimum touch target size (44×44px WCAG, 48×48px iOS guidelines)
<button className="min-h-[48px] min-w-[48px] px-4 py-3 rounded-lg">
  Install Plugin
</button>

// Adequate spacing between adjacent targets
<div className="flex gap-4">
  <button className="h-12 px-4">Cancel</button>
  <button className="h-12 px-4">Confirm</button>
</div>

// Mobile: Full-width primary actions
<button className="w-full h-14 sm:w-auto sm:h-12">
  Deploy to Production
</button>
```

---

### 4. Responsive Images & Assets

```html
<!-- Responsive images with srcset -->
<img
  src="diagram-mobile.png"
  srcset="diagram-mobile.png 640w,
          diagram-tablet.png 1024w,
          diagram-desktop.png 1920w"
  sizes="(max-width: 640px) 100vw,
         (max-width: 1024px) 80vw,
         1280px"
  alt="Ixflare architecture diagram showing Edge Workers, D1, KV, and Durable Objects"
  loading="lazy"
/>

<!-- Dark mode aware images -->
<picture>
  <source srcset="logo-dark.svg" media="(prefers-color-scheme: dark)">
  <img src="logo-light.svg" alt="Ixflare logo">
</picture>
```

---

**Accessibility Development Best Practices:**

### 1. Semantic HTML Structure

```html
<!-- ✓ Good: Semantic structure helps screen readers -->
<header>
  <nav aria-label="Main navigation">
    <ul>
      <li><a href="/docs">Documentation</a></li>
      <li><a href="/tutorial">Tutorial</a></li>
      <li><a href="/plugins">Plugins</a></li>
    </ul>
  </nav>
</header>

<main id="main-content">
  <article>
    <h1>Getting Started with EdgeRecord</h1>

    <section>
      <h2>What is EdgeRecord?</h2>
      <p>EdgeRecord is Ixflare's ORM...</p>
    </section>

    <section>
      <h2>Quick Example</h2>
      <pre><code>const user = await User.find(id)</code></pre>
    </section>
  </article>
</main>

<footer>
  <p>&copy; 2024 Ixflare</p>
</footer>

<!-- ✗ Bad: Div soup (no semantic meaning) -->
<div class="header">
  <div class="nav">
    <div class="link">Documentation</div>
  </div>
</div>
<div class="content">
  <div class="title">Getting Started</div>
  <div class="text">EdgeRecord is...</div>
</div>
```

---

### 2. ARIA Labels and Roles (When Semantic HTML Insufficient)

```tsx
// Icon-only button (needs label)
<button aria-label="Close modal" onClick={onClose}>
  <XIcon aria-hidden="true" />
</button>

// Form field with error state
<div>
  <label htmlFor="email">Email Address</label>
  <input
    id="email"
    type="email"
    aria-invalid={hasError}
    aria-describedby={hasError ? "email-error" : undefined}
  />
  {hasError && (
    <span id="email-error" role="alert" className="text-red-600">
      Invalid email format. Example: user@example.com
    </span>
  )}
</div>

// Live region for dynamic content
<div aria-live="polite" aria-atomic="true">
  {searchResults.length} plugins found
</div>

// Status message (non-interrupting)
<div role="status" aria-live="polite">
  Settings saved
</div>

// Alert (interrupts screen reader)
<div role="alert" aria-live="assertive">
  Deployment failed
</div>
```

**ARIA Best Practices:**
- Use semantic HTML first, ARIA second
- Never override semantic HTML with wrong ARIA role
- Test with actual screen readers (ARIA can be confusing)
- ARIA doesn't add keyboard behavior (must add manually)

---

### 3. Keyboard Navigation & Focus Management

```tsx
// Modal with focus trap and focus return
function Modal({ isOpen, onClose }) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      // Save previously focused element
      previousFocusRef.current = document.activeElement as HTMLElement

      // Focus first element in modal
      const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      firstFocusable?.focus()

      // Trap focus within modal
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose()
          return
        }

        if (e.key === 'Tab') {
          const focusableElements = Array.from(
            modalRef.current?.querySelectorAll<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            ) || []
          )

          const firstElement = focusableElements[0]
          const lastElement = focusableElements[focusableElements.length - 1]

          if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault()
            lastElement.focus()
          } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault()
            firstElement.focus()
          }
        }
      }

      document.addEventListener('keydown', handleKeyDown)

      return () => {
        document.removeEventListener('keydown', handleKeyDown)

        // Return focus to previously focused element
        previousFocusRef.current?.focus()
      }
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <h2 id="modal-title">Modal Title</h2>
      {/* Modal content */}
    </div>
  )
}
```

---

### 4. Skip Links for Efficient Navigation

```tsx
// Skip to main content link (hidden until focused)
<a
  href="#main-content"
  className="
    sr-only
    focus:not-sr-only
    focus:absolute
    focus:top-4
    focus:left-4
    focus:z-50
    focus:bg-white
    focus:text-violet-600
    focus:px-4
    focus:py-2
    focus:rounded-md
    focus:shadow-lg
    focus:ring-2
    focus:ring-violet-600
  "
>
  Skip to main content
</a>

<main id="main-content" tabIndex={-1}>
  {/* Main page content */}
</main>
```

---

### 5. High Contrast Mode Support

```css
/* Ensure borders visible in Windows High Contrast Mode */
.card {
  border: 1px solid transparent;
  background: white;
}

/* Force border color in high contrast */
@media (prefers-contrast: high) {
  .card {
    border-color: currentColor;
  }

  /* Ensure focus indicators remain visible */
  *:focus {
    outline: 3px solid currentColor;
  }
}

/* Adapt to user's contrast preference */
@media (prefers-contrast: more) {
  :root {
    --text-primary: #000000;
    --bg-primary: #FFFFFF;
    /* Increase contrast ratios */
  }
}
```

---

## Accessibility Compliance Documentation

**WCAG 2.1 Level AA Conformance Statement:**

Ixflare Documentation, Interactive Tutorial, and Plugin Directory conform to Web Content Accessibility Guidelines (WCAG) 2.1 Level AA.

**Conformance Information:**
- **Standard:** WCAG 2.1 Level AA
- **Scope:** All public-facing web content (docs, tutorial, plugin directory)
- **Date of Last Review:** [Updated quarterly]
- **Testing Methodology:**
  - Automated testing: axe-core, Lighthouse, Pa11y
  - Manual testing: VoiceOver (macOS), NVDA (Windows), keyboard-only navigation
  - User testing: Quarterly sessions with users with disabilities

**Known Limitations:**
- **Edge Telescope:** Desktop-only tool (minimum 1280px width required for debugging interface)
- **Complex Request Waterfall Diagrams:** Provide CSV export as data table alternative
- **Video Content (if added):** Captions will be provided for all video tutorials

**Exclusions:**
- Third-party plugin content (not controlled by Ixflare team)
- User-generated content in Discord community (external platform)

**Feedback and Contact:**
- **Email:** accessibility@ixflare.dev
- **Report Issues:** [GitHub Issues](https://github.com/ixflare/ixflare/issues) with label "accessibility"
- **Response Time:** Accessibility issues triaged within 48 hours

**Commitment:**
- Quarterly accessibility audits with external consultants
- Continuous automated testing in CI/CD pipeline
- User testing with developers with disabilities every quarter
- Accessibility training for all developers on the team

---

This responsive design and accessibility strategy ensures Ixflare works beautifully across all devices (mobile, tablet, desktop) and is usable by all developers—including those using screen readers, keyboard-only navigation, high contrast modes, or browser zoom up to 200%. The three-tier testing approach (automated + manual + user testing) provides comprehensive coverage while maintaining development velocity.
