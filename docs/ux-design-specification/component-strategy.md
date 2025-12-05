# Component Strategy

## Design System Foundation

Based on our design system choice from Step 6, we're building on:
- **Tailwind CSS** for utility-first styling
- **Headless UI** for accessible primitives
- **React + TypeScript** for component implementation

This foundation provides proven accessible components (Button, Modal, Dropdown, Tabs, Accordion, Toggle, Tooltip) that we'll extend with custom components specific to Ixflare's unique developer experience needs.

## Component Needs Analysis

From our six user journey flows (Step 10), we identified critical touchpoints requiring custom components:

**First-Time Setup Flow needs:**
- Terminal output with status indicators
- Code blocks with one-click copying
- Progress visualization for multi-step processes

**Documentation Discovery Flow needs:**
- Instant search with keyboard navigation
- Syntax-highlighted code examples
- Clear error messages with recovery suggestions

**Plugin Development & Learning Flows need:**
- Plugin cards with certification badges
- Interactive code editor for tutorials
- Progress tracking for learning paths

**Enterprise Evaluation & Debugging Flows need:**
- Metrics dashboards for transparency
- Request waterfall for debugging
- Status timelines for POC tracking

**Gap Analysis:** While Tailwind + Headless UI provide foundational components, they don't cover domain-specific developer tool UX patterns. We need 10 custom components.

---

## Custom Components Specifications

### 1. Terminal Output Component

**Purpose:** Display CLI command output with proper formatting, status indicators, and actionable error messages to make terminal feedback feel fast, clear, and encouraging.

**Usage:** CLI interactions (`ix dev`, `ix deploy`, `ix make:model`), documentation code examples, embedded in interactive tutorial.

**Anatomy:**
```
┌─────────────────────────────────────┐
│ $ ix dev                [2.3s]     │ ← Command with elapsed time
│                                     │
│ ✓ D1 database initialized (local)  │ ← Success (green checkmark)
│ ✓ KV namespace bound                │
│ ⠋ Starting dev server...           │ ← Loading (animated spinner)
│                                     │
│ → Server running on localhost:8787 │ ← Info (arrow)
│                                     │
└─────────────────────────────────────┘
```

**States:**
- **Default:** Dark background (respects system dark mode), monospace font
- **Success:** Green checkmark (✓) + dimmed success text
- **Error:** Red X (✗) + error message + OS-specific recovery command in yellow
- **Loading:** Animated spinner + elapsed time (updates every second)
- **Info:** Arrow (→) + neutral information
- **Warning:** Yellow triangle (⚠) + warning message

**Variants:**
- **Compact:** Single-line output for simple commands
- **Verbose:** Multi-line with timestamps and detailed logging (--verbose flag)
- **JSON Mode:** Structured JSON output for CI/CD and observability tools (--json flag)
- **Embedded:** Smaller font size for docs/tutorial context

**Accessibility:**
- ARIA live region: `aria-live="polite"` for dynamic updates
- Screen reader announces status changes: "D1 database initialized"
- Color not sole indicator: Icons + text together
- High contrast mode support (WCAG AAA)
- Respects prefers-reduced-motion (disables spinner animation)

**Enhanced Features (from elicitation):**
- **OS-specific error recovery:** If port 8787 is taken, shows `lsof -ti:8787 | xargs kill` (Mac) or `netstat -ano | findstr :8787` (Windows)
- **Elapsed time display:** Shows duration for long-running operations to confirm progress
- **Structured logging:** `--json` flag outputs machine-readable logs for Datadog, Splunk, etc.

**Interaction Behavior:**
- Output streams in real-time (no buffering)
- Spinner animates at 10fps (unless prefers-reduced-motion)
- Auto-scroll to bottom on new output
- Click to copy entire output
- Ctrl+C to interrupt (in interactive mode)

**Mobile Considerations:**
- Touch to expand long output
- Horizontal scroll for lines >80 chars
- Larger touch targets for copy button (44×44px minimum)

**Internationalization:**
- No hardcoded strings (all text i18n-ready)
- Icons (✓✗→⚠) are universal, no text embedded
- Supports RTL layouts (status icons flip left)

---

### 2. Code Block with Copy Component

**Purpose:** Display code examples with syntax highlighting and one-click copying to reduce friction when users want to try examples.

**Usage:** Documentation examples, error message suggestions, tutorial code snippets, API reference.

**Anatomy:**
```
┌────────────────────────────────────────┐
│ TypeScript              [Copy] [Run]  │ ← Language + Actions
├────────────────────────────────────────┤
│ 1  const user = await User.find(id)   │ ← Line numbers
│ 2  if (!user) {                        │   Syntax highlighting
│ 3    throw new NotFoundError()         │   Colorblind-safe
│ 4  }                                   │
└────────────────────────────────────────┘
```

**States:**
- **Default:** Dark background (light mode available), syntax highlighted
- **Hover on Copy:** Button background lightens, tooltip "Copy to clipboard"
- **Copied:** Button text → "Copied!" with checkmark (2s duration)
- **Focus:** 2px outline around entire code block (keyboard navigation)
- **Overflow:** Horizontal scroll with gradient fade indicator

**Variants:**
- **With line numbers:** Shows line numbers on left (default for >5 lines)
- **Without line numbers:** Cleaner for short snippets (<5 lines)
- **Highlighted lines:** Specific lines emphasized with background (tutorial focus)
- **Diff view:** Red/green background for code changes (contribution flow)
- **Inline:** Single-line code `like this` within text paragraphs

**Accessibility:**
- ARIA label: "Code example, TypeScript"
- Copy button: `aria-label="Copy code to clipboard"`
- Run button (CLI commands): `aria-label="Run command in terminal"`
- Keyboard: Tab to focus code block, Tab to Copy button, Enter to activate
- Screen reader: Announces "Code copied to clipboard" on success
- Colorblind-safe syntax highlighting: Uses patterns/shapes not just color

**Enhanced Features (from elicitation):**
- **Run in Terminal button:** For CLI commands, one-click copies AND opens terminal (optional, platform-specific)
- **Theme customization:** CSS variables allow enterprise customers to match brand colors
- **Multiple color themes:** Default, High Contrast, Colorblind-safe, Solarized

**Content Guidelines:**
- Always specify language for proper highlighting
- Keep examples focused (under 20 lines when possible)
- Include comments for non-obvious logic
- Show realistic examples, not foo/bar placeholders

**Interaction Behavior:**
- Click Copy → Clipboard write → "Copied!" feedback (2s)
- Click Run → Opens system terminal with command (requires desktop app integration)
- Keyboard: Tab to focus, Arrow keys to scroll, Ctrl+A to select all, Ctrl+C to copy
- Failed copy: Shows tooltip "Please copy manually with Ctrl+C"
- Code is selectable for manual copy

**Mobile Considerations:**
- Touch-friendly copy button (44×44px)
- Horizontal scroll with momentum
- Long-press code to select and copy
- Mobile: "Copy" instead of "Run" (terminals not accessible)

**Internationalization:**
- Button labels i18n-ready ("Copy" → "Copiar", "Copied!" → "¡Copiado!")
- Code content language-neutral (syntax, not prose)
- Comments in code examples translated per locale

---

### 3. Progress Stepper Component

**Purpose:** Show users where they are in multi-step flows and celebrate progress to build momentum and confidence.

**Usage:** Interactive tutorial (8 modules), setup wizard, POC timeline, contribution flow stages.

**Anatomy:**
```
Step 3 of 8: Build Your First App

⬛⬛⬛⬜⬜⬜⬜⬜  38% complete

[1. What is Edge?] [2. Services] [3. First App] [4. EdgeRecord] ...
     ✓ Done           ✓ Done      ← Current      Pending
```

**States:**
- **Completed Step:** Filled circle (⬛) with green checkmark overlay
- **Current Step:** Highlighted with pulsing border (respects prefers-reduced-motion)
- **Pending Step:** Empty circle (⬜) dimmed 50% opacity
- **Skipped Step:** Dashed circle outline (for optional steps)
- **Failed Step:** Red X overlay (for error recovery flows)

**Variants:**
- **Linear:** Horizontal progress bar (default, desktop)
- **Vertical:** Sidebar navigation (mobile, multi-page flows)
- **Circular:** Pie chart for quick glance (dashboard widget)
- **Labeled:** Shows step names below icons
- **Minimal:** Just percentage and current step name (collapsible for advanced users)

**Accessibility:**
- ARIA: `role="progressbar"` with `aria-valuenow="3"`, `aria-valuemin="1"`, `aria-valuemax="8"`
- ARIA label: "Step 3 of 8: Build Your First App, 38 percent complete"
- Keyboard: Arrow keys navigate between completed steps (can revisit)
- Screen reader announces progress changes: "Progress updated, step 3 of 8"
- Color not sole indicator: Icons, position, and explicit text labels

**Enhanced Features (from elicitation):**
- **Local storage persistence:** Auto-saves progress to localStorage, survives browser close
- **Collapsible stepper:** Advanced users can minimize to single-line progress bar
- **Analytics callback:** Optional `onProgressChange` prop for enterprise progress tracking
- **Celebration animations:** Confetti burst at 50% and 100% completion (optional, respects reduced-motion)

**Content Guidelines:**
- Step names: Action-oriented verbs (Build, Deploy, Test, not "Building", "Deployment")
- Keep step count 3-8 (not overwhelming)
- Percentage shown for motivation
- Milestone celebrations: "Halfway there!" at 50%, "Almost done!" at 75%

**Interaction Behavior:**
- Current step always visible (auto-scroll horizontally if needed)
- Click completed steps to revisit (if workflow allows non-linear navigation)
- Pending steps not clickable, show tooltip "Complete previous step first"
- Smooth animation when progressing (0.3s transition)
- Celebration animation at milestones (confetti particles, dismissible)

**Mobile Considerations:**
- Vertical layout on screens <768px
- Swipe to see more steps if overflow
- Larger touch targets for step navigation
- Compact labels on small screens

**Internationalization:**
- "Step X of Y" → Translatable template
- Percentage format respects locale (38% vs 38 %)
- Step names translated per locale
- RTL support: Progress bar fills right-to-left

---

### 4. Search with Instant Results Component

**Purpose:** Help users find documentation answers instantly without page reloads, reducing time to solution from minutes to seconds.

**Usage:** Documentation site header, API reference lookup, plugin directory search, global keyboard shortcut (⌘K).

**Anatomy:**
```
┌──────────────────────────────────────────┐
│ 🔍 Search docs...              ⌘K       │ ← Input with hint
└──────────────────────────────────────────┘
        ↓ (while typing, 150ms debounce)
┌──────────────────────────────────────────┐
│ 🔍 edgerecord relationships              │
├──────────────────────────────────────────┤
│ 📘 EdgeRecord Relationships (Guide)     │ ← Result with icon
│    Define belongs-to and has-many...    │    Matched snippet
│                                          │
│ 📕 belongsTo() - API Reference           │
│    Method signature and usage...         │
│                                          │
│ 💬 "Composite keys" (Discord)            │ ← Community result
│                                          │
│ Related: "EdgeRecord queries", "D1 vs KV"│ ← Suggestions
│ No results? [Ask Discord →]              │ ← Fallback
└──────────────────────────────────────────┘
```

**States:**
- **Empty:** Placeholder text, shows recent searches (local storage)
- **Typing:** Results update instantly (debounced 150ms), loading skeleton
- **Loading:** Pulse animation on result skeletons
- **Results Found:** Sorted by relevance, highlighted matched text
- **No Results:** Helpful fallback with related searches + "Ask Discord" CTA
- **Selected Result:** Highlighted background on keyboard navigation

**Variants:**
- **Modal:** Full-screen overlay (⌘K activated, Esc to close)
- **Inline:** In-page search bar (docs header, always visible)
- **Scoped:** Search within current section vs. all docs (toggle)
- **Filtered:** Filter by type (Guides, API, Examples, Community)

**Accessibility:**
- ARIA: `role="combobox"` with `aria-expanded="true"`, `aria-controls="search-results"`
- Results: `role="listbox"` with `role="option"` items
- Active result: `aria-activedescendant` points to highlighted option
- Keyboard: ⌘K (Mac) / Ctrl+K (Windows/Linux) to open, ↑↓ navigate, Enter select, Esc close
- Screen reader announces: "5 results found for edgerecord relationships"
- Focus trap: Tab cycles through results, doesn't escape modal

**Enhanced Features (from elicitation):**
- **Full keyboard navigation:** ⌘K open, ↑↓ navigate, Enter select, Esc close, Tab to filters
- **Fuzzy matching:** Understands typos ("edgrecord" finds "EdgeRecord") and abbreviations ("DO" finds "Durable Objects")
- **Search suggestions:** Shows "Related searches" and "People also searched for" below results
- **Federated search:** Can search across multiple sources (public docs + private enterprise docs, configurable)
- **Recent searches:** Saved to localStorage, shows before typing

**Content Guidelines:**
- Placeholder hints: "Search docs, API, examples..." (shows scope)
- Result snippets: 1-2 sentences with highlighted matches (bold)
- Group by type: Guides → API → Examples → Community (visual separators)
- Smart ranking: Prioritize How-To guides for "how to" queries, API ref for specific method names

**Interaction Behavior:**
- Debounce typing: 150ms delay before searching (prevents server spam)
- Results appear without page reload (instant feel)
- Click result → Navigate to page (Cmd+Click opens in new tab)
- Highlight matching text in snippets (yellow background)
- Recent searches: Click X to remove individual items
- Clear button (X icon) appears when text entered

**Mobile Considerations:**
- Full-screen modal on mobile (not inline)
- Touch-friendly result items (48px height)
- Virtual keyboard doesn't obscure results
- Swipe down to close modal

**Internationalization:**
- Placeholder translated per locale
- Search queries language-neutral (code, APIs)
- Result snippets translated if docs are multi-language
- Keyboard shortcut shows locale-appropriate modifier (⌘ Mac, Ctrl Windows)

**Technical Implementation (from Architecture Decision):**
- **MVP:** Client-side search with Fuse.js (fast, works offline, <50KB)
- **Phase 2:** Upgrade to Algolia when docs exceed 1,000 pages
- **Performance:** <200ms perceived latency from keypress to results

---

### 5. Plugin Card Component

**Purpose:** Showcase plugins in the directory with key info at a glance, helping users discover and trust plugins through transparency.

**Usage:** Plugin directory page, search results, "Featured Plugins" homepage section.

**Anatomy:**
```
┌─────────────────────────────────────────┐
│ ⚡ @ixflare/turnstile        [Official] │ ← Icon + Name + Badge
│ by @marcusliu               Updated 2d  │ ← Author + Freshness
│                                         │
│ Cloudflare Turnstile CAPTCHA           │ ← Description
│ integration with zero config.          │
│                                         │
│ 📦 1.2K/mo  ⭐ 245  ✓ Audit passed     │ ← Stats + Security
│                                         │
│ [Install] [Documentation] [GitHub]     │ ← Actions
└─────────────────────────────────────────┘
```

**States:**
- **Default:** White background (light mode) / Dark gray (dark mode), subtle shadow
- **Hover:** Lift effect (shadow increases 4px), cursor pointer
- **Certified Official:** Gold badge, highlighted border (2px gold)
- **Community:** Silver badge, standard border
- **Deprecated:** Red warning banner at top, grayed out
- **Loading:** Skeleton with pulse animation

**Variants:**
- **Featured:** Larger size with screenshot/GIF demo, highlighted position
- **Compact:** List view, single line (name + description + stats)
- **Grid:** 2-3 columns on desktop, 1 column mobile
- **Detailed:** Expanded view with full README, changelog, dependencies

**Accessibility:**
- Card: `role="article"` with `<h3>` heading for plugin name
- ARIA label: "Plugin: Turnstile CAPTCHA by Marcus Liu, Official certification, updated 2 days ago"
- Keyboard: Tab to focus card, Enter to open details, Tab to action buttons
- Badge tooltip: `aria-label="Official Ixflare plugin, certified by core team"`
- Stats: Icons paired with text labels for screen readers

**Enhanced Features (from elicitation):**
- **Last Updated timestamp:** Shows "2d ago", "3w ago", warns if >12 months (likely abandoned)
- **Certification tooltip:** Hover badge explains "Official: Audited by core team, maintained by Ixflare"
- **Security audit badges:** npm audit status (✓ No vulnerabilities), OSSF scorecard, Snyk score
- **Install interaction:** Click Install → Copies `npm install @ixflare/turnstile`, shows toast confirmation

**Content Guidelines:**
- Description: One sentence, under 100 characters, focuses on what problem it solves
- Stats: Downloads/month (format: 1.2K, 45K, not raw numbers), GitHub stars, npm version
- Badge types: Official (gold), Community (silver), Deprecated (red warning)
- Author: Link to GitHub profile, shows avatar if available

**Interaction Behavior:**
- Click card (not button) → Open plugin detail page
- Click Install button → Copy install command, show toast "Copied to clipboard!"
- Click Documentation → Open docs in new tab
- Click GitHub → Open repo in new tab
- Hover card: Shows additional stats tooltip (total downloads, bundle size, license)
- Badge tooltip: Explains certification process, links to certification docs

**Mobile Considerations:**
- Single column layout
- Touch-friendly buttons (48px height)
- Swipe left on card to reveal secondary actions (GitHub, Report)
- Tap card to expand inline details (not navigate away)

**Internationalization:**
- Description translated per locale (if provided by plugin author)
- Stats labels: "downloads/mo" → "téléchargements/mois"
- Relative time: "2d ago" → "il y a 2j" (French)
- Button labels translated

---

### 6. Certification Badge Component

**Purpose:** Recognize contributors and certified developers, building credibility and encouraging participation through visible achievements.

**Usage:** Plugin cards, contributor profiles, tutorial completion certificates, release notes mentions, email signatures.

**Anatomy:**
```
┌─────────────────────┐
│  🏆                 │ ← Icon (varies by type)
│  Official Plugin    │ ← Badge name
│  Certified by       │ ← Subtext
│  Ixflare Team       │
│  Dec 2024           │ ← Earned date
└─────────────────────┘
```

**States:**
- **Earned:** Full color, animated on first display (trophy bounces in)
- **Locked:** Grayscale filter, shows requirements on hover tooltip
- **In Progress:** Partial fill (e.g., 3/5 criteria met, progress ring)

**Variants:**
- **Official Plugin:** Gold with lightning bolt icon (⚡)
- **Community Plugin:** Silver with heart icon (❤️)
- **Certified Developer:** Blue with graduation cap (🎓)
- **Core Contributor:** Green with code icon (</>)
- **First PR Merged:** Purple with rocket icon (🚀)
- **Course Completion:** Orange with book icon (📚)

**Accessibility:**
- ARIA label: "Certification badge: Official Plugin, earned December 2024"
- Tooltip on hover: Explains criteria, shows progress if locked
- Not just color: Icon + text + shape differentiate badge types
- Focus visible for keyboard navigation (2px outline)
- Animation respects prefers-reduced-motion

**Enhanced Features (from elicitation):**
- **Shareable badge:** Click generates markdown for README: `![Official Plugin](badge-url)`
- **Export formats:** React component, Web Component, SVG, PNG (for email/social)
- **Badge collection page:** User profile shows all earned badges, locked badges with progress

**Content Guidelines:**
- Badge name: 2-3 words maximum (Official Plugin, Core Contributor)
- Tooltip explains: "Earned by completing X, Y, Z" or "Unlock by doing A, B"
- Earned date: Month + Year format (Dec 2024)
- Share text: Pre-filled for social media "I earned [Badge Name] from @Ixflare!"

**Interaction Behavior:**
- Hover: Shows detailed tooltip (criteria, progress, how to earn)
- Click: Opens modal with full certification details, share options
- Locked badges: Click shows roadmap to earning
- Animation on first earn: Trophy bounces in, confetti burst (once per badge)
- Share button: Copies markdown or opens share dialog (platform-specific)

**Mobile Considerations:**
- Tap badge to see details (not hover)
- Share sheet integration (native iOS/Android share)
- Badge collection: Grid layout on mobile

**Internationalization:**
- Badge names translated ("Official Plugin" → "Plugin Officiel")
- Earned date: Locale date format (Dec 2024 vs 2024年12月)
- Share text translated with proper language

**External Use Cases:**
- **Email:** PNG export with alt text for accessibility
- **LinkedIn:** SVG badge for portfolio section
- **GitHub README:** Markdown badge with link back to Ixflare

---

### 7. Metrics Dashboard Component

**Purpose:** Give enterprise decision-makers confidence through transparent, real-time metrics on latency, cost, and community health.

**Usage:** Enterprise evaluation documentation, public status page, internal monitoring dashboards.

**Anatomy:**
```
┌─────────────────────────────────────────────┐
│ System Health                    ✅ Healthy │ ← Overall status
│                                  [Refresh]  │    Manual refresh
├─────────────────────────────────────────────┤
│ Global Latency (p95)                        │
│ EU: 45ms  ━━━━━━━━━━━━━━━━━━░░ vs 600ms    │ ← Bar + comparison
│ APAC: 38ms ━━━━━━━━━━━━━━━░░░ vs 800ms     │
│                                             │
│ Community Health                            │
│ ✓ Commit frequency: 4.2/week                │ ← Green (healthy)
│ ✓ Median response: 47min                    │
│ ⚠ Open issues: 23 (↑ from 18)             │ ← Yellow (attention)
│                                             │
│ Cost Savings                                │
│ $847/mo → $312/mo  (-63%)                   │ ← Dollar comparison
│                                             │
│ [Export PDF] [Export CSV] [View API]       │ ← Export options
└─────────────────────────────────────────────┘
```

**States:**
- **Healthy:** Green indicators, metrics within targets
- **Warning:** Yellow indicators, approaching thresholds
- **Critical:** Red indicators, action required immediately
- **Loading:** Skeleton screen with pulse while fetching data
- **Error:** "Unable to load metrics" with [Retry] button

**Variants:**
- **Overview:** Key metrics at a glance (default)
- **Detailed:** Click metric to expand time-series chart
- **Comparison:** Before/after migration side-by-side
- **Real-time:** Auto-refresh (Phase 2), updates via polling/WebSocket

**Accessibility:**
- Each metric: ARIA label "Global latency Europe: 45 milliseconds, 95th percentile, compared to 600 milliseconds before"
- Status icons: `aria-label="Healthy"` / "Warning" / "Critical"
- Charts: Accompanied by data table (show/hide toggle)
- Keyboard: Tab through metrics, Enter to expand to detailed view
- Screen reader: Announces metric changes on refresh

**Enhanced Features (from elicitation):**
- **Export capabilities:** PDF (executive report), CSV (spreadsheet), JSON API (programmatic access)
- **Embeddable:** iframe embed code or React component import for internal dashboards
- **Legend/key:** Tooltip explaining status colors and thresholds
- **Time range selector:** Last hour / 24h / week / month

**Content Guidelines:**
- Metrics: Clear labels with units (ms, %, $/mo, requests/s)
- Status: Traffic light colors (🔴🟡🟢) + explicit text
- Trends: Arrows showing direction (↑↓→) with % change
- Context: Provide comparison (vs. last week, vs. before migration, p95 vs p99)

**Interaction Behavior:**
- Hover metric: Tooltip with precise value and timestamp
- Click metric: Expands to full-screen chart with drill-down
- Manual refresh: Click [Refresh] button, shows "Updated 2s ago"
- Auto-refresh (Phase 2): Every 60s, with countdown indicator
- Export: Downloads file or displays API endpoint with authentication

**Mobile Considerations:**
- Vertical card stack on mobile
- Swipe between metric categories
- Tap metric to expand inline
- Simplified charts (fewer data points)

**Internationalization:**
- Metric labels translated
- Number formatting: 1,234.56 (US) vs 1.234,56 (EU)
- Currency: $ vs € vs ¥ based on locale
- Dates: MM/DD/YYYY vs DD/MM/YYYY

**Technical Implementation (from Architecture Decision):**
- **MVP:** Manual refresh, loads data on page load
- **Phase 2:** Polling (every 60s), with refresh indicator
- **Phase 3:** WebSocket for real-time updates (when infrastructure ready)

---

### 8. Interactive Code Editor Component

**Purpose:** Let tutorial users write and run code directly in the browser, creating hands-on learning without local setup friction.

**Usage:** Interactive tutorial modules, documentation playground, "Try It Live" examples.

**Anatomy:**
```
┌──────────────────────────────────────────┐
│ 📝 Exercise: Create your first user      │ ← Title
├──────────────────────────────────────────┤
│  1 const user = await User.create({     │ ← Editor
│  2   name: 'Alex'                        │    Line numbers
│  3 })                                    │    Syntax highlight
│  4                                       │    Editable
├──────────────────────────────────────────┤
│ [Run Code ▶]  [Reset]  [Hint 1/3]       │ ← Actions
├──────────────────────────────────────────┤
│ Output:                                  │ ← Results panel
│ ✓ User created with ID: 1               │
│                                          │
│ [Export Code] [Share URL]               │ ← Sharing
└──────────────────────────────────────────┘
```

**States:**
- **Editing:** Cursor active, syntax highlighting (Prism), basic autocomplete
- **Running:** Run button shows spinner, editor locked (dimmed), "Executing..."
- **Success:** Green checkmark, output shown in results panel
- **Error:** Red highlight on error line, clear message with hint
- **Hint Shown:** Yellow lightbulb icon with progressive hint text

**Variants:**
- **Tutorial Mode:** Pre-filled starter code, specific exercise goal
- **Playground:** Blank editor, full Ixflare API available, no constraints
- **Embedded:** Inline in docs (smaller, focused single example)
- **Multi-file (Phase 2):** Tabs for multiple files (routes/, models/)

**Accessibility:**
- ARIA: `role="textbox"` with `aria-multiline="true"`
- Keyboard shortcuts: Ctrl+Enter run, Ctrl+Z undo, Tab inserts 2 spaces
- Screen reader: Announces line numbers, syntax errors with line and column
- High contrast mode: Adjusts syntax highlighting for readability
- Font size: Respects browser zoom settings

**Enhanced Features (from elicitation):**
- **Progressive hints:** 3 levels (vague → specific → answer), click [Hint] cycles through
- **Export/Share:** Export to file (download .ts) or generate shareable URL (code persisted)
- **Sandboxing documentation:** Security model explained (server-side execution, no file system access, timeout limits)
- **Auto-save:** Code auto-saves to localStorage every 10s

**Content Guidelines:**
- Starter code: Enough context to be runnable, comments explain structure
- Exercise goal: Clear 1-sentence description in title
- Hints: Progressive disclosure (Hint 1: "Use the .create() method", Hint 2: "Pass an object with name property", Hint 3: Shows answer)
- Error messages: Friendly tone, actionable suggestion

**Interaction Behavior:**
- Type in editor: Live syntax highlighting (Prism.js)
- Run Code button: Sends code to server, executes safely, returns output
- Error handling: Highlights error line (red background), shows message below editor
- Hint button: Click cycles through 3 hint levels, shows progress "Hint 2/3"
- Reset button: Confirms "Reset to starter code?" before clearing user work
- Share URL: Generates permalink with code encoded in URL

**Mobile Considerations:**
- Virtual keyboard doesn't obscure output
- Simplified editor (no line numbers on small screens)
- Tap Run (larger button 48px)
- Output panel scrollable

**Internationalization:**
- Button labels translated (Run → Ejecutar)
- Hints translated per locale
- Error messages translated
- Code content language-neutral (JavaScript/TypeScript)

**Technical Implementation (from Architecture Decision):**
- **MVP:** Prism.js for syntax highlighting (20KB), server-side code execution (sandboxed)
- **Phase 2:** Upgrade to CodeMirror 6 (~200KB) for better editor features (autocomplete, linting)
- **Security:** Server-side execution in isolated Docker container, 5s timeout, no network access

---

### 9. Request Waterfall Component (Edge Telescope)

**Purpose:** Debug distributed edge requests by visualizing the complete request lifecycle across edge locations and services.

**Usage:** Edge Telescope debugging tool (Phase 3), performance profiling, production incident investigation.

**Anatomy:**
```
┌──────────────────────────────────────────────────────────┐
│ GET /api/users/123  [Tokyo Edge]  143ms  [Filter ▼]     │
├──────────────────────────────────────────────────────────┤
│ Edge Processing        ████░░░░░░░░░░░░░░░  8ms         │ ← Timeline
│ KV Lookup              ░░░░██░░░░░░░░░░░░░  2ms         │   bars
│ D1 Query (slow)        ░░░░░░████████░░░░░  24ms 🟡     │   color-coded
│ Durable Object Call    ░░░░░░░░░░░░██░░░░  4ms         │
│ Response Serialize     ░░░░░░░░░░░░░░████  8ms         │
│ Edge to Client         ░░░░░░░░░░░░░░░░███ 6ms         │
│                                                          │
│ [▼] Expand All  [Export HAR]  [Simple View]            │
├──────────────────────────────────────────────────────────┤
│ D1 Query Details: (expanded)                            │
│   Query: SELECT * FROM users WHERE id = ?               │
│   Rows: 1  Cache: MISS  Location: us-west1             │
│   Trace ID: 7a8f3c... [Copy] [View in Datadog →]       │
└──────────────────────────────────────────────────────────┘
```

**States:**
- **Overview:** All requests collapsed, color-coded by duration
- **Expanded:** Selected request shows detailed breakdown with metadata
- **Filtered:** Only matching requests shown (errors, >100ms, specific service)
- **Loading:** Shimmer effect on timeline bars while fetching traces
- **Error:** Red bar with error icon, error message on expand

**Variants:**
- **Timeline View:** Chronological list of requests (default)
- **Flamegraph (Phase 3):** Nested call stacks for deep traces
- **Comparison:** Side-by-side of two requests (A/B testing)
- **Heatmap:** Aggregate view of many requests showing patterns

**Accessibility:**
- ARIA: `role="tree"` for hierarchical request structure
- Keyboard: ↑↓ navigate requests, →← expand/collapse, Enter select, Tab to actions
- Screen reader: "Request 1 of 15, GET /api/users, 143 milliseconds total, expand for details"
- Color not sole indicator: Duration labels + icons (🔴🟡🟢)
- High contrast mode: Adjusts bar colors for visibility

**Enhanced Features (from elicitation):**
- **Filtering:** By status (errors only), duration (>50ms, >500ms), service (D1, KV, DO)
- **HAR export:** Download as HAR file for analysis in Chrome DevTools
- **Simple View toggle:** Beginner mode shows just total time + slowest operation
- **OpenTelemetry integration:** Trace IDs link to external APM (Datadog, New Relic)

**Content Guidelines:**
- Duration: Always show units (ms, μs for sub-millisecond)
- Status codes: 2xx (green), 4xx (yellow), 5xx (red)
- Service names: Consistent with Cloudflare (D1, KV, DO, not "Database", "Cache")
- Thresholds: >100ms yellow, >500ms red

**Interaction Behavior:**
- Click bar: Expand to show request details (query, parameters, response)
- Hover bar: Tooltip with exact timing and service name
- Drag timeline: Zoom into specific time window (Phase 3)
- Filter dropdown: Predefined filters (Slow, Errors, By Service)
- Export HAR: Downloads .har file compatible with Chrome DevTools

**Mobile Considerations:**
- Vertical timeline on mobile
- Tap bar to expand (no hover)
- Horizontal scroll for wide timelines
- Simplified view by default

**Internationalization:**
- Labels translated (Duration → Durée)
- Number formatting: 143ms vs 143 ms (locale-specific)
- Dates/times: Locale-appropriate format

**Technical Implementation (from Architecture Decision):**
- **Phase 3 component:** Dependent on Edge Telescope tracing infrastructure
- **Rendering:** Canvas API for performance with 100+ requests (not SVG)
- **Bundle size:** Custom implementation ~30KB (vs D3.js ~100KB)

---

### 10. Status Timeline Component

**Purpose:** Track enterprise POC progress and milestones, keeping stakeholders aligned on evaluation status with collaborative transparency.

**Usage:** Enterprise documentation "POC Progress" page, internal dashboards, onboarding checklists, CI/CD status displays.

**Anatomy:**
```
POC Timeline: Password Reset Migration

Week 1: Development            ✅ Completed
  ✓ Service migrated to Ixflare
  ✓ Deployed to staging
  ✓ Initial smoke tests passed
  💬 2 comments

Week 2: Security Testing       ✅ Completed
  ✓ SQL injection verified
  ✓ XSS mitigation confirmed
  ✓ CSRF tokens validated

Week 3: Performance Testing    ⏳ In Progress (60%)
  ✓ Stress test: 10K concurrent
  ⏳ Global latency measurement (ongoing)
  ⏸ Cost analysis (blocked on finance)
  💬 Add comment...

Week 4: Go/No-Go Decision      🔒 Locked
  (Unlocks after Week 3 complete)
```

**States:**
- **Completed:** Green checkmark (✅), collapsed by default, shows summary
- **In Progress:** Blue spinner (⏳), expanded, shows current tasks and progress %
- **Pending:** Gray, locked icon (🔒), not expandable, shows prerequisites
- **Blocked:** Red warning (🛑), shows blocker description and who can unblock
- **Skipped:** Dashed outline, dimmed (for optional phases)

**Variants:**
- **Linear:** Vertical timeline (default, best for mobile)
- **Gantt:** Horizontal with date ranges (desktop, project management view)
- **Checklist:** Simple list, no timeline visualization (minimal)
- **Roadmap:** Future-focused, shows upcoming milestones

**Accessibility:**
- ARIA: `role="list"` with `role="listitem"` for each phase
- Status icons: `aria-label="Completed"`, "In progress", "Locked"
- Keyboard: Tab navigate phases, Enter expand/collapse, Space toggle comment
- Screen reader: "Week 1, Development, Completed. 3 of 3 tasks done."
- Progress announced: "POC 60% complete, 3 of 5 phases done"

**Enhanced Features (from elicitation):**
- **Inline commenting:** Team members add comments per phase, threaded discussions
- **CI/CD integration hooks:** Auto-updates status when tests pass (webhook integration)
- **Timeline flexibility:** Manual dates or auto-adjusted based on actual completion

**Content Guidelines:**
- Phase names: Week-based (Week 1, Week 2) or milestone-based (Development, Testing, Launch)
- Tasks: Action-oriented past tense when complete (migrated, verified, tested)
- Status indicators: Clear icons (✅⏳🔒🛑)
- Blockers: Name who can unblock ("Blocked on Priya's security approval")

**Interaction Behavior:**
- Click phase: Expand/collapse task details
- Hover status icon: Tooltip with completion timestamp
- Pending items: Show prerequisites tooltip on hover
- In Progress: Updates in real-time if CI/CD integration active
- Completed: Can revisit details, comment thread visible
- Comment: Type, Enter to post, appears with username + timestamp

**Mobile Considerations:**
- Vertical timeline (always)
- Swipe phase to reveal comment button
- Tap to expand/collapse
- Simplified view (hide dates if tight space)

**Internationalization:**
- Phase names translated
- Dates: Locale-appropriate format
- Status text translated (Completed → Terminé)
- Comments language-neutral (user-generated content)

**Technical Implementation:**
- **Webhook integration:** POST to /api/timeline/update when CI passes
- **Comment storage:** Persisted to database, not localStorage
- **Real-time updates:** Polling (60s) or WebSocket for collaborative teams

---

## Component Implementation Strategy

**Foundation Principles:**

1. **Build on Design System Tokens:** All custom components use Tailwind utilities and design tokens (colors, spacing, typography) for consistency
2. **Accessibility First:** Every component includes automated tests (axe-core) and manual screen reader verification (VoiceOver + NVDA) before merge
3. **Responsive by Default:** Mobile-first design, components adapt to viewport size
4. **Performance Optimized:** <150KB total bundle for Phase 1, lazy load non-critical components
5. **Internationalization Ready:** No hardcoded strings, supports RTL layouts, respects locale formats
6. **Dark Mode Native:** All states designed for light AND dark modes, respects `prefers-color-scheme`

**Technology Stack (from Architecture Decisions):**

- **Framework:** React 18+ with TypeScript
- **Styling:** Tailwind CSS with custom design tokens
- **Base Components:** Headless UI for accessible primitives
- **Code Syntax:** Prism.js (MVP), upgrade to CodeMirror 6 (Phase 2)
- **Search:** Fuse.js client-side (MVP), Algolia (when docs >1,000 pages)
- **Testing:** Jest + React Testing Library + axe-core
- **Build:** Vite with tree-shaking and code splitting

**Quality Gates (from Cross-Functional War Room):**

Every component must pass before merge:
1. **Automated Tests:** Unit tests, integration tests, accessibility tests (axe-core)
2. **Manual Testing:** Screen reader demo video (VoiceOver + NVDA), 5 min max
3. **Performance:** Bundle size <50KB per component, Lighthouse score >90
4. **Code Review:** Two approvals, one from accessibility specialist
5. **Documentation:** Storybook story with all variants, props documented

**Component Library Structure:**
```
/packages/ui
  /components
    /terminal-output
      - TerminalOutput.tsx
      - TerminalOutput.test.tsx
      - TerminalOutput.stories.tsx
      - README.md
    /code-block
    /progress-stepper
    /search
    /plugin-card
    /badge
    /metrics-dashboard
    /code-editor
    /request-waterfall
    /status-timeline
  /utils (shared utilities)
  /hooks (shared React hooks)
  /tokens (design tokens)
```

---

## Implementation Roadmap

**Phase 1 - Foundation (Months 1-2) - MVP Launch**

**Critical Components (unlock first-time setup + docs discovery):**

1. **Terminal Output Component**
   - **Why first:** Enables CLI UX, critical for first-time setup flow
   - **Complexity:** Low-medium (styled console output, status indicators)
   - **Timeline:** 2 weeks (1 week dev, 3 days accessibility, 2 days testing)
   - **MVP scope:** Basic status indicators (✓✗→⚠), OS-specific errors, elapsed time

2. **Code Block with Copy Component**
   - **Why:** Needed everywhere (docs, errors, tutorial)
   - **Complexity:** Low (Prism syntax highlighting, clipboard API)
   - **Timeline:** 1.5 weeks
   - **MVP scope:** Copy button, syntax highlighting, basic themes

3. **Progress Stepper Component**
   - **Why:** Critical for tutorial onboarding flow
   - **Complexity:** Low-medium (state management, animations)
   - **Timeline:** 2 weeks
   - **MVP scope:** Linear progress, localStorage persistence, collapsible

4. **Search with Instant Results Component**
   - **Why:** Documentation discovery, reduces support burden
   - **Complexity:** Medium (Fuse.js integration, keyboard shortcuts)
   - **Timeline:** 3 weeks
   - **MVP scope:** Client-side search, keyboard nav (⌘K), fuzzy matching

**Phase 1 Total:** 8.5 weeks with 2 engineers working in parallel

**Phase 1 Deliverables:**
- ✅ 4 production-ready components
- ✅ Storybook documentation
- ✅ Accessibility certified (WCAG 2.1 AA)
- ✅ Mobile responsive
- ✅ Dark mode support

---

**Phase 2 - Community (Months 3-4) - Plugin Ecosystem**

**Community & Learning Components:**

5. **Plugin Card Component**
   - **Why:** Plugin directory launch, ecosystem growth
   - **Complexity:** Medium (API integration, security badges)
   - **Timeline:** 2 weeks
   - **Scope:** Certification badges, download stats, security audit status

6. **Certification Badge Component**
   - **Why:** Recognition system, encourages contribution
   - **Complexity:** Low (SVG generation, export formats)
   - **Timeline:** 1 week
   - **Scope:** Multiple badge types, shareable formats (React, Web Component, PNG)

7. **Interactive Code Editor Component**
   - **Why:** Enhanced tutorial experience, hands-on learning
   - **Complexity:** High (editor integration, server-side execution)
   - **Timeline:** 4 weeks (complex, security critical)
   - **MVP scope:** Prism highlighting, server-side execution, progressive hints
   - **Phase 3 upgrade:** CodeMirror 6 with autocomplete

8. **Status Timeline Component**
   - **Why:** Enterprise POC tracking, stakeholder alignment
   - **Complexity:** Medium (state management, commenting, CI/CD hooks)
   - **Timeline:** 2.5 weeks
   - **Scope:** Collaborative comments, webhook integration, progress tracking

**Phase 2 Total:** 9.5 weeks

**Phase 2 Deliverables:**
- ✅ Plugin ecosystem infrastructure
- ✅ Interactive learning experience
- ✅ Enterprise POC tooling

---

**Phase 3 - Advanced (Months 5-6) - Debugging & Enterprise**

**Advanced Debugging & Metrics Components:**

9. **Request Waterfall Component**
   - **Why:** Edge Telescope launch, distributed debugging
   - **Complexity:** High (Canvas rendering, trace visualization)
   - **Timeline:** 5 weeks (dependent on Edge Telescope tracing infrastructure)
   - **Scope:** Timeline visualization, filtering, HAR export, OpenTelemetry integration
   - **Prerequisite:** Edge Telescope backend tracing ready

10. **Metrics Dashboard Component**
   - **Why:** Enterprise transparency, build trust through data
   - **Complexity:** Medium-high (charting, real-time updates, export)
   - **Timeline:** 3 weeks
   - **MVP scope:** Manual refresh, static charts, export (PDF/CSV)
   - **Phase 3 upgrade:** Polling, WebSocket real-time updates

**Phase 3 Total:** 8 weeks

**Phase 3 Deliverables:**
- ✅ Advanced debugging tooling
- ✅ Enterprise metrics transparency
- ✅ Real-time monitoring capabilities

---

## Total Implementation Timeline

- **Phase 1 (MVP):** 2 months - 4 components
- **Phase 2 (Community):** 2 months - 4 components
- **Phase 3 (Advanced):** 2 months - 2 components
- **Total:** 6 months for all 10 custom components

**Team:** 2 frontend engineers + 1 accessibility specialist (consulting)

---

## Critical Success Factors

**From User Persona Focus Group:**
- Jordan needs keyboard shortcuts and power-user features (not just mouse)
- Alex needs progressive disclosure and beginner-friendly defaults
- Sarah needs enterprise features (export, security, audit trails)

**From Devil's Advocate Challenges:**
- ✅ Mobile-first design (all components responsive)
- ✅ Internationalization ready (i18n strings, RTL support)
- ✅ Dark mode native (not afterthought)
- ✅ Real accessibility (user testing, not checklists)
- ✅ Performance budgets enforced (<150KB Phase 1)
- ✅ Framework escape hatches (Web Components for external use)

**From Architecture Decisions:**
- ✅ React + TypeScript stack (internal use case)
- ✅ Two-tier accessibility testing (automated + manual)
- ✅ Controlled/uncontrolled component APIs (flexibility)
- ✅ <50KB per component gzipped
- ✅ Progressive enhancement (MVP → Phase 2 → Phase 3 upgrades)

---

This component strategy balances ambition with pragmatism: We build what's essential first (Phase 1), validate with users, then expand based on feedback. Each component is specified for accessibility, performance, and internationalization from day one—not retrofitted later.
