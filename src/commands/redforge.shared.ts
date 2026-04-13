import fs from "node:fs/promises";
import path from "node:path";
import type { RuntimeEnv } from "../runtime.js";
import { shortenHomePath } from "../utils.js";

export const REDFORGE_DIRS = [
  "TARGETS",
  "SCOPES",
  "MISSIONS",
  "RUNS",
  "ARTIFACTS",
  "REPORTS",
  "POLICIES",
  "KNOWLEDGE",
  path.join("KNOWLEDGE", "playbooks"),
  path.join("KNOWLEDGE", "notes"),
  path.join("KNOWLEDGE", "methodology"),
] as const;

export const REDFORGE_MANIFEST = `# REDFORGE.md

RedForge workspace for autonomous red-teaming operations.

## Domain structure
- TARGETS/: target definitions
- SCOPES/: rules of engagement and execution boundaries
- MISSIONS/: mission definitions
- RUNS/: concrete mission executions
- ARTIFACTS/: raw outputs and collected evidence
- REPORTS/: human-readable and structured reporting
- POLICIES/: runtime and operational policy definitions
- KNOWLEDGE/: playbooks, methodology, and internal notes

## Principles
- Tool-first, retrieval-assisted, mission-driven
- Preserve OpenClaw workspace identity; extend it with offensive-domain structure
- Favor reproducibility, auditability, and bounded execution
`;

export const DEFAULT_POLICY = `id: default-policy
name: Default RedForge Policy
autonomy: bounded
reporting:
  writeMarkdown: true
  writeJson: true
safety:
  destructiveActions: deny
  credentialSpraying: deny
  exploitExecution: confirm
`;

export type RedForgeInitResult = {
  workspaceDir: string;
  created: string[];
  reused: string[];
};

export async function ensureDirTracked(
  targetPath: string,
  result: RedForgeInitResult,
): Promise<void> {
  try {
    const stat = await fs.stat(targetPath);
    if (stat.isDirectory()) {
      result.reused.push(targetPath);
      return;
    }
  } catch {
    // create below
  }
  await fs.mkdir(targetPath, { recursive: true });
  result.created.push(targetPath);
}

export async function writeFileTracked(params: {
  filePath: string;
  content: string;
  force?: boolean;
  result: RedForgeInitResult;
}): Promise<void> {
  const { filePath, content, force, result } = params;
  try {
    const stat = await fs.stat(filePath);
    if (stat.isFile() && !force) {
      result.reused.push(filePath);
      return;
    }
  } catch {
    // write below
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");
  result.created.push(filePath);
}

export function renderRedForgeInitSummary(result: RedForgeInitResult): string {
  const lines: string[] = [];
  lines.push(`RedForge workspace ready: ${shortenHomePath(result.workspaceDir)}`);
  lines.push(`Created: ${result.created.length}`);
  lines.push(`Reused: ${result.reused.length}`);
  if (result.created.length > 0) {
    lines.push("Created items:");
    for (const entry of result.created) {
      lines.push(`- ${shortenHomePath(entry)}`);
    }
  }
  return lines.join("\n");
}

export function logRedForgeInitSummary(runtime: RuntimeEnv, result: RedForgeInitResult): void {
  runtime.log(renderRedForgeInitSummary(result));
}

export function resolveRedForgeWorkspaceDir(workspace?: string): string {
  const trimmed = workspace?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "~/.openclaw/workspace";
}

export function slugifyRedForgeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function yamlScalar(value: string): string {
  return JSON.stringify(value);
}

export function yamlList(items: readonly string[]): string {
  if (items.length === 0) {
    return "[]";
  }
  return `\n${items.map((item) => `  - ${yamlScalar(item)}`).join("\n")}`;
}

export function requireNonEmpty(value: string | undefined, field: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${field} is required`);
  }
  return normalized;
}
