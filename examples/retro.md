# Retrospective Prompt

Extracts retrospective outcomes and action items from meeting transcript.

## MCP Prompt Definition

```typescript
{
  name: "retro",
  description: "Extracts retrospective outcomes (what went well, improvements, actions) from meeting transcript.",
  arguments: [
    {
      name: "sprint_name",
      description: "Name or number of the sprint (for context)",
      required: false,
    },
  ],
}
```

## Prompt Template

```
Extract retrospective outcomes from the ParrotScribe transcript.

Use pscribe_tail to fetch the transcript (or use the provided transcript below).

Structure the output following a standard retro format:

## What Went Well
Things to celebrate and continue:
- [positive outcome]
  - Quote: "[relevant transcript excerpt if memorable]"

## What Could Improve
Issues or pain points identified:
- [issue]
  - Impact: [how it affected the team]
  - Frequency: [one-time or recurring]

## Action Items
Specific commitments with ownership:
- [ ] [action] - Owner: [name if mentioned] - Due: [date if mentioned]

## Experiments
Things to try next sprint:
- [experiment to run]
  - Success criteria: [how to measure]

## Patterns Noticed
Recurring themes across retros (if this context exists):
- [pattern]

---

Notes:
- Focus on confirmed (C) entries for accuracy
- Capture specific examples mentioned
- Note when actions have explicit owners
- Flag recurring issues that appeared in previous retros
```

## Example Output

```markdown
## What Went Well

- **Pair programming on complex features**
  - Quote: "The pairing session on the payment integration saved us days of debugging"

- **New testing strategy**
  - The integration tests caught two bugs before production

- **Better async communication**
  - Stand-up doc worked well for timezone differences

## What Could Improve

- **Deploy process is too slow**
  - Impact: 45-minute deploys blocking urgent fixes
  - Frequency: Every release

- **Unclear requirements on the dashboard feature**
  - Impact: Two days of rework after PM review
  - Frequency: First time with this PM

- **Too many meetings**
  - Impact: Fragmented focus time
  - Frequency: Ongoing concern

## Action Items

- [ ] Investigate parallel test execution - Owner: @devops - Due: Next sprint
- [ ] Create requirements checklist for features - Owner: @pm - Due: Before next planning
- [ ] Trial "no meeting Wednesday" - Owner: @team-lead - Due: Next week
- [ ] Document deploy process improvements - Owner: @unassigned

## Experiments

- **Async standups for one week**
  - Success criteria: Team feels informed, saved time

- **Mob programming for architecture decisions**
  - Success criteria: Faster consensus, better knowledge sharing

## Patterns Noticed

- Deploy speed has been raised in 3 of last 5 retros
- Requirement clarity is a new issue - may need process change
```

## Integration Notes

- Best used after retro meeting ends
- Can auto-create tickets for action items
- Track patterns across retros with historical search (future feature)
- Consider tagging actions by category (process, tooling, communication)
