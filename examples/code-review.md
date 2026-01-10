# Code Review Capture Prompt

Captures code review feedback, decisions, and action items from a meeting transcript.

## MCP Prompt Definition

```typescript
{
  name: "code-review",
  description: "Captures code review feedback, decisions, and action items from meeting transcript.",
  arguments: [
    {
      name: "pr_url",
      description: "URL of the pull request being reviewed (for context)",
      required: false,
    },
  ],
}
```

## Prompt Template

```
Extract code review feedback from the ParrotScribe transcript.

Use pscribe_tail to fetch the transcript (or use the provided transcript below).

Identify and structure:

## Decisions
- Changes approved or rejected
- Architectural choices made
- Scope adjustments agreed upon

## Feedback
Specific code suggestions mentioned. For each:
- What to change
- File/area mentioned (if any)
- Reasoning given

## Action Items
Follow-up tasks identified:
- [ ] [task] - [owner if mentioned]

## Open Questions
Technical questions that weren't resolved:
- [question]

## Key Rationale
Important "why" explanations for decisions made:
- [decision]: [reasoning]

---

Notes:
- M = microphone (local speaker, likely the author)
- S = system audio (remote reviewers)
- Focus on confirmed (C) entries for accuracy
- Capture specific file/line references if mentioned
- Note tone: nitpicks vs blocking issues
```

## Example Output

```markdown
## Decisions

- **Approved**: New error handling pattern using Result types
- **Rejected**: Proposed caching layer - too complex for current scope
- **Scope change**: Split the PR into auth changes and refactoring

## Feedback

1. **Extract validation logic**
   - Move input validation from controller to separate validator class
   - File: `src/controllers/UserController.ts`
   - Reason: Easier to unit test

2. **Add error codes**
   - Use structured error codes instead of string messages
   - Area: Error handling throughout
   - Reason: Better client-side handling

3. **Minor: Naming**
   - Rename `handleStuff` to `processUserRequest`
   - This is a nitpick, not blocking

## Action Items

- [ ] Split PR into two smaller PRs - @author
- [ ] Add unit tests for validation logic - @author
- [ ] Update API documentation - @author
- [ ] Review security implications of new auth flow - @security-team

## Open Questions

- Should we use the existing event system or create a new one?
- What's the performance impact of the new validation?

## Key Rationale

- **Result types over exceptions**: "Exceptions hide control flow, Result types make error handling explicit in the type signature"
- **No caching layer**: "Premature optimization, let's measure first before adding complexity"
```

## Integration Notes

- Use after review meeting ends for comprehensive capture
- Can generate PR comment draft from structured output
- Pairs well with `gh pr comment` for automation
