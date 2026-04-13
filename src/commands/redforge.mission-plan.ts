import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_AGENT_WORKSPACE_DIR } from "../agents/workspace.js";
import { gateMissionIntent } from "../redforge/planner/mission-intent-gate.js";
import { buildMissionPlan } from "../redforge/planner/mission-plan-core.js";
import {
  renderMissionIntentGateResult,
  renderMissionPlan,
} from "../redforge/planner/mission-plan-render.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime, writeRuntimeJson } from "../runtime.js";
import { shortenHomePath } from "../utils.js";
import { redforgeMissionCreateCommand } from "./redforge.mission-create.js";
import { redforgeMissionRunCommand } from "./redforge.mission-run.js";
import { redforgeScopeCreateCommand } from "./redforge.scope-create.js";
import { redforgeTargetAddCommand } from "./redforge.target-add.js";

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function redforgeMissionPlanCommand(
  opts: {
    prompt?: string;
    workspace?: string;
    apply?: boolean;
    run?: boolean;
    json?: boolean;
    model?: string;
    baseUrl?: string;
    agent?: string;
    dryRun?: boolean;
    force?: boolean;
  },
  runtime: RuntimeEnv = defaultRuntime,
): Promise<void> {
  const workspaceDir =
    typeof opts.workspace === "string" && opts.workspace.trim().length > 0
      ? opts.workspace.trim()
      : DEFAULT_AGENT_WORKSPACE_DIR;
  const prompt = opts.prompt?.trim() ?? "";
  const gate = gateMissionIntent(prompt);

  if (gate.action !== "apply") {
    if (opts.json) {
      writeRuntimeJson(runtime, gate);
    } else {
      runtime.log(renderMissionIntentGateResult(gate));
    }
    return;
  }

  const plan = buildMissionPlan(prompt, workspaceDir);

  if (opts.json) {
    writeRuntimeJson(runtime, plan);
  } else {
    runtime.log(renderMissionPlan(plan));
  }

  if (!opts.apply) {
    return;
  }

  const targetPath = path.join(workspaceDir, "TARGETS", `${plan.target.id}.yaml`);
  const scopePath = path.join(workspaceDir, "SCOPES", `${plan.scope.id}.yaml`);
  const missionPath = path.join(workspaceDir, "MISSIONS", `${plan.mission.id}.yaml`);

  if (!(await pathExists(targetPath)) || opts.force) {
    await redforgeTargetAddCommand(
      {
        workspace: workspaceDir,
        id: plan.target.id,
        name: plan.target.name,
        type: plan.target.type,
        value: plan.target.value,
        notes: plan.target.notes,
        force: Boolean(opts.force),
      },
      runtime,
    );
  } else {
    runtime.log(`RedForge target reused: ${shortenHomePath(targetPath)}`);
  }

  if (!(await pathExists(scopePath)) || opts.force) {
    await redforgeScopeCreateCommand(
      {
        workspace: workspaceDir,
        id: plan.scope.id,
        description: plan.scope.description,
        allowedTarget: plan.scope.allowedTargets,
        allowedTool: plan.scope.allowedTools,
        forbiddenAction: plan.scope.forbiddenActions,
        autonomy: plan.scope.autonomy,
        force: Boolean(opts.force),
      },
      runtime,
    );
  } else {
    runtime.log(`RedForge scope reused: ${shortenHomePath(scopePath)}`);
  }

  if (!(await pathExists(missionPath)) || opts.force) {
    await redforgeMissionCreateCommand(
      {
        workspace: workspaceDir,
        id: plan.mission.id,
        objective: plan.mission.objective,
        target: plan.mission.target,
        scope: plan.mission.scope,
        mode: plan.mission.mode,
        output: plan.mission.outputs,
        force: Boolean(opts.force),
      },
      runtime,
    );
  } else {
    runtime.log(`RedForge mission reused: ${shortenHomePath(missionPath)}`);
  }

  if (!opts.run) {
    return;
  }

  await redforgeMissionRunCommand(
    {
      workspace: workspaceDir,
      mission: plan.mission.id,
      agent: opts.agent,
      model: opts.model,
      baseUrl: opts.baseUrl,
      dryRun: Boolean(opts.dryRun),
    },
    runtime,
  );
}
