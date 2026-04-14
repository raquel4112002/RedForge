import path from "node:path";
import type { PlannerMetadata } from "../agents/planning/offensive/mission-plan-types.js";
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

function renderMissionYaml(params: {
  id: string;
  objective: string;
  target: string;
  scope: string;
  mode: string;
  outputs: string[];
  planner?: PlannerMetadata;
}): string {
  return [
    `id: ${yamlScalar(params.id)}`,
    `objective: ${yamlScalar(params.objective)}`,
    `target: ${yamlScalar(params.target)}`,
    `scope: ${yamlScalar(params.scope)}`,
    `mode: ${yamlScalar(params.mode)}`,
    `outputs: ${yamlList(params.outputs)}`,
    ...(params.planner ? [`planner: ${yamlScalar(JSON.stringify(params.planner))}`] : []),
    "",
  ].join("\n");
}

export async function redforgeMissionCreateCommand(
  opts: {
    workspace?: string;
    id?: string;
    objective?: string;
    target?: string;
    scope?: string;
    mode?: string;
    output?: string[] | string;
    planner?: PlannerMetadata;
    force?: boolean;
  },
  runtime: RuntimeEnv = defaultRuntime,
): Promise<void> {
  const workspaceDir =
    typeof opts.workspace === "string" && opts.workspace.trim().length > 0
      ? opts.workspace.trim()
      : DEFAULT_AGENT_WORKSPACE_DIR;
  const objective = requireNonEmpty(opts.objective, "objective");
  const target = requireNonEmpty(opts.target, "target");
  const scope = requireNonEmpty(opts.scope, "scope");
  const mode = opts.mode?.trim() || "bounded-recon";
  const outputs = normalizeList(opts.output);
  const explicitId = opts.id?.trim();
  const id = explicitId && explicitId.length > 0 ? explicitId : slugifyRedForgeId(objective);
  if (!id) {
    throw new Error("Could not derive mission id");
  }
  const filePath = path.join(workspaceDir, "MISSIONS", `${id}.yaml`);
  const fs = await import("node:fs/promises");
  try {
    const stat = await fs.stat(filePath);
    if (stat.isFile() && !opts.force) {
      throw new Error(
        `Mission already exists: ${shortenHomePath(filePath)} (use --force to overwrite)`,
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
    renderMissionYaml({
      id,
      objective,
      target,
      scope,
      mode,
      outputs: outputs.length > 0 ? outputs : ["findings", "artifacts", "report"],
      planner: opts.planner,
    }),
    "utf-8",
  );
  runtime.log(`RedForge mission written: ${shortenHomePath(filePath)}`);
}
