import * as fs from "node:fs";
import * as path from "node:path";
import { convertToLlm, serializeConversation, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type Message, uuidv7 } from "@earendil-works/pi-ai";

const MEMORY_DIR = "memory";
const AGENTS_MD = "AGENTS.md";
const TEMPLATE_PATH = "memory/.template.md";

interface MemoryEntry {
  date?: string;
  category: "bugfix" | "lesson" | "preference" | "decision";
  summary: string;
  body: string;
}

function readText(cwd: string, rel: string): string {
  try {
    return fs.readFileSync(path.join(cwd, rel), "utf-8");
  } catch {
    return "";
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 50);
}

function toFrontmatter(entry: MemoryEntry): string {
  const date = entry.date ?? today();
  const summary = entry.summary.replace(/"/g, '\\"');
  return `---\ndate: "${date}"\ncategory: "${entry.category}"\ntags: []\nsummary: "${summary}"\n---\n\n${entry.body.trim()}\n`;
}

function getMemoryCriteria(agentsMd: string): string {
  const match = agentsMd.match(/## 2\. 维护长期记忆系统[\s\S]*?(?=## |\n---|$)/);
  return match ? match[0] : "";
}

async function generateMemoryEntries(
  cwd: string,
  model: unknown,
  modelRegistry: { complete: (model: unknown, payload: { systemPrompt: string; messages: Message[] }, options: { signal?: AbortSignal; cacheRetention: "none"; sessionId: string }) => Promise<{ stopReason?: string; content: Array<{ type: string; text?: string }> }> },
  messages: unknown[],
  signal?: AbortSignal,
): Promise<MemoryEntry[]> {
  if (messages.length === 0) return [];

  const conversationText = serializeConversation(convertToLlm(messages as never));
  if (conversationText.length < 200) return [];

  const agentsMd = readText(cwd, AGENTS_MD);
  const template = readText(cwd, TEMPLATE_PATH);
  const criteria = getMemoryCriteria(agentsMd) || "Record important lessons, bugfixes, preferences, and decisions.";

  const systemPrompt = `You are a strict project memory curator.

Your job: review the provided conversation history and decide what, if anything, deserves to be written to the project's long-term memory.

Use these criteria:
${criteria}

Memory format:
- Each memory entry must have YAML frontmatter with date, category, tags, summary.
- category must be one of: bugfix, lesson, preference, decision.
- summary is a one-line description.
- body explains background, what happened, conclusion, and references.

Template:
${template || "memory/.template.md"}

Output ONLY a JSON array. Each element:
{
  "date": "YYYY-MM-DD",
  "category": "lesson",
  "summary": "one-line title",
  "body": "markdown body"
}

If nothing in the conversation meets the memory criteria, output an empty array []. Do not add commentary outside the JSON.`;

  const userMessage: Message = {
    role: "user",
    content: [
      {
        type: "text",
        text: `## Conversation History\n\n${conversationText.slice(0, 12000)}\n\nPlease output the JSON array of memory entries.`,
      },
    ],
    timestamp: Date.now(),
  };

  const response = await modelRegistry.complete(
    model,
    { systemPrompt, messages: [userMessage] },
    { signal, cacheRetention: "none", sessionId: uuidv7() },
  );

  if (response.stopReason === "aborted") return [];

  const text = response.content
    .filter((c): c is { type: "text"; text: string } => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("\n");

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const entries = JSON.parse(jsonMatch[0]) as MemoryEntry[];
    if (!Array.isArray(entries)) return [];
    return entries.filter(
      (e) =>
        e.summary &&
        e.body &&
        ["bugfix", "lesson", "preference", "decision"].includes(e.category),
    );
  } catch {
    return [];
  }
}

function writeEntries(cwd: string, entries: MemoryEntry[]) {
  for (const entry of entries) {
    const filename = `${entry.date ?? today()}-${slugify(entry.summary)}.md`;
    const filePath = path.join(cwd, MEMORY_DIR, filename);
    if (fs.existsSync(filePath)) continue;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, toFrontmatter(entry), "utf-8");
  }
}

function getMessagesFromBranch(sessionManager: { getBranch: () => Array<{ type: string; id: string; message?: unknown; summary?: string; tokensBefore?: number; timestamp: number; firstKeptEntryId?: string }> }): unknown[] {
  const branch = sessionManager.getBranch();
  let compactionIndex = -1;
  for (let i = branch.length - 1; i >= 0; i--) {
    if (branch[i].type === "compaction") {
      compactionIndex = i;
      break;
    }
  }

  if (compactionIndex < 0) {
    return branch
      .map((entry) => (entry.type === "message" ? entry.message : undefined))
      .filter(Boolean);
  }

  const compaction = branch[compactionIndex];
  const firstKeptIndex = compaction.firstKeptEntryId
    ? branch.findIndex((entry) => entry.id === compaction.firstKeptEntryId)
    : -1;

  const compactedBranch = [
    compaction,
    ...(firstKeptIndex >= 0 ? branch.slice(firstKeptIndex, compactionIndex) : []),
    ...branch.slice(compactionIndex + 1),
  ];

  return compactedBranch
    .map((entry) => {
      if (entry.type === "message") return entry.message;
      if (entry.type === "compaction") {
        return {
          role: "compactionSummary",
          summary: entry.summary,
          tokensBefore: entry.tokensBefore,
          timestamp: entry.timestamp,
        };
      }
      return undefined;
    })
    .filter(Boolean);
}

export default function (pi: ExtensionAPI) {
  pi.on("session_before_compact", async (event, ctx) => {
    const model = ctx.model;
    const modelRegistry = ctx.modelRegistry;
    if (!model || !modelRegistry) return;

    const messages = event.preparation.messagesToSummarize as unknown[];
    const entries = await generateMemoryEntries(
      ctx.cwd,
      model,
      modelRegistry,
      messages,
      event.signal,
    );
    writeEntries(ctx.cwd, entries);
  });

  pi.on("session_before_switch", async (event, ctx) => {
    if (event.reason !== "new") return;
    const model = ctx.model;
    const modelRegistry = ctx.modelRegistry;
    if (!model || !modelRegistry) return;

    const messages = getMessagesFromBranch(ctx.sessionManager);
    const entries = await generateMemoryEntries(
      ctx.cwd,
      model,
      modelRegistry,
      messages,
    );
    writeEntries(ctx.cwd, entries);
  });
}
