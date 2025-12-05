# Journey Patterns

Across all six flows, common patterns emerged that should be standardized throughout Ixflare:

## Navigation Patterns

**Progressive Disclosure Pattern**
- Start with simplest path (Quick Start → Tutorial → Deep Dive)
- User controls depth (skip tutorial if experienced)
- Always provide "escape hatches" to advanced content
- Visual progress indicators show current location

**Contextual Help Pattern**
- Inline docs links from error messages
- Hover previews for related concepts
- "Learn more" expands without leaving page
- Search scoped to current section first

**Breadcrumb Pattern**
- Clear path back to previous decision points
- "Return to tutorial" from any detour
- Save progress, resume later
- No dead ends without exit path

## Decision Patterns

**Guided Choice Pattern**
- Present 2-4 options maximum (avoid paralysis)
- Each option: Label + Description + "Best for..." guidance
- "Recommended" highlighted for common use case
- "Not sure? Take quiz" for uncertain users

**Risk Mitigation Pattern**
- Preview consequences before committing ("This will...")
- Easy undo/rollback for reversible decisions
- Clear warnings for destructive actions
- "Try in preview" option before production

**Expertise Adaptation Pattern**
- Detect experience level: First visit, quiz, self-select
- Jordan (senior): Concise, technical, assume knowledge
- Alex (junior): Explanatory, analogies, concepts first
- Sarah (enterprise): Security, compliance, architecture focus

## Feedback Patterns

**Immediate Feedback Pattern**
- Actions have instant visual response (<200ms)
- Success: Green checkmark + celebration
- In Progress: Spinner + estimated time
- Error: Red X + actionable suggestion (not just "failed")

**Emotional Resonance Pattern**
- Acknowledge feelings: "Confused? That's normal here!"
- Celebrate wins: Emoji, "You did it!", progress bars
- Reduce anxiety: "No judgment" culture, "Great question!"
- Build confidence: "You're making progress" affirmations

**Educational Feedback Pattern**
- Errors teach, don't scold: "Forgot to..." not "Missing..."
- Wrong answers: "Close! Here's why..." not "Incorrect"
- Hints before answers: Progressive disclosure of help
- Learn by doing: Interactive examples, not walls of text

## Recovery Patterns

**Gentle Failure Pattern**
- Errors never dead-end (always have "Next step: ...")
- Clear cause + effect: "Because X, Y failed. Try Z."
- Preserve user work: Don't lose form data on error
- Retry easily: One-click retry, not start from scratch

**Community Escape Hatch Pattern**
- Every stuck point: "Still stuck? Ask Discord"
- Response time expectations: "Usually <2 hours"
- File issue option: "Help us improve this doc"
- Human fallback: When automation fails, people help

**Progressive Help Pattern**
1. Inline hint (tooltip, suggestion)
2. Expandable explanation ("Learn more")
3. Related docs link
4. "Ask community" CTA
5. "Request feature" for unsupported use cases

---
