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
import {
  redforgeMissionRunCommand,
  type RedForgeMissionRunResult,
} from "./redforge.mission-run.js";
import { redforgeScopeCreateCommand } from "./redforge.scope-create.js";
import { redforgeTargetAddCommand } from "./redforge.target-add.js";

type ApplyResourceKind = "target" | "scope" | "mission";
type ApplyResourceAction = "created" | "reused";

type ApplyResourceResult = {
  kind: ApplyResourceKind;
  id: string;
  path: string;
  action: ApplyResourceAction;
};

type MissionFlowSummary = {
  missionId: string;
  targetId: string;
  scopeId: string;
  apply: ApplyResourceResult[];
  run?: RedForgeMissionRunResult;
};

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function renderMissionFlowSummary(summary: MissionFlowSummary): string {
  const applyLines = summary.apply.map(
    (entry) => `- ${entry.kind}: ${entry.action} (${shortenHomePath(entry.path)})`,
  );

  const lines = [
    "RedForge mission flow summary",
    "",
    "Plan:",
    `- mission: ${summary.missionId}`,
    `- target: ${summary.targetId}`,
    `- scope: ${summary.scopeId}`,
    "",
    "Apply:",
    ...applyLines,
  ];

  if (summary.run) {
    lines.push(
      "",
      "Run:",
      `- runId: ${summary.run.runId}`,
      `- status: ${summary.run.status}`,
      `- dry-run: ${summary.run.dryRun ? "yes" : "no"}`,
      `- report: ${shortenHomePath(summary.run.reportMarkdownPath)}`,
      `- artifacts: ${shortenHomePath(summary.run.artifactDir)}`,
      "",
      "Status:",
      "- mission flow completed",
    );
  } else {
    lines.push("", "Status:", "- mission is ready for execution");
  }

  return lines.join("\n");
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
  const applyResults: ApplyResourceResult[] = [];

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
    applyResults.push({
      kind: "target",
      id: plan.target.id,
      path: targetPath,
      action: "created",
    });
  } else {
    runtime.log(`RedForge target reused: ${shortenHomePath(targetPath)}`);
    applyResults.push({
      kind: "target",
      id: plan.target.id,
      path: targetPath,
      action: "reused",
    });
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
    applyResults.push({
      kind: "scope",
      id: plan.scope.id,
      path: scopePath,
      action: "created",
    });
  } else {
    runtime.log(`RedForge scope reused: ${shortenHomePath(scopePath)}`);
    applyResults.push({
      kind: "scope",
      id: plan.scope.id,
      path: scopePath,
      action: "reused",
    });
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
        planner: plan.planner,
        force: Boolean(opts.force),
      },
      runtime,
    );
    applyResults.push({
      kind: "mission",
      id: plan.mission.id,
      path: missionPath,
      action: "created",
    });
  } else {
    runtime.log(`RedForge mission reused: ${shortenHomePath(missionPath)}`);
    applyResults.push({
      kind: "mission",
      id: plan.mission.id,
      path: missionPath,
      action: "reused",
    });
  }

  let runSummary: RedForgeMissionRunResult | undefined;

  if (opts.run) {
    runSummary = await redforgeMissionRunCommand(
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

  runtime.log(
    renderMissionFlowSummary({
      missionId: plan.mission.id,
      targetId: plan.target.id,
      scopeId: plan.scope.id,
      apply: applyResults,
      run: runSummary,
    }),
  );
}
