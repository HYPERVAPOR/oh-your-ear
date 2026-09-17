import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const MEMORY_DIR = "memory";
const MAX_TOTAL_CHARS = 12000;

function findMemoryFiles(cwd: string): string[] {
  const dir = path.join(cwd, MEMORY_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== ".template.md")
    .map((f) => path.join(dir, f))
    .sort();
}

function loadMemory(cwd: string): string {
  const files = findMemoryFiles(cwd);
  if (files.length === 0) return "";

  const parts: string[] = [
    "## Project Memory",
    "",
    "The following notes capture project-specific lessons, preferences, and decisions. Review them before acting.",
  ];
  let total = 0;

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const header = `\n\n### ${path.relative(cwd, file)}\n\n`;
    const chunk = header + content;
    if (total + chunk.length > MAX_TOTAL_CHARS) {
      parts.push("\n\n_(Memory truncated to stay within token budget.)_");
      break;
    }
    parts.push(chunk);
    total += chunk.length;
  }

  return parts.join("");
}

export default function (pi: ExtensionAPI) {
  let cwd = "";
  let memoryBlock = "";

  function refreshMemory(contextCwd: string) {
    cwd = contextCwd;
    memoryBlock = loadMemory(cwd);
  }

  // Load memory at session start (covers new / resume / fork / reload).
  pi.on("session_start", (event, ctx) => {
    refreshMemory(ctx.cwd);
  });

  // Refresh memory right before compaction so the summarizer sees the latest notes.
  pi.on("session_before_compact", (event, ctx) => {
    refreshMemory(ctx.cwd);
  });

  // Inject memory into the system prompt before every agent run.
  pi.on("before_agent_start", (event) => {
    if (!memoryBlock) return;
    return {
      systemPrompt: event.systemPrompt + "\n\n" + memoryBlock,
    };
  });
}
