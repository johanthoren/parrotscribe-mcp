# Pair Programming Context Prompt

Real-time context extraction for pair programming sessions.

## MCP Prompt Definition

```typescript
{
  name: "pair-programming",
  description: "Monitors pair programming session for real-time code suggestions and context.",
  arguments: [
    {
      name: "focus_area",
      description: "Current file or feature being worked on (for relevant filtering)",
      required: false,
    },
  ],
}
```

## Prompt Template

```
Monitor the pair programming session and extract actionable context.

Polling strategy:
1. Call pscribe_tail with n=20 for recent context
2. Track since_line for incremental updates
3. Focus on confirmed (C) entries

Extract and track:

## Recent Suggestions
Code changes or approaches discussed in the last few minutes:
- [suggestion with context]

## TODOs Mentioned
"We should also..." or "Don't forget to..." moments:
- [ ] [task mentioned]

## Questions Raised
Open technical questions needing resolution:
- [question] - [resolved/open]

## Decisions Made
Choices between alternatives:
- Chose [option] because [reason]

## Current Context
What the pair is actively working on:
- File/area: [if mentioned]
- Goal: [immediate objective]
- Approach: [strategy being used]

---

Notes:
- M = microphone (navigator giving suggestions)
- S = system audio (driver implementing)
- Real-time: prioritize recent entries
- Flag "implement what we just discussed" opportunities
```

## Example Output

```markdown
## Recent Suggestions (last 5 min)

1. "Add a try-catch around the API call"
   - Context: Discussing error handling for fetch
   - Mentioned ~2 min ago

2. "We should use a guard clause instead of nested if"
   - Context: Refactoring validateUser function
   - Mentioned ~4 min ago

## TODOs Mentioned

- [ ] Add logging for debugging
- [ ] Write tests after this works
- [ ] Check if there's a utility for this already

## Questions Raised

- "Should we use async/await or promises here?" - Decided async/await
- "What's the timeout for this API?" - OPEN

## Decisions Made

- Using `fetch` instead of `axios` because: "fewer dependencies"
- Keeping validation in the component because: "it's form-specific"

## Current Context

- **File**: `src/components/UserForm.tsx`
- **Goal**: Add email validation with API check
- **Approach**: Client-side regex first, then API uniqueness check

---

**Action opportunity**: The pair discussed adding error handling 2 minutes ago but hasn't implemented it yet.
```

## Real-Time Usage Pattern

```typescript
// Poll for updates every 30 seconds during active pairing
async function monitorPairSession() {
  let lastLine = 0;

  while (sessionActive) {
    const result = await pscribe_tail({ since_line: lastLine + 1 });
    lastLine = result.metadata.last_line;

    // Process new entries
    if (result.entries.length > 0) {
      extractContext(result.entries);
    }

    await sleep(30000);
  }
}
```

## Integration Notes

- Poll frequently (30s-60s) for real-time awareness
- Surface suggestions when driver pauses typing
- "Implement what we discussed" triggers on specific phrases
- Less useful for historical analysis - designed for in-session
