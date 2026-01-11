# Specification: ParrotScribe MCP Server

## Overview
The ParrotScribe MCP (Model Context Protocol) server enables AI agents (like OpenCode, Claude Code, or Claude Desktop) to interact with the ParrotScribe transcription service on macOS. It acts as a bridge between the `pscribe` CLI and the MCP protocol, allowing agents to start/stop transcription, monitor live transcripts, and manage sessions.

## Core Vision: The "Speech-to-Action" Hub
The primary use case is real-time AI augmentation during live conversations, serving as a **universal speech sensor** for the MCP ecosystem.

### Key Workflows:
1. **The Monitor**: User runs a command like `/monitor-call`. The agent starts a session and polls the transcript.
2. **The Researcher**: Agent detects a technical term or a claim and proactively queries other MCP servers (Docs, Web Search, Case Files).
3. **The Actuator**: Agent identifies commitments (e.g., "I'll send the contract") and prepares the action in another tool (GitHub, Slack, CRM).
4. **The Scribe**: Agent generates a structured, high-accuracy summary or "SOAP note" immediately after the call ends.

## Technical Architecture

- **Language**: TypeScript / Node.js
- **Transport**: `stdio` (standard input/output) for local agent compatibility.
- **Backend**: Wraps the `pscribe` CLI tool.
- **Communication**: Uses `child_process.execSync` or `spawn` to call `pscribe`.

## Tools to Implement

| Tool Name | CLI Command | Description |
|-----------|-------------|-------------|
| `pscribe_start` | `pscribe start` | Starts transcription (mic + system audio). |
| `pscribe_stop` | `pscribe stop` | Stops/pauses the current transcription. |
| `pscribe_status` | `pscribe status` | Returns service status, active session ID, and duration. |
| `pscribe_tail` | `pscribe tail` | Returns transcript entries. Supports `since_line` for polling. |
| `pscribe_cat` | `pscribe cat` | Returns complete sessions with time-based filtering. |
| `pscribe_sessions`| `pscribe list` | Lists past transcription sessions. |
| `pscribe_new` | `pscribe new` | Forces the start of a new transcription session. |

## Tool Details

### `pscribe_tail`
**Input Schema**:
```typescript
{
  n: z.number().int().min(1).default(10).describe("Number of entries to show"),
  since_line: z.number().int().min(1).optional().describe("Start from this line number"),
  status: z.enum(["all", "confirmed", "unconfirmed", "translated", "speech"]).default("all").describe("Filter by segment status"),
  session_id: z.string().optional().describe("Session ID to read (from pscribe_sessions). Default: current session.")
}
```
**Output**:
Returns transcript entries in TOON format.

**Parameters**:
- `n`: Number of recent entries to return (default: 10)
- `since_line`: Start from line N (for polling new entries)
- `status`: Filter by segment status:
  - `all`: All segments (default)
  - `confirmed`: Only confirmed transcriptions
  - `unconfirmed`: Only unconfirmed (tentative) transcriptions
  - `translated`: Only translated entries
  - `speech`: Confirmed, unconfirmed, and translated (excludes no_speech)

### `pscribe_cat`
**Input Schema**:
```typescript
{
  session_ids: z.array(z.string()).optional().describe("Session IDs to display"),
  since: z.string().optional().describe("Show sessions starting after this ISO8601 timestamp"),
  until: z.string().optional().describe("Show sessions starting before this ISO8601 timestamp"),
  last: z.number().int().min(1).optional().describe("Show last N sessions"),
  status: z.enum(["all", "confirmed", "unconfirmed", "speech"]).default("confirmed").describe("Filter by segment status")
}
```
**Output**:
Returns complete transcript sessions in TOON format.

**Parameters**:
- `session_ids`: Specific session IDs to display (from `pscribe_sessions`)
- `since`: ISO8601 timestamp - show sessions starting after this time
- `until`: ISO8601 timestamp - show sessions starting before this time
- `last`: Show last N sessions
- `status`: Filter by segment status (default: confirmed)

**Use Cases**:
- Historical queries: "summarize yesterday's standup" → `since: "2024-01-14T09:00:00+01:00", until: "2024-01-14T10:00:00+01:00"`
- Recent sessions: "what was discussed last week" → `since: "2024-01-08T00:00:00+01:00"`
- Specific sessions: retrieve by ID from `pscribe_sessions`

## Configuration
The server can be configured via environment variables:
- `PSCRIBE_PATH`: Path to the `pscribe` executable (defaults to `pscribe`).

## Data Formats

### TOON Format
The server returns transcript data in [TOON format](https://github.com/toon-format/toon) - a token-efficient format designed for LLM consumption.

**Structure:**
```
transcript{timestamp,source,status,segment,confidence,duration,language,text}:
  2024-01-15T14:30:00+01:00,M,C,1,0.95,2.5,en,Hello world
  2024-01-15T14:30:05+01:00,S,C,2,0.92,3.1,sv,Hej där
```

**Fields:**
| Field | Description |
|-------|-------------|
| `timestamp` | ISO8601 with timezone offset |
| `source` | `M` (microphone), `S` (system audio), `E` (events) |
| `status` | `C` (confirmed), `U` (unconfirmed), `T` (translated), `N` (no_speech) |
| `segment` | Incrementing segment number |
| `confidence` | Whisper confidence score (0.0-1.0) |
| `duration` | Segment duration in seconds |
| `language` | ISO 639-1 language code (e.g., `en`, `sv`, `de`) |
| `text` | Transcribed text (TOON-encoded) |

**Status Behavior:**
- `U` (unconfirmed): May appear multiple times per segment as transcription refines
- `C` (confirmed): Appears once per segment when transcription is finalized
- `T` (translated): Appears once per segment, contains English translation of the `C` entry (uses Apple on-device translation)
- `N` (no_speech): Indicates detected silence or non-speech audio

### Status Output
- **`pscribe_status`**: Returns service status including active session info.

## Resources
The server exposes the following resources:
- `pscribe://current/transcript`: The live transcript of the active session (last 100 entries in TOON format).

## Prompts
- `summarize-session`: Summarizes the current or a specific transcription session.
- `monitor-call`: Sets up a polling loop to monitor a call for specific keywords or action items.

## Error Handling
The server wraps `pscribe` CLI errors. Common error scenarios:
- **CLI Missing**: If `pscribe` is not in the PATH, the server will return a descriptive error.
- **Microphone Access**: If macOS denies microphone access, `pscribe` will fail; the MCP server reports this error back to the agent.
- **Invalid Session**: Requesting a tail or status when no session is active.

## Polling Strategy
Agents should implement a polling loop for real-time monitoring:
1. Call `pscribe_status` to ensure a session is active.
2. Call `pscribe_tail` with `n: 10` to get initial context.
3. Track the last segment number received.
4. Periodically call `pscribe_tail` with `since_line` set to `last_segment + 1`.
5. Use `status: "confirmed"` to focus on finalized transcriptions.
6. Process new entries for triggers, summaries, or action items.

## Project Structure
```
parrotscribe-mcp/
├── src/
│   └── index.ts          # Main MCP server implementation
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── SPEC.md               # This specification
```

## Dependencies
- `@modelcontextprotocol/sdk`: Core MCP functionality.
- `zod`: Schema validation for tool inputs.
- `pscribe` CLI: Must be installed and available in the system PATH.

## Installation & Local Setup

### 1. Prerequisites
- **ParrotScribe CLI**: Must be installed and available in your PATH.
- **Node.js**: Version 18 or higher.

### 2. Build the Server
```bash
# Install dependencies
npm install

# Compile TypeScript to JavaScript
npm run build
```

### 3. Configure for AI Agents

#### Claude Desktop
Add the following to your `claude_desktop_config.json` (usually located at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "parrotscribe": {
      "command": "node",
      "args": ["/absolute/path/to/parrotscribe-mcp/dist/index.js"],
      "env": {
        "PSCRIBE_PATH": "pscribe"
      }
    }
  }
}
```

#### OpenCode / Claude Code
You can run the server directly using the absolute path to the built file:
```bash
node /absolute/path/to/parrotscribe-mcp/dist/index.js
```

## Security & Privacy Covenant

### 1. Local-Only Data Flow
The ParrotScribe MCP server acts as a **stateless pipe**. It does not store, cache, or transmit transcriptions to any third-party service. Data flows exclusively from the local `pscribe` CLI to the local AI agent via standard input/output (stdio).

### 2. Zero-Cloud Footprint
- **No Analytics**: The server does not track usage or telemetry.
- **No Intermediate Servers**: Transcriptions are never sent to a ParrotScribe cloud or any intermediary.
- **Direct Handover**: Once the transcription is handed to the AI agent (e.g., Claude, OpenCode), the responsibility for data residency and security shifts to the end user's configuration of that agent.

### 3. User Sovereignty
The user maintains full control over:
- Which AI agent has access to the MCP server.
- Which LLM provider receives the data from the agent.
- When the transcription service is active (`pscribe_start`/`pscribe_stop`).

## Success Criteria
1. **Start/Stop**: Agent can successfully start and stop transcription sessions.
2. **Real-time Polling**: Agent can receive new transcript lines within 2 seconds of them being spoken using `pscribe_tail`.
3. **Source Differentiation**: Agent can distinguish between `M` (microphone) and `S` (system audio) to understand who is speaking (User vs. Remote participant).
4. **Confidence Filtering**: Agent can use the `confidence` score to decide whether to act on a line or wait for a more certain transcription.
5. **Session Management**: Agent can list past sessions and retrieve historical transcripts.
6. **Error Resilience**: Agent receives actionable error messages when the CLI is missing or permissions are denied.

## Distribution Plan

### Primary: NPM + NPX (Evergreen)
- **Package**: [@johanthoren/parrotscribe-mcp-server](https://www.npmjs.com/package/@johanthoren/parrotscribe-mcp-server)
- **Command**: `npx @johanthoren/parrotscribe-mcp-server`
- **Benefit**: Allows independent, rapid updates to the MCP logic without requiring a full macOS app rebuild.

### Secondary: Bundled (Air-gapped/Offline)
- **Location**: Included in the ParrotScribe macOS app bundle.
- **Command**: `node /Applications/ParrotScribe.app/Contents/Resources/mcp/index.js`
- **Benefit**: Works for users with strict network policies or no internet access.

### Automation
- The ParrotScribe macOS app will provide a "One-Click" setup to detect installed agents (Claude, OpenCode) and update their configuration files automatically.

