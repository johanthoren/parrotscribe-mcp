# ParrotScribe MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that enables AI agents to interact with the [ParrotScribe](https://parrotscribe.com) transcription service on macOS. It acts as a bridge between the `pscribe` CLI and AI agents like Claude Desktop, Claude Code, or any MCP-compatible client.

## What It Does

ParrotScribe captures real-time audio from your microphone and system audio, transcribes it using Whisper, and this MCP server exposes that transcription data to AI agents. This enables workflows like:

- **Meeting Monitor**: AI monitors a live call and surfaces relevant information
- **Action Item Tracker**: AI detects commitments and prepares follow-up actions
- **Real-time Researcher**: AI looks up technical terms mentioned in conversation
- **Session Summarizer**: AI generates structured summaries after calls

## Prerequisites

- **macOS** with [ParrotScribe](https://parrotscribe.com) installed
- **Node.js** 18 or higher
- The `pscribe` CLI must be available in your PATH

## Installation

### Option 1: NPX (Recommended)

No installation needed. Configure your AI agent to run:

```
npx @johanthoren/parrotscribe-mcp-server
```

### Option 2: Global Install

```bash
npm install -g @johanthoren/parrotscribe-mcp-server
```

Then run with:

```
parrotscribe-mcp-server
```

### Option 3: From Source

```bash
git clone https://github.com/johanthoren/parrotscribe-mcp.git
cd parrotscribe-mcp
npm install
npm run build
node dist/index.js
```

## Configuration

### Claude Desktop

Add to your `claude_desktop_config.json` (typically at `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "parrotscribe": {
      "command": "npx",
      "args": ["@johanthoren/parrotscribe-mcp-server"]
    }
  }
}
```

### Claude Code

Add to your project's `.mcp.json` or global MCP config:

```json
{
  "mcpServers": {
    "parrotscribe": {
      "command": "npx",
      "args": ["@johanthoren/parrotscribe-mcp-server"]
    }
  }
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PSCRIBE_PATH` | Path to the `pscribe` executable | `pscribe` |

## Available Tools

| Tool | Description |
|------|-------------|
| `pscribe_start` | Start real-time audio transcription |
| `pscribe_stop` | Stop/pause the current transcription |
| `pscribe_status` | Get service status, session ID, duration |
| `pscribe_tail` | Get recent transcript entries with filtering |
| `pscribe_cat` | Display complete sessions with time-based filtering |
| `pscribe_sessions` | List past transcription sessions |
| `pscribe_new` | Force start a new session |

### pscribe_tail Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `n` | number | Number of entries to return (default: 10) |
| `since_line` | number | Start from line N (for polling) |
| `status` | string | Filter: `all`, `confirmed`, `unconfirmed`, `translated`, `speech` |
| `session_id` | string | Read from a specific session |

### pscribe_cat Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `session_ids` | string[] | Session IDs to display (from pscribe_sessions) |
| `since` | string | Show sessions starting after this ISO8601 timestamp |
| `until` | string | Show sessions starting before this ISO8601 timestamp |
| `last` | number | Show last N sessions |
| `status` | string | Filter: `all`, `confirmed`, `unconfirmed`, `speech` |

Use `pscribe_cat` for historical queries like "summarize yesterday's standup" - the AI converts natural language time references to ISO8601.

## Output Format: TOON

The server returns transcript data in [TOON format](https://github.com/toon-format/toon), a token-efficient format designed for LLM consumption:

```
transcript{timestamp,source,status,segment,confidence,duration,language,text}:
  2024-01-15T14:30:00+01:00,M,C,1,0.95,2.5,en,Hello world
  2024-01-15T14:30:05+01:00,S,C,2,0.92,3.1,sv,Hej dar
```

### Fields

| Field | Description |
|-------|-------------|
| `timestamp` | ISO8601 with timezone |
| `source` | `M` (microphone), `S` (system audio), `E` (events) |
| `status` | `C` (confirmed), `U` (unconfirmed), `T` (translated), `N` (no_speech) |
| `segment` | Incrementing segment number |
| `confidence` | Whisper confidence score (0.0-1.0) |
| `duration` | Segment duration in seconds |
| `language` | ISO 639-1 code (e.g., `en`, `sv`, `de`) |
| `text` | Transcribed content |

## Polling Strategy

For real-time monitoring, agents should:

1. Call `pscribe_status` to ensure a session is active
2. Call `pscribe_tail` with `n: 10` to get initial context
3. Note the `last_line` number from the response metadata
4. Periodically call `pscribe_tail` with `since_line: last_line + 1`
5. Use `status: "confirmed"` to focus on finalized transcriptions

## Example Prompts

See the `examples/` directory for ready-to-use prompts:

- **standup.md**: Daily standup meeting assistant
- **retro.md**: Sprint retrospective facilitator
- **code-review.md**: Code review meeting tracker
- **pair-programming.md**: Pair programming session monitor
- **adr.md**: Architecture Decision Record generator

## Security & Privacy

- **Local-Only**: Data flows exclusively from the local `pscribe` CLI to the local AI agent via stdio
- **Zero-Cloud**: No analytics, no telemetry, no intermediate servers
- **User Control**: You decide when transcription is active and which AI agent receives the data

## Development

```bash
# Install dependencies
npm install

# Development mode (auto-reload)
npm run dev

# Build
npm run build

# Test with MCP inspector
npm run inspect
```

## License

MIT

## Links

- [ParrotScribe App](https://parrotscribe.com)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [TOON Format](https://github.com/toon-format/toon)
