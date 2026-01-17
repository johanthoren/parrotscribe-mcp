#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execFileSync } from "child_process";
import { deduplicateToonEntries } from "./dedup.js";

const PSCRIBE_PATH = process.env.PSCRIBE_PATH || "pscribe";

// Error codes for structured error handling
const ErrorCode = {
  NOT_RUNNING: "NOT_RUNNING",
  NO_SESSION: "NO_SESSION",
  INVALID_PARAMS: "INVALID_PARAMS",
  COMMAND_FAILED: "COMMAND_FAILED",
} as const;

interface PscribeError {
  code: keyof typeof ErrorCode;
  message: string;
}

// Helper to execute pscribe commands with structured errors
function runPscribe(args: string[]): string {
  try {
    return execFileSync(PSCRIBE_PATH, args, { encoding: "utf8" }).trim();
  } catch (error: any) {
    const stderr = error.stderr?.toString() || "";
    const message = stderr || error.message;

    // Map common errors to codes
    if (message.includes("No active transcript")) {
      throw { code: ErrorCode.NO_SESSION, message } as PscribeError;
    }
    if (message.includes("not running")) {
      throw { code: ErrorCode.NOT_RUNNING, message } as PscribeError;
    }

    throw { code: ErrorCode.COMMAND_FAILED, message } as PscribeError;
  }
}

// Format error for MCP response
function formatError(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const e = error as PscribeError;
    return `[${e.code}] ${e.message}`;
  }
  return String(error);
}

const server = new Server(
  {
    name: "parrotscribe-mcp-server",
    version: "0.3.1",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// TOON format documentation for tool descriptions
const TOON_FORMAT_DOC = `
Returns TOON format: timestamp,source,status,segment,confidence,duration,language,text
- source: M=microphone, S=system (audio), E=events
- status: C=confirmed, U=unconfirmed, T=translated, N=no_speech
- segment: sequential segment number
- confidence: 0-1 for confirmed, empty for unconfirmed
- duration: seconds
- language: ISO 639-1 code (e.g., en, sv, de)
- text: transcribed content (quoted if contains commas)`;

// List Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "pscribe_start",
        description:
          "Start real-time audio transcription (microphone and system audio). Returns status message confirming transcription started.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "pscribe_stop",
        description:
          "Stop (pause) the current transcription session. Returns status message confirming transcription stopped.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "pscribe_status",
        description: `Get the current status of the ParrotScribe service.
Returns: version, status (listening/stopped), session ID, duration, model, capture settings, output directory.`,
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "pscribe_tail",
        description: `Get recent transcript entries.${TOON_FORMAT_DOC}

Use 'n' for last N lines, OR 'since_line' to poll from a specific line (mutually exclusive).
For polling: call with since_line, note the last line number, then call again with that number + 1.`,
        inputSchema: {
          type: "object",
          properties: {
            n: {
              type: "number",
              description:
                "Number of entries to show (default: 10). Ignored if since_line is set.",
            },
            since_line: {
              type: "number",
              description:
                "Start from this line number (for polling). When set, returns ALL lines from this position onwards.",
            },
            status: {
              type: "string",
              enum: ["all", "confirmed", "unconfirmed", "translated", "speech"],
              description:
                "Filter by segment status (default: all). 'speech' = confirmed + unconfirmed + translated (excludes no_speech).",
            },
            session_id: {
              type: "string",
              description:
                "Session ID to read (from pscribe_sessions). Default: current session.",
            },
            dedup: {
              type: "boolean",
              description:
                "Deduplicate entries by segment ID, keeping confirmed over unconfirmed (default: false). Note: last_line metadata reflects raw line count before dedup.",
            },
          },
        },
      },
      {
        name: "pscribe_sessions",
        description: `List recent transcription sessions.
Returns: session ID, date, duration, segment count for each session.`,
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Max sessions to list (default: 10)",
            },
          },
        },
      },
      {
        name: "pscribe_new",
        description:
          "Force start a new transcription session. Use when you want a clean session boundary. Returns confirmation with new session ID.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "pscribe_cat",
        description: `Display complete transcript sessions with time-based filtering.${TOON_FORMAT_DOC}

Use this for historical queries like "summarize yesterday's standup" or "what was discussed last week".
Convert natural language time references to ISO8601 (e.g., "yesterday morning" → appropriate timestamp).`,
        inputSchema: {
          type: "object",
          properties: {
            session_ids: {
              type: "array",
              items: { type: "string" },
              description:
                "Session IDs to display (from pscribe_sessions). If omitted, uses time filters or --last.",
            },
            since: {
              type: "string",
              description:
                "Show sessions starting after this ISO8601 timestamp (e.g., 2024-01-15T09:00:00+01:00).",
            },
            until: {
              type: "string",
              description:
                "Show sessions starting before this ISO8601 timestamp.",
            },
            last: {
              type: "number",
              description: "Show last N sessions.",
            },
            status: {
              type: "string",
              enum: ["all", "confirmed", "unconfirmed", "speech"],
              description:
                "Filter by segment status (default: confirmed).",
            },
            dedup: {
              type: "boolean",
              description:
                "Deduplicate entries by segment ID, keeping confirmed over unconfirmed (default: false).",
            },
          },
        },
      },
      {
        name: "pscribe_grep",
        description: `Search for patterns across transcript sessions.

Use this for queries like "did anyone mention deployment last week?" or "find all references to the API".
Returns matching lines with session ID prefix. Use --count for summary statistics.`,
        inputSchema: {
          type: "object",
          properties: {
            pattern: {
              type: "string",
              description: "The pattern to search for (regex supported).",
            },
            since: {
              type: "string",
              description:
                "Only search sessions starting after this ISO8601 timestamp.",
            },
            until: {
              type: "string",
              description:
                "Only search sessions starting before this ISO8601 timestamp.",
            },
            status: {
              type: "string",
              enum: ["all", "confirmed", "unconfirmed", "speech"],
              description: "Filter by segment status (default: confirmed).",
            },
            ignore_case: {
              type: "boolean",
              description: "Case-insensitive search (default: false).",
            },
            count: {
              type: "boolean",
              description:
                "Show match count per session instead of matches (default: false).",
            },
            after_context: {
              type: "number",
              description: "Show N lines after each match (-A).",
            },
            before_context: {
              type: "number",
              description: "Show N lines before each match (-B).",
            },
            context: {
              type: "number",
              description: "Show N lines before and after each match (-C).",
            },
            dedup: {
              type: "boolean",
              description:
                "Deduplicate entries by segment ID, keeping confirmed over unconfirmed (default: false).",
            },
          },
          required: ["pattern"],
        },
      },
    ],
  };
});

// Call Tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "pscribe_start": {
        const result = runPscribe(["start"]);
        return { content: [{ type: "text", text: result }] };
      }
      case "pscribe_stop": {
        const result = runPscribe(["stop"]);
        return { content: [{ type: "text", text: result }] };
      }
      case "pscribe_status": {
        const result = runPscribe(["status"]);
        return { content: [{ type: "text", text: result }] };
      }
      case "pscribe_tail": {
        const n = (args?.n as number) || 10;
        const since_line = args?.since_line as number | undefined;
        const status = (args?.status as string) || "all";
        const session_id = args?.session_id as string | undefined;
        const dedup = args?.dedup as boolean | undefined;

        // Validate mutually exclusive params
        if (since_line !== undefined && args?.n !== undefined) {
          return {
            content: [
              {
                type: "text",
                text: "[INVALID_PARAMS] Cannot use both 'n' and 'since_line'. Use 'n' for last N lines, or 'since_line' to poll from a position.",
              },
            ],
            isError: true,
          };
        }

        const pscribeArgs = ["tail"];
        if (since_line !== undefined) {
          pscribeArgs.push("-n", `+${since_line}`);
        } else {
          pscribeArgs.push("-n", String(n));
        }
        if (status !== "all") {
          pscribeArgs.push("--status", status);
        }
        if (session_id !== undefined) {
          pscribeArgs.push("--session", session_id);
        }

        const result = runPscribe(pscribeArgs);
        const lines = result ? result.split("\n").filter((l) => l.trim()) : [];

        // Add metadata for polling (based on raw line count BEFORE dedup)
        const lastLineNum = since_line
          ? since_line - 1 + lines.length
          : lines.length;

        // Apply deduplication if requested
        const outputLines = dedup ? deduplicateToonEntries(lines) : lines;

        const metadata = `--- ${outputLines.length} entries, last_line: ${lastLineNum} ---`;

        return {
          content: [
            {
              type: "text",
              text:
                outputLines.length > 0
                  ? `${outputLines.join("\n")}\n${metadata}`
                  : metadata,
            },
          ],
        };
      }
      case "pscribe_sessions": {
        const limit = (args?.limit as number) || 10;
        const result = runPscribe(["list", "--limit", String(limit)]);
        return { content: [{ type: "text", text: result }] };
      }
      case "pscribe_new": {
        const result = runPscribe(["new"]);
        return { content: [{ type: "text", text: result }] };
      }
      case "pscribe_cat": {
        const session_ids = args?.session_ids as string[] | undefined;
        const since = args?.since as string | undefined;
        const until = args?.until as string | undefined;
        const last = args?.last as number | undefined;
        const status = args?.status as string | undefined;
        const dedup = args?.dedup as boolean | undefined;

        const pscribeArgs = ["cat"];

        if (session_ids && session_ids.length > 0) {
          pscribeArgs.push(...session_ids);
        }
        if (since !== undefined) {
          pscribeArgs.push("--since", since);
        }
        if (until !== undefined) {
          pscribeArgs.push("--until", until);
        }
        if (last !== undefined) {
          pscribeArgs.push("--last", String(last));
        }
        if (status !== undefined) {
          pscribeArgs.push("--status", status);
        }

        const result = runPscribe(pscribeArgs);

        // Apply deduplication if requested
        if (dedup) {
          const lines = result
            ? result.split("\n").filter((l) => l.trim())
            : [];
          const dedupedLines = deduplicateToonEntries(lines);
          return { content: [{ type: "text", text: dedupedLines.join("\n") }] };
        }

        return { content: [{ type: "text", text: result }] };
      }
      case "pscribe_grep": {
        const pattern = args?.pattern as string;
        const since = args?.since as string | undefined;
        const until = args?.until as string | undefined;
        const status = args?.status as string | undefined;
        const ignore_case = args?.ignore_case as boolean | undefined;
        const count = args?.count as boolean | undefined;
        const after_context = args?.after_context as number | undefined;
        const before_context = args?.before_context as number | undefined;
        const context = args?.context as number | undefined;
        const dedup = args?.dedup as boolean | undefined;

        if (!pattern) {
          return {
            content: [
              { type: "text", text: "[INVALID_PARAMS] pattern is required." },
            ],
            isError: true,
          };
        }

        const pscribeArgs = ["grep", pattern];

        if (since !== undefined) {
          pscribeArgs.push("--since", since);
        }
        if (until !== undefined) {
          pscribeArgs.push("--until", until);
        }
        if (status !== undefined) {
          pscribeArgs.push("--status", status);
        }
        if (ignore_case) {
          pscribeArgs.push("--ignore-case");
        }
        if (count) {
          pscribeArgs.push("--count");
        }
        if (after_context !== undefined) {
          pscribeArgs.push("-A", String(after_context));
        }
        if (before_context !== undefined) {
          pscribeArgs.push("-B", String(before_context));
        }
        if (context !== undefined) {
          pscribeArgs.push("-C", String(context));
        }

        const result = runPscribe(pscribeArgs);

        // Apply deduplication if requested
        if (dedup) {
          const lines = result
            ? result.split("\n").filter((l) => l.trim())
            : [];
          const dedupedLines = deduplicateToonEntries(lines);
          return { content: [{ type: "text", text: dedupedLines.join("\n") }] };
        }

        return { content: [{ type: "text", text: result }] };
      }
      default:
        return {
          content: [
            { type: "text", text: `[INVALID_PARAMS] Unknown tool: ${name}` },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: formatError(error) }],
      isError: true,
    };
  }
});

// List Resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "pscribe://current/transcript",
        name: "Live Transcript",
        description:
          "The live transcript of the active ParrotScribe session (last 100 entries in TOON format).",
        mimeType: "text/plain",
      },
    ],
  };
});

// Read Resource
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  if (uri === "pscribe://current/transcript") {
    try {
      const result = runPscribe(["tail", "-n", "100"]);
      return {
        contents: [
          {
            uri,
            mimeType: "text/plain",
            text: result,
          },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri,
            mimeType: "text/plain",
            text: formatError(error),
          },
        ],
      };
    }
  }
  throw new Error(`Unknown resource: ${uri}`);
});

// List Prompts
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "summarize-session",
        description:
          "Summarizes the current or a specific transcription session.",
        arguments: [
          {
            name: "session_id",
            description: "ID of the session to summarize (default: current)",
            required: false,
          },
        ],
      },
      {
        name: "monitor-call",
        description:
          "Sets up instructions for polling the transcript to monitor a call in real-time.",
        arguments: [
          {
            name: "keywords",
            description: "Comma-separated keywords to watch for",
            required: false,
          },
        ],
      },
    ],
  };
});

// Get Prompt
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "summarize-session") {
    const sessionId = args?.session_id || "current";
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please provide a structured summary of the ParrotScribe session: ${sessionId}.

Use pscribe_tail to fetch the transcript, then identify:
1. Key participants (M=microphone, S=system audio)
2. Main topics discussed
3. Any action items or commitments made
4. Key decisions or conclusions`,
          },
        },
      ],
    };
  }

  if (name === "monitor-call") {
    const keywords = args?.keywords
      ? `\n\nWatch specifically for these keywords: ${args.keywords}`
      : "";
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Monitor the live ParrotScribe transcript and alert me to important developments.${keywords}

Polling strategy:
1. Call pscribe_tail with since_line=1 to get initial content
2. Note the last_line number from the metadata
3. Wait a few seconds, then call with since_line=last_line+1
4. Repeat, accumulating context

Keep a running list of:
- Action items assigned
- Decisions made
- Questions raised
- Topics discussed`,
          },
        },
      ],
    };
  }

  throw new Error(`Unknown prompt: ${name}`);
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ParrotScribe MCP Server running on stdio");
}

run().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
