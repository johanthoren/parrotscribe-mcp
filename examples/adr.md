# Architecture Decision Record Prompt

Generates ADR documents from architecture discussion transcripts.

## MCP Prompt Definition

```typescript
{
  name: "adr",
  description: "Generates Architecture Decision Record (ADR) from meeting transcript.",
  arguments: [
    {
      name: "decision_title",
      description: "Title of the decision (e.g., 'Use PostgreSQL for main database')",
      required: false,
    },
  ],
}
```

## Prompt Template

```
Generate an Architecture Decision Record from the ParrotScribe transcript.

Use pscribe_tail to fetch the transcript (or use the provided transcript below).

Follow the standard ADR format:

# ADR-[NUMBER]: [Title]

**Date**: [today's date]
**Status**: [Proposed | Accepted | Deprecated | Superseded]
**Deciders**: [participants if identifiable]

## Context

What prompted this decision? What's the problem or opportunity?
- Background situation
- Constraints mentioned
- Requirements driving the decision

## Options Considered

### Option 1: [Name]
- Description
- Pros mentioned
- Cons mentioned

### Option 2: [Name]
- Description
- Pros mentioned
- Cons mentioned

[Additional options...]

## Decision

**Chosen option**: [option name]

**Rationale**: Why this option was selected. Capture the key arguments.

## Consequences

### Positive
- Benefits expected

### Negative
- Trade-offs accepted
- Risks acknowledged

### Neutral
- Changes required but not good/bad

## Follow-up Actions
- [ ] [task to implement decision]

---

Notes:
- Focus on confirmed (C) entries for accuracy
- Capture direct quotes for important rationale
- Note dissenting opinions if raised
- Flag any unresolved concerns
```

## Example Output

```markdown
# ADR-007: Use Redis for Session Storage

**Date**: 2025-01-09
**Status**: Accepted
**Deciders**: Backend team (3 participants identified in transcript)

## Context

The current in-memory session storage doesn't work with our multi-instance deployment. We need a shared session store that:
- Supports our load-balanced setup
- Handles 10k concurrent users
- Provides sub-millisecond latency
- Allows session inspection for debugging

The team discussed this after the incident where users lost sessions during a deploy.

## Options Considered

### Option 1: Redis (Managed)
- AWS ElastiCache Redis cluster
- Pros: "Fast, battle-tested, team has experience"
- Cons: "Another managed service to pay for"

### Option 2: PostgreSQL
- Store sessions in existing database
- Pros: "No new infrastructure"
- Cons: "Polling overhead, slower than Redis"

### Option 3: JWT with No Server Storage
- Stateless tokens
- Pros: "No storage needed"
- Cons: "Can't invalidate sessions, size limits"

## Decision

**Chosen option**: Redis (Managed - AWS ElastiCache)

**Rationale**:
> "Redis gives us the performance we need, and three of us have run it in production before. The managed version removes operational burden."

The team prioritized:
1. Performance for user experience
2. Operational simplicity
3. Team familiarity

## Consequences

### Positive
- Sessions survive deploys
- Can scale instances independently
- Session debugging via Redis CLI

### Negative
- Additional infrastructure cost (~$50/month for dev, $200/month for prod)
- New dependency to monitor

### Neutral
- Need to update deployment scripts
- Add Redis health check to monitoring

## Follow-up Actions
- [ ] Set up ElastiCache cluster in staging
- [ ] Update session middleware to use Redis
- [ ] Add Redis to health check endpoint
- [ ] Update runbook for session-related issues
```

## Integration Notes

- Best used after architecture discussion ends
- Output can be saved directly as `docs/adr/ADR-XXX.md`
- Consider version control integration to track decision history
- Link to related ADRs when superseding previous decisions
