import path from "node:path";
import { DEFAULT_AGENT_WORKSPACE_DIR } from "../agents/workspace.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import {
  DEFAULT_POLICY,
  REDFORGE_DIRS,
  REDFORGE_MANIFEST,
  ensureDirTracked,
  logRedForgeInitSummary,
  writeFileTracked,
  type RedForgeInitResult,
} from "./redforge.shared.js";

export async function redforgeInitCommand(
  opts?: { workspace?: string; force?: boolean; quiet?: boolean },
  runtime: RuntimeEnv = defaultRuntime,
): Promise<void> {
  const workspaceDir =
    typeof opts?.workspace === "string" && opts.workspace.trim().length > 0
      ? opts.workspace.trim()
      : DEFAULT_AGENT_WORKSPACE_DIR;

  const result: RedForgeInitResult = {
    workspaceDir,
    created: [],
    reused: [],
  };

  for (const relDir of REDFORGE_DIRS) {
    await ensureDirTracked(path.join(workspaceDir, relDir), result);
  }

  await writeFileTracked({
    filePath: path.join(workspaceDir, "REDFORGE.md"),
    content: REDFORGE_MANIFEST,
    force: opts?.force,
    result,
  });

  await writeFileTracked({
    filePath: path.join(workspaceDir, "POLICIES", "default-policy.yaml"),
    content: DEFAULT_POLICY,
    force: opts?.force,
    result,
  });

  if (!opts?.quiet) {
    logRedForgeInitSummary(runtime, result);
  }
}
