# UX Consistency Patterns

These patterns ensure users experience consistent, predictable interactions across all Ixflare touchpoints—CLI, documentation, Edge Telescope, and interactive tutorial.

---

## Feedback Patterns

**Purpose:** Provide consistent, clear feedback across all Ixflare touchpoints so users always know what's happening, what succeeded, what failed, and how to recover.

### Success Feedback

**When to Use:** After any user action completes successfully (command execution, form submission, code run, deployment)

**Visual Design:**
- **Color:** Green (#10B981 light mode, #34D399 dark mode)
- **Icon:** Checkmark (✓) or relevant success icon
- **Duration:** Persistent for critical actions, 2-3s toast for minor actions
- **Animation:** Gentle fade-in or slide-in (respects prefers-reduced-motion)

**Behavior:**
- Appears immediately after action completes
- Non-blocking (doesn't require dismissal unless critical)
- Auto-dismisses after timeout (except for permanent status indicators)

**Examples:**
- Terminal: `✓ D1 database initialized (local)` - Persistent, part of output
- Code Block: `Copied!` button text change - 2s duration, reverts to "Copy"
- Deployment: `✓ Deployed to 300+ edge locations!` - Persistent success state
- Form: Green checkmark next to field + "Saved" toast

**Accessibility:**
- ARIA live region: `aria-live="polite"` announces success
- Screen reader: "Database initialized successfully"
- Color not sole indicator: Always paired with icon + text

**Mobile Considerations:**
- Toast notifications appear at top (not bottom where thumbs are)
- Larger touch target for dismiss (if dismissible)
- Haptic feedback on success (iOS/Android)

---

### Error Feedback

**When to Use:** When an action fails, validation fails, or system error occurs

**Visual Design:**
- **Color:** Red (#EF4444 light mode, #F87171 dark mode)
- **Icon:** X (✗) or warning triangle (⚠)
- **Duration:** Persistent until user acknowledges or fixes
- **Layout:** Inline for field errors, banner for page-level errors

**Behavior:**
- Appears immediately when error detected
- **Critical:** Must provide actionable recovery suggestion
- Never dismisses automatically (user must acknowledge)
- Preserves user input (never loses work)

**Error Message Structure (3-part formula):**
1. **What happened:** "Port 8787 is already in use"
2. **Why it matters:** "Cannot start development server"
3. **How to fix:** "Run: `lsof -ti:8787 | xargs kill` (Mac) or `netstat -ano | findstr :8787` (Windows)"

**Examples:**
- Terminal: `✗ Port 8787 in use` followed by OS-specific recovery command
- Code Editor: Red highlight on error line + message below with suggestion
- Form: Red outline + inline message "Email format invalid. Example: user@example.com"
- Deployment: `✗ Bundle exceeds 1MB limit (1.2MB). Remove unused dependencies or use code splitting.`

**Accessibility:**
- ARIA: `role="alert"` for immediate errors, `aria-invalid="true"` on fields
- Screen reader: Reads error immediately, interrupts current context
- Focus management: Moves focus to first error field in forms
- Color not sole indicator: Icon + border + text

**Mobile Considerations:**
- Error messages don't obscure correctable fields
- Keyboard doesn't hide error text
- Scroll to error field automatically

---

### Warning Feedback

**When to Use:** User action might have unintended consequences, or non-critical issue detected

**Visual Design:**
- **Color:** Yellow/Amber (#F59E0B light mode, #FBBF24 dark mode)
- **Icon:** Warning triangle (⚠)
- **Duration:** Persistent until acknowledged
- **Emphasis:** Less alarming than error, more noticeable than info

**Behavior:**
- Allows user to proceed or cancel
- Explains risk/consequence clearly
- Provides both "Proceed anyway" and "Cancel" options

**Examples:**
- Deployment: `⚠ Deploying to production without running tests. Continue?`
- Plugin: `⚠ This plugin hasn't been updated in 12 months. It may not work with latest Ixflare.`
- Tutorial: `⚠ You're skipping Module 3. You might miss important concepts.`
- CLI: `⚠ This command will delete all local data. Type 'confirm' to proceed:`

**Accessibility:**
- ARIA: `role="alert"` with appropriate label
- Screen reader: Announces warning and required action
- Keyboard: Focus on primary action button

---

### Loading Feedback

**When to Use:** Any action taking >500ms (deployment, search, code execution, data fetch)

**Visual Design:**
- **Spinner:** Animated circular spinner (10fps, respects reduced-motion)
- **Progress bar:** For known-duration tasks (deployment, installation)
- **Skeleton screens:** For content loading (search results, plugin cards)
- **Color:** Neutral gray (#6B7280) animated

**Behavior:**
- Appears after 500ms delay (prevents flashing for quick operations)
- Shows elapsed time for operations >5s
- Indicates progress when possible (50%, "Step 2 of 4")
- Never blocks other UI interactions unless necessary

**Examples:**
- Terminal: `⠋ Starting dev server... [2.3s]` - Spinner + elapsed time
- Search: Skeleton cards pulsing while fetching results
- Code Editor: `▶ Running code...` button with spinner
- Deployment: `Deploying... ━━━━━━━━░░░░░░░ 60%` - Progress bar

**Accessibility:**
- ARIA: `aria-busy="true"` on loading container, `role="progressbar"` for known progress
- Screen reader: "Loading, please wait" announced once, not repeated
- Focus: Disabled on loading elements, re-enabled when complete
- Animation: Respects prefers-reduced-motion (static indicator instead)

**Mobile Considerations:**
- Full-screen loading for major operations (deployment)
- Inline loading for minor operations (search)
- Pull-to-refresh pattern for manual refresh

---

### Info Feedback

**When to Use:** Provide helpful context, tips, or non-critical information

**Visual Design:**
- **Color:** Blue (#3B82F6 light mode, #60A5FA dark mode)
- **Icon:** Info circle (ⓘ) or arrow (→)
- **Duration:** Persistent or dismissible
- **Tone:** Helpful, not alarming

**Behavior:**
- Can be dismissed (X button in corner)
- Doesn't interrupt user flow
- Provides additional context, not critical information

**Examples:**
- Terminal: `→ Server running on localhost:8787` - Arrow indicates info
- Docs: `💡 Tip: Use ⌘K to open search from anywhere` - Dismissible banner
- Tutorial: `ℹ️ This is a simplified example. Production apps need error handling.` - Info callout
- Plugin: `ⓘ Community plugin - Not officially maintained by Ixflare team`

**Accessibility:**
- ARIA: `role="status"` for non-critical info
- Screen reader: Announces politely without interrupting
- Dismissible: Clear close button with label "Dismiss tip"

---

## Action Hierarchy Patterns

**Purpose:** Establish clear visual hierarchy for actions so users know what to do next.

### Primary Actions

**When to Use:** The main action user should take in current context (one per screen/section)

**Visual Design:**
- **Color:** Brand primary (Violet #8B5CF6 for Ixflare)
- **Style:** Solid fill, high contrast text (white on violet)
- **Size:** Larger than secondary (48px height mobile, 40px desktop minimum)
- **Position:** Right-aligned (LTR) or prominent position
- **States:** Hover (darkens 10%), active (darkens 20%), disabled (50% opacity)

**Examples:**
- Setup flow: `[Deploy to Production]` - Primary action after successful local dev
- Documentation homepage: `[Try Interactive Tutorial]` - Main CTA
- Plugin card: `[Install]` - Primary action to add plugin
- Code Editor: `[Run Code ▶]` - Primary action to execute code

**Accessibility:**
- Large touch target (48×48px minimum on mobile)
- High contrast ratio (4.5:1 minimum, targets 7:1)
- Enter key activates when focused
- Visual focus indicator (2px outline)

**Mobile Considerations:**
- Full-width on screens <640px
- Minimum 48px height for touch
- Adequate spacing from edges (16px minimum)

---

### Secondary Actions

**When to Use:** Alternative or supporting actions (multiple allowed per context)

**Visual Design:**
- **Color:** Gray outline (#6B7280) or ghost button
- **Style:** Border only (1px solid), transparent background
- **Size:** Same height as primary, less visual weight
- **States:** Hover (background gray-50), active (background gray-100)

**Examples:**
- Setup flow: `[Deploy]` primary, `[Run Tests First]` secondary
- Code Block: `[Copy]` primary, `[Run in Terminal]` secondary
- Plugin card: `[Install]` primary, `[Documentation]` `[GitHub]` secondary
- Modal dialog: `[Confirm]` primary, `[Cancel]` secondary

**Accessibility:**
- Clear distinction from primary (outline vs filled)
- Same size touch target as primary
- Keyboard navigable in logical order

---

### Destructive Actions

**When to Use:** Actions that delete, remove, or permanently change data

**Visual Design:**
- **Color:** Red (#EF4444)
- **Style:** Outlined by default, filled on hover/focus to emphasize danger
- **Confirmation:** Always require confirmation dialog or typing 'confirm'
- **Warning:** Show consequence before action

**Examples:**
- CLI: `ix delete:project` - Requires typing project name to confirm
- Settings: `[Delete Account]` - Red button, opens confirmation modal
- Tutorial: `[Reset Progress]` - Confirmation: "This will delete your progress. Continue?"
- Plugin management: `[Uninstall Plugin]` - Warns about dependent projects

**Behavior:**
- Two-step confirmation for irreversible actions
- Explains consequence clearly: "This will permanently delete X. This cannot be undone."
- Provides undo window if possible (10s with countdown)
- Cancel button equally prominent (not dark pattern)

**Accessibility:**
- Screen reader announces: "Warning: Destructive action. [Action description]"
- Focus on Cancel button by default (safe default)
- Requires explicit navigation to Confirm button

---

### Disabled Actions

**When to Use:** Action not currently available but may become available

**Visual Design:**
- **Color:** Gray (#9CA3AF) at 50% opacity
- **Cursor:** Not-allowed cursor on hover
- **Style:** Same as enabled state but faded

**Behavior:**
- Tooltip on hover explains why disabled: "Complete Week 2 to unlock"
- Never remove disabled actions (shows what's possible)
- Re-enables when condition met (dynamic state)

**Examples:**
- Tutorial: `[Next Module]` disabled until current module complete
- Deployment: `[Deploy]` disabled until tests pass
- Form: `[Submit]` disabled until required fields filled

**Accessibility:**
- `aria-disabled="true"` attribute
- Tooltip accessible via keyboard (focus + hover)
- Screen reader announces disabled state and reason

---

## Status Indicator Patterns

**Purpose:** Consistent visual language for showing state across all components.

### Status Color System

**Healthy/Success:** 🟢 Green
- **Color:** #10B981 (light), #34D399 (dark)
- **Icon:** Checkmark (✓)
- **Usage:** Completed steps, passing tests, healthy systems
- **Examples:** "✅ All tests passing", "✓ Plugin certified official"

**Warning/Attention:** 🟡 Yellow
- **Color:** #F59E0B (light), #FBBF24 (dark)
- **Icon:** Warning triangle (⚠)
- **Usage:** Non-critical issues, attention needed, degraded performance
- **Examples:** "⚠️ 23 open issues (↑ from 18)", "⚠️ Update available"

**Error/Critical:** 🔴 Red
- **Color:** #EF4444 (light), #F87171 (dark)
- **Icon:** X mark (✗)
- **Usage:** Failed operations, critical errors, blocked states
- **Examples:** "❌ Deployment failed", "✗ 3 critical vulnerabilities found"

**In Progress:** 🔵 Blue
- **Color:** #3B82F6 (light), #60A5FA (dark)
- **Icon:** Spinner (⏳) or progress ring
- **Usage:** Active operations, ongoing processes
- **Examples:** "⏳ Deploying...", "⏳ Running tests (3/12)"

**Neutral/Info:** ⚪ Gray
- **Color:** #6B7280 (light), #9CA3AF (dark)
- **Icon:** Arrow (→) or info (ⓘ)
- **Usage:** Informational, metadata, neutral status
- **Examples:** "→ 1.2K downloads/month", "→ Last updated 2d ago"

**Locked/Disabled:** ⚫ Gray (dimmed)
- **Color:** #9CA3AF at 50% opacity
- **Icon:** Lock (🔒)
- **Usage:** Unavailable features, prerequisites not met
- **Examples:** "🔒 Requires Phase 2 completion", "🔒 Premium feature"

---

### Progress Indicator Variants

**Linear Progress (known endpoint):**
```
⬛⬛⬛⬜⬜⬜⬜⬜  38% complete

Step 3 of 8: Build Your First App
```
- **Use for:** Tutorial modules, deployment steps, POC timeline
- **Shows:** Current position, total steps, percentage
- **Behavior:** Fills left-to-right, animates on update

**Indeterminate Progress (unknown duration):**
```
⠋ Processing... [2.3s]
```
- **Use for:** Code execution, search queries, data loading
- **Shows:** Activity indicator + elapsed time after 2s
- **Behavior:** Spinner animation, updates time every second

**Stepped Progress (discrete phases):**
```
✅ Week 1: Development (Complete)
⏳ Week 2: Security Testing (In Progress - 60%)
🔒 Week 3: Performance Testing (Locked)
🔒 Week 4: Go/No-Go Decision (Locked)
```
- **Use for:** Multi-phase workflows, POC timeline, onboarding
- **Shows:** Completed, current (with %), upcoming steps
- **Behavior:** Expands current step, collapses completed

---

## Search & Discovery Patterns

**Purpose:** Consistent patterns for finding information across documentation, plugins, and API reference.

### Global Search Behavior

**Keyboard-First Interaction:**
- **Shortcut:** `⌘K` (Mac) / `Ctrl+K` (Windows/Linux) from anywhere
- **Modal:** Full-screen overlay on activation
- **Focus trap:** Tab cycles within search modal, can't escape
- **Navigation:** `↑↓` arrows to navigate results, `Enter` to select
- **Close:** `Esc` key or click backdrop

**Instant Results:**
- **Debounce:** 150ms after typing stops (prevents server spam)
- **Display:** Results appear without page reload
- **Loading:** Skeleton cards pulse while fetching (<300ms)
- **Highlighting:** Matched text highlighted in yellow

**Smart Ranking Algorithm:**
- Query "how to deploy" → Prioritize How-To guides over API reference
- Query "User.find" → Prioritize API reference methods
- Exact matches ranked higher than fuzzy matches
- Recently accessed pages boosted in ranking
- User's current section weighted higher

**Zero Results Handling:**
```
No results for "edgrecord"

Did you mean: "EdgeRecord"?

Related searches:
• EdgeRecord relationships
• D1 vs KV storage

[Ask Discord →] [File docs issue →]
```

**Accessibility:**
- ARIA: `role="combobox"` with `aria-expanded="true"`
- Results: `role="listbox"` with `aria-activedescendant`
- Screen reader: "5 results found for EdgeRecord relationships"
- Keyboard only: Fully navigable without mouse

---

### Documentation Navigation Patterns

**Breadcrumb Navigation:**
```
Home > Guides > EdgeRecord > Relationships
```
- Always visible at top of content
- Each level clickable (except current page)
- Shows current location in hierarchy
- Mobile: Collapses to "< Back" on narrow screens

**Sidebar Navigation (Desktop):**
- Persistent on left side (300px width)
- Active page highlighted with background + border
- Sections expand/collapse (accordion pattern)
- Keyboard: Arrow keys navigate, Enter opens link
- Scrolls active item into view on page load

**Mobile Navigation:**
- Hamburger menu (☰) in header
- Full-screen slide-in drawer
- Same structure as desktop sidebar
- Swipe right to close or tap backdrop

**Contextual Navigation:**
- **Bottom of guides:** "Next: [Next Topic →]" and "← Previous: [Previous Topic]"
- **Sidebar (right):** "On this page" table of contents for h2/h3 headings
- **Related content:** "See also: [Topic 1] [Topic 2]" in callout box

---

### Plugin Directory Navigation

**Filtering:**
- **Sidebar filters:** Official / Community / All, by category
- **Sort options:** Popular, Recent, Alphabetical, Downloads
- **Search:** Filters plugins by name, description, author

**Discovery Paths:**
- **Featured plugins:** Curated list on homepage (3-5 plugins)
- **Categories:** Browse by function (Authentication, Database, AI, etc.)
- **Search-driven:** Type use case, find relevant plugins

---

## Code & Terminal Patterns

**Purpose:** Developer-specific patterns for code display and terminal interaction.

### Code Block Standards

**Syntax Highlighting Rules:**
- Language always specified: ```typescript, ```bash, ```json
- Colorblind-safe theme using patterns + colors
- Keywords (bold), strings (italic), comments (dimmed)
- Dark mode by default, light mode toggle available
- Line numbers shown for blocks >5 lines

**Copy Button Behavior:**
- **Position:** Top-right corner of code block
- **Appearance:** Subtle until hover (prevents visual clutter)
- **Click:** Copies code to clipboard, excludes line numbers
- **Feedback:** Button text changes to "Copied!" (2s), then reverts to "Copy"
- **Keyboard:** Tab to focus, Enter to activate

**Code Block Variants:**
```typescript
// Standard code block (with line numbers, copy button)
const user = await User.find(userId)
if (!user) {
  throw new NotFoundError()
}
```

```bash
# Terminal command (with $ prefix, run button for CLI)
$ ix dev
```

```diff
# Diff view (for showing changes, PR reviews)
- const old = 'remove this'
+ const new = 'add this'
```

**Inline Code:**
- **Format:** `const user = await User.find(id)` within text
- **Style:** Monospace font, subtle gray background, 1px border
- **No copy button** for inline code (too small)
- **Wrapping:** Breaks at whitespace on mobile, no horizontal scroll

---

### Terminal Output Standards

**Command Display Format:**
```
$ ix dev                    [2.3s]
```
- Commands prefixed with `$` to distinguish from output
- Elapsed time shown in brackets for operations >1s
- User input distinguishable from system output (bold)

**Status Line Formatting:**
```
✓ Database initialized (local)    [green, dimmed]
✗ Port 8787 already in use         [red, bold]
→ Server running on localhost:8787 [gray, normal]
⚠ Warning: No .env file found      [yellow, normal]
⠋ Starting dev server...           [spinner animation]
```

**Output Conventions:**
- **Line length:** Max 80 characters (wraps on narrow terminals)
- **URLs:** Automatically linkified and underlined
- **File paths:** Clickable (opens in system default app)
- **Errors:** Include OS-specific recovery commands
- **Timestamps:** Shown for deployment logs, hidden for dev feedback

**Color Usage:**
- Green: Success, completion
- Red: Errors, failures
- Yellow: Warnings, important info
- Gray: Neutral info, metadata
- Blue: In-progress operations

---

## Empty States & Loading Patterns

**Purpose:** What users see when there's no content or while waiting for content to load.

### Empty State Variants

**First-Use Empty State (Encouragement):**
```
┌──────────────────────────────────────┐
│              📦                      │
│   No plugins installed yet           │
│                                      │
│   Plugins extend Ixflare with        │
│   pre-built integrations.            │
│                                      │
│   [Browse Plugin Directory]          │
│                                      │
│   Popular: Turnstile, Workers AI     │
└──────────────────────────────────────┘
```
- **Icon:** Large, relevant to context (64×64px)
- **Headline:** Clear, not negative ("No plugins yet" vs "No plugins found")
- **Description:** Brief explanation of what this area is for
- **CTA:** Primary action button to get started
- **Optional:** Suggestions or quick examples

**Search No Results (Helpful Recovery):**
```
No results for "durabl objcts"

Did you mean: "Durable Objects"?

Try:
• Check spelling
• Use fewer or different keywords
• Browse all documentation

[Ask Discord] [View All Guides]
```
- **Correction suggestions:** Fuzzy matching for typos
- **Tips:** Actionable suggestions to refine search
- **Alternative paths:** Browse, ask community, view all
- **Never a dead end:** Always provide next steps

**Error Empty State (Clear Recovery):**
```
⚠️ Unable to load plugins

Connection timeout. Please check your
internet connection and try again.

[Retry Now] [View Cached Plugins]

Last successful sync: 2 hours ago
```
- **What went wrong:** Clear error explanation
- **Why it happened:** Context when possible
- **Recovery action:** Primary button to retry
- **Fallback:** Secondary option (cached data, offline mode)
- **Status info:** When last successful, helps debug

**Zero Data Empty State (Configuration Needed):**
```
📊 No metrics available yet

Metrics will appear once you deploy
your first application to production.

[Deploy Your First App] [Read Metrics Guide]

Takes ~5 minutes to see first data points
```
- **Explains why empty:** No data because no action taken yet
- **Shows path forward:** What user needs to do
- **Sets expectations:** Timeline for seeing data
- **Educational:** Link to learn more

---

### Loading State Patterns

**Skeleton Screens (Content Loading):**
```
┌──────────────────────────────────┐
│ ████████░░░░░░░░                 │ [Pulsing gray blocks]
│ ██████░░░░░░░                    │ [Maintain layout]
│                                  │ [No content shift]
│ ████████████░░░░                 │
│ ██████░░░░░░                     │
└──────────────────────────────────┘
```
- **Use for:** Plugin cards, search results, dashboard widgets
- **Layout:** Maintains exact layout of loaded content (no shift)
- **Animation:** Subtle pulse (1s cycle, respects reduced-motion)
- **Duration:** Shown immediately, replaces with content when loaded

**Spinner Loading (Operation Executing):**
```
⠋ Loading plugins...
```
- **Use for:** Operations with unknown duration (<10s expected)
- **Position:** Centered in container or inline with text
- **Animation:** Rotating spinner or dots (10fps)
- **Text:** Descriptive status message
- **Elapsed time:** Shows after 5s: "Loading plugins... [8s]"

**Progress Bar Loading (Known Duration):**
```
Deploying to production...
━━━━━━━━━━━━━━░░░░░░  65%

Step 3 of 4: Running migrations
Estimated time remaining: ~2 minutes
```
- **Use for:** Deployments, installations, migrations
- **Shows:** Current step, percentage, time estimate
- **Updates:** Real-time progress (every 500ms)
- **Cancel:** Offer cancel button if operation can be interrupted

**Optimistic UI (Instant Feedback):**
```
[User clicks "Install Plugin"]

Immediately shows:
✓ @ixflare/turnstile installed  [Optimistic]

Background: Actually installing...

On success: Status persists
On failure: Reverts + shows error
```
- **Use for:** Actions likely to succeed (>95% success rate)
- **Behavior:** Show success immediately, revert if fails
- **Benefit:** Feels instant, reduces perceived latency
- **Risk mitigation:** Clear rollback on failure with explanation

---

## Modal & Overlay Patterns

**Purpose:** Consistent behavior for modals, dialogs, and overlays that require user attention.

### Modal Dialog Standards

**When to Use Modals:**
- Critical decisions requiring full attention (delete account, deploy to production)
- Multi-step forms needing focus (authentication, complex settings)
- Content requiring immersive experience (tutorial steps, video)
- Confirmation dialogs for destructive actions

**When NOT to Use Modals:**
- Simple notifications (use toast instead)
- Non-critical information (use inline callout)
- Navigation (use standard links)
- Content that should be bookmarkable (use dedicated page)

**Modal Structure:**
```
[Backdrop - semi-transparent black]

┌─────────────────────────────────────┐
│ [Modal Title]                  [X] │ ← Header
├─────────────────────────────────────┤
│                                     │
│ [Scrollable Content Area]           │ ← Body
│                                     │
│                                     │
├─────────────────────────────────────┤
│           [Cancel]  [Primary]      │ ← Footer
└─────────────────────────────────────┘
```

**Behavior Standards:**
- **Focus trap:** Tab cycles within modal, can't escape to page behind
- **Escape key:** Closes modal (unless unsaved changes present)
- **Backdrop click:** Closes modal for non-critical dialogs
- **Body scroll:** Locked when modal open (prevent scroll confusion)
- **Focus management:** Moves to first focusable element on open
- **Return focus:** Returns to trigger element on close

**Size Variants:**
- **Small (480px):** Simple confirmations, alerts
- **Medium (640px):** Forms, settings (default)
- **Large (960px):** Complex content, multi-step wizards
- **Full-screen:** Mobile default, immersive experiences

**Modal Examples:**

**Confirmation Dialog:**
```
Delete Account?

This will permanently delete your account
and all associated data. This cannot be
undone.

Type 'DELETE' to confirm:
[____________]

[Cancel]  [Delete Account]
```

**Search Modal (⌘K):**
```
[Full-screen overlay]

🔍 Search documentation...
[_________________________________]

[Search results appear here]

Keyboard shortcuts:
↑↓ Navigate  ↵ Select  Esc Close
```

**Tutorial Step Modal:**
```
Module 3: Build Your First App

[Content with code examples]

Progress: ⬛⬛⬛⬜⬜⬜⬜⬜  3/8

[← Previous]  [Next →]
```

---

### Toast Notifications

**When to Use:**
- Success confirmations (file uploaded, settings saved)
- Non-critical errors (network hiccup, retry available)
- Info updates (new version available, cache cleared)

**Position:**
- **Desktop:** Top-right corner (doesn't block content)
- **Mobile:** Top center (visible but not intrusive)

**Duration:**
- **Success:** 3 seconds auto-dismiss
- **Error:** 5 seconds or manual dismiss (X button)
- **Info:** 4 seconds auto-dismiss

**Stacking:**
- Multiple toasts stack vertically
- Maximum 3 visible at once
- Older toasts auto-dismiss when new arrive

**Example:**
```
┌──────────────────────────────┐
│ ✓ Settings saved             │ [Green background]
└──────────────────────────────┘
```

---

### Tooltip Patterns

**When to Use:**
- Explain icons or unfamiliar terms
- Show keyboard shortcuts
- Provide additional context without cluttering UI

**Behavior:**
- **Trigger:** Hover (desktop) or tap icon (mobile)
- **Delay:** 500ms hover delay (prevents accidental)
- **Position:** Above element, falls back if no space
- **Dismissal:** Move mouse away (desktop), tap outside (mobile)

**Content:**
- Short (1-2 sentences maximum)
- Plain text only (no interactive elements)
- Clear, helpful explanation

**Example:**
```
[Icon: 🔒] ← Hover/Tap

┌─────────────────────────────┐
│ Locked: Complete Week 2     │
│ to unlock this phase        │
└─────────────────────────────┘
```

---

## Pattern Integration with Design System

**Tailwind CSS + Design Token Integration:**

All UX patterns use Tailwind utility classes and custom design tokens for consistency:

**Color Tokens:**
```css
/* Success */
.text-success { color: #10B981 }  /* light mode */
.dark .text-success { color: #34D399 }  /* dark mode */

/* Error */
.text-error { color: #EF4444 }
.dark .text-error { color: #F87171 }

/* Warning */
.text-warning { color: #F59E0B }
.dark .text-warning { color: #FBBF24 }

/* Info */
.text-info { color: #3B82F6 }
.dark .text-info { color: #60A5FA }
```

**Spacing Scale:**
```
p-2  → 8px    (tight spacing)
p-4  → 16px   (default spacing)
p-6  → 24px   (comfortable spacing)
p-8  → 32px   (generous spacing)
gap-4 → 16px  (between elements)
```

**Typography Scale:**
```
text-xs   → 12px  (metadata, captions)
text-sm   → 14px  (body text, default)
text-base → 16px  (emphasized body)
text-lg   → 18px  (subheadings)
text-xl   → 20px  (headings)
```

**Animation Tokens:**
```css
/* Transitions */
.transition-all { transition: all 300ms ease }

/* Reduced motion respect */
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; }
}
```

---

## Custom Pattern Rules

**5 Core Rules Applied to All Patterns:**

1. **Color + Icon + Text (Accessibility Trinity)**
   - Never use color alone to convey meaning
   - Always pair with icon AND descriptive text
   - Example: ✓ "Success" (not just green background)

2. **Keyboard Navigation (Mouse-Free Completeness)**
   - Every interactive pattern works without mouse
   - Tab order follows visual order (left-to-right, top-to-bottom)
   - Focus indicators always visible (2px outline minimum)
   - Shortcut keys documented inline (⌘K, Esc, Enter)

3. **Mobile-First Responsive (Touch-Friendly)**
   - Touch targets minimum 48×48px
   - Patterns designed for mobile first, scale up for desktop
   - Hover states have tap equivalents on mobile
   - Gestures: Swipe to close modals, pull-to-refresh lists

4. **Dark Mode Parity (No Afterthought)**
   - All patterns designed for both light AND dark mode
   - Contrast ratios meet WCAG AA in both modes (4.5:1 minimum)
   - System preference detected via `prefers-color-scheme`
   - Manual toggle overrides system preference (persisted)

5. **Progressive Enhancement (Graceful Degradation)**
   - Patterns work with JavaScript disabled (where possible)
   - Images have descriptive alt text
   - Forms submit without JavaScript
   - Animations disabled when `prefers-reduced-motion` detected

---

## Pattern Documentation Structure

For each pattern, documentation includes:

**Usage Guidelines:**
- When to use this pattern
- When NOT to use this pattern
- Common use cases with examples

**Visual Specifications:**
- Colors (light + dark mode)
- Spacing and sizing
- Typography
- States (default, hover, active, disabled)

**Behavior Specifications:**
- Interaction model (click, hover, keyboard)
- Timing (delays, durations, animations)
- Transitions and animations

**Accessibility Requirements:**
- ARIA labels and roles
- Keyboard navigation flow
- Screen reader announcements
- Focus management

**Code Examples:**
- React component usage
- Tailwind class combinations
- Common variants

---

These UX consistency patterns ensure that Ixflare provides a cohesive, predictable experience across all touchpoints. Users learn the patterns once (success = green + ✓, search = ⌘K, errors = 3-part formula) and apply them everywhere—CLI, docs, Edge Telescope, and tutorial.
