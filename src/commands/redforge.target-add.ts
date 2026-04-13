import path from "node:path";
import { DEFAULT_AGENT_WORKSPACE_DIR } from "../agents/workspace.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import { shortenHomePath } from "../utils.js";
import { requireNonEmpty, slugifyRedForgeId, yamlScalar } from "./redforge.shared.js";

function renderTargetYaml(params: {
  id: string;
  name: string;
  type: string;
  value: string;
  notes?: string;
}): string {
  return [
    `id: ${yamlScalar(params.id)}`,
    `name: ${yamlScalar(params.name)}`,
    `type: ${yamlScalar(params.type)}`,
    `value: ${yamlScalar(params.value)}`,
    `notes: ${yamlScalar(params.notes ?? "")}`,
    "",
  ].join("\n");
}

export async function redforgeTargetAddCommand(
  opts: {
    workspace?: string;
    id?: string;
    name?: string;
    type?: string;
    value?: string;
    notes?: string;
    force?: boolean;
  },
  runtime: RuntimeEnv = defaultRuntime,
): Promise<void> {
  const workspaceDir =
    typeof opts.workspace === "string" && opts.workspace.trim().length > 0
      ? opts.workspace.trim()
      : DEFAULT_AGENT_WORKSPACE_DIR;
  const name = requireNonEmpty(opts.name, "name");
  const type = requireNonEmpty(opts.type, "type");
  const value = requireNonEmpty(opts.value, "value");
  const explicitId = opts.id?.trim();
  const id = explicitId && explicitId.length > 0 ? explicitId : slugifyRedForgeId(name);
  if (!id) {
    throw new Error("Could not derive target id");
  }
  const filePath = path.join(workspaceDir, "TARGETS", `${id}.yaml`);
  const fs = await import("node:fs/promises");
  try {
    const stat = await fs.stat(filePath);
    if (stat.isFile() && !opts.force) {
      throw new Error(
        `Target already exists: ${shortenHomePath(filePath)} (use --force to overwrite)`,
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
    renderTargetYaml({
      id,
      name,
      type,
      value,
      notes: opts.notes,
    }),
    "utf-8",
  );
  runtime.log(`RedForge target written: ${shortenHomePath(filePath)}`);
}
