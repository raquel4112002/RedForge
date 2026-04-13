import path from "node:path";
import { DEFAULT_AGENT_WORKSPACE_DIR } from "../agents/workspace.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import { shortenHomePath } from "../utils.js";
import { requireNonEmpty, slugifyRedForgeId, yamlList, yamlScalar } from "./redforge.shared.js";

function normalizeList(value: string[] | string | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }
  const trimmed = value?.trim();
  return trimmed ? [trimmed] : [];
}

function renderScopeYaml(params: {
  id: string;
  description: string;
  allowedTargets: string[];
  allowedTools: string[];
  forbiddenActions: string[];
  autonomy: string;
}): string {
  return [
    `id: ${yamlScalar(params.id)}`,
    `description: ${yamlScalar(params.description)}`,
    `allowedTargets: ${yamlList(params.allowedTargets)}`,
    `allowedTools: ${yamlList(params.allowedTools)}`,
    `forbiddenActions: ${yamlList(params.forbiddenActions)}`,
    `autonomy: ${yamlScalar(params.autonomy)}`,
    "",
  ].join("\n");
}

export async function redforgeScopeCreateCommand(
  opts: {
    workspace?: string;
    id?: string;
    description?: string;
    allowedTarget?: string[] | string;
    allowedTool?: string[] | string;
    forbiddenAction?: string[] | string;
    autonomy?: string;
    force?: boolean;
  },
  runtime: RuntimeEnv = defaultRuntime,
): Promise<void> {
  const workspaceDir =
    typeof opts.workspace === "string" && opts.workspace.trim().length > 0
      ? opts.workspace.trim()
      : DEFAULT_AGENT_WORKSPACE_DIR;
  const description = requireNonEmpty(opts.description, "description");
  const autonomy = opts.autonomy?.trim() || "bounded";
  const explicitId = opts.id?.trim();
  const id = explicitId && explicitId.length > 0 ? explicitId : slugifyRedForgeId(description);
  if (!id) {
    throw new Error("Could not derive scope id");
  }
  const filePath = path.join(workspaceDir, "SCOPES", `${id}.yaml`);
  const fs = await import("node:fs/promises");
  try {
    const stat = await fs.stat(filePath);
    if (stat.isFile() && !opts.force) {
      throw new Error(
        `Scope already exists: ${shortenHomePath(filePath)} (use --force to overwrite)`,
      );
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
      throw error;
    }
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(
    filePath,
    renderScopeYaml({
      id,
      description,
      allowedTargets: normalizeList(opts.allowedTarget),
      allowedTools: normalizeList(opts.allowedTool),
      forbiddenActions: normalizeList(opts.forbiddenAction),
      autonomy,
    }),
    "utf-8",
  );
  runtime.log(`RedForge scope written: ${shortenHomePath(filePath)}`);
}
