# Standup Summary Prompt

Extracts structured standup updates from a meeting transcript.

## MCP Prompt Definition

```typescript
{
  name: "standup",
  description: "Extracts structured standup updates (yesterday, today, blockers) from meeting transcript.",
  arguments: [
    {
      name: "team_members",
      description: "Comma-separated names of team members (helps attribute updates)",
      required: false,
    },
  ],
}
```

## Prompt Template

```
Extract standup updates from the ParrotScribe transcript.

Use pscribe_tail to fetch the transcript (or use the provided transcript below).

For each speaker, extract:
- YESTERDAY: What they accomplished
- TODAY: What they plan to work on
- BLOCKERS: Any impediments mentioned

Output format:
## [Speaker Name or M/S indicator]

**Yesterday:**
- [accomplishment 1]
- [accomplishment 2]

**Today:**
- [planned work 1]
- [planned work 2]

**Blockers:**
- [blocker or "None mentioned"]

---

Notes:
- M = microphone (local speaker)
- S = system audio (remote participants)
- Focus on confirmed (C) entries for accuracy
- Group updates by speaker where identifiable
```

## Example Output

```markdown
## Remote Participant (S)

**Yesterday:**
- Completed the API refactoring for user authentication
- Fixed the flaky integration test

**Today:**
- Starting on the payment integration
- Will pair with Sarah on the database schema

**Blockers:**
- Waiting for access to the staging environment

---

## Local (M)

**Yesterday:**
- Reviewed the PR for feature flags
- Updated documentation

**Today:**
- Working on the CLI improvements
- Will address PR feedback

**Blockers:**
- None mentioned
```

## Integration Notes

- Best used after standup completes (`pscribe_stop` first)
- Can be invoked mid-meeting for real-time extraction
- Combine with ticket system integration to auto-update status
