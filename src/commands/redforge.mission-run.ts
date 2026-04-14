import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { agentCommand } from "../agents/agent-command.js";
import { resolveDefaultAgentId } from "../agents/agent-scope.js";
import { DEFAULT_AGENT_WORKSPACE_DIR } from "../agents/workspace.js";
import { loadConfig } from "../config/config.js";
import type { PlannerMetadata } from "../redforge/planner/mission-plan-types.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import { shortenHomePath } from "../utils.js";
import { requireNonEmpty } from "./redforge.shared.js";

type ParsedSimpleYaml = Record<string, unknown>;
type RunStatus = "initialized" | "running" | "completed" | "failed";

type RunExecutionConfig = {
  mode: string;
  outputs: string[];
  model?: string;
  baseUrl?: string;
  dryRun: boolean;
};

type RunState = {
  id: string;
  status: RunStatus;
  mission: string;
  target: string;
  scope: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  error?: string;
  execution: RunExecutionConfig;
  planner?: PlannerMetadata;
};

export type RedForgeMissionRunResult = {
  runId: string;
  runDir: string;
  artifactDir: string;
  reportMarkdownPath: string;
  reportJsonPath: string;
  status: RunStatus;
  dryRun: boolean;
};

function generateRunId(): string {
  const now = new Date();
  const stamp = [
    now.getUTCFullYear().toString().padStart(4, "0"),
    (now.getUTCMonth() + 1).toString().padStart(2, "0"),
    now.getUTCDate().toString().padStart(2, "0"),
    now.getUTCHours().toString().padStart(2, "0"),
    now.getUTCMinutes().toString().padStart(2, "0"),
    now.getUTCSeconds().toString().padStart(2, "0"),
  ].join("");
  return `run-${stamp}-${crypto.randomBytes(3).toString("hex")}`;
}

function parseSimpleYaml(raw: string): ParsedSimpleYaml {
  const result: ParsedSimpleYaml = {};
  let currentListKey: string | null = null;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    if (line.startsWith("  - ") && currentListKey) {
      const current = result[currentListKey];
      const list = Array.isArray(current) ? current : [];
      list.push(parseYamlScalar(line.slice(4).trim()));
      result[currentListKey] = list;
      continue;
    }
    currentListKey = null;
    const separator = line.indexOf(":");
    if (separator <= 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    if (rawValue === "[]") {
      result[key] = [];
      currentListKey = key;
      continue;
    }
    if (!rawValue) {
      result[key] = [];
      currentListKey = key;
      continue;
    }
    result[key] = parseYamlScalar(rawValue);
  }
  return result;
}

function parseYamlScalar(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function readYamlFile(filePath: string): Promise<ParsedSimpleYaml> {
  const raw = await fs.readFile(filePath, "utf-8");
  return parseSimpleYaml(raw);
}

async function assertPathExists(filePath: string, label: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`${label} not found: ${shortenHomePath(filePath)}`);
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf-8");
}

async function appendJsonl(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(value)}\n`, "utf-8");
}

async function writeRunState(runDir: string, state: RunState): Promise<void> {
  await writeJson(path.join(runDir, "run.json"), state);
}

function summarizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message || String(error);
  }
  return String(error);
}

function stringifyScalar(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value == null) {
    return "";
  }
  return JSON.stringify(value);
}

function normalizeOutputs(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => stringifyScalar(entry)).filter(Boolean);
  }
  return ["findings", "artifacts", "report"];
}

function parsePlannerMetadata(value: unknown): PlannerMetadata | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  try {
    return JSON.parse(value) as PlannerMetadata;
  } catch {
    return undefined;
  }
}

function buildRedForgeMissionPrompt(params: {
  runId: string;
  missionId: string;
  mission: ParsedSimpleYaml;
  target: ParsedSimpleYaml;
  scope: ParsedSimpleYaml;
  execution: RunExecutionConfig;
  planner?: PlannerMetadata;
}): string {
  const scopeAllowedTargets = Array.isArray(params.scope.allowedTargets)
    ? params.scope.allowedTargets.map((entry) => stringifyScalar(entry))
    : [];
  const scopeAllowedTools = Array.isArray(params.scope.allowedTools)
    ? params.scope.allowedTools.map((entry) => stringifyScalar(entry))
    : [];
  const scopeForbiddenActions = Array.isArray(params.scope.forbiddenActions)
    ? params.scope.forbiddenActions.map((entry) => stringifyScalar(entry))
    : [];
  const plannerLines = params.planner
    ? [
        "",
        "Planner metadata:",
        `- prompt: ${params.planner.prompt}`,
        `- confidence: ${params.planner.confidence}`,
        `- suggested next action: ${params.planner.suggestedNextAction}`,
        `- intent kind: ${params.planner.intent.kind}`,
        `- intent scopeKind: ${params.planner.intent.scopeKind}`,
        `- planner warnings: ${params.planner.warnings.join(", ") || "(none)"}`,
        `- tool families: ${params.planner.toolFamilies.join(", ") || "(none)"}`,
      ]
    : [];

  return [
    "You are RedForge, an autonomous red-team operator running inside the main product runtime.",
    "Work tool-first, stay grounded in evidence, and respect the mission scope strictly.",
    "",
    "Mission execution context:",
    `- runId: ${params.runId}`,
    `- missionId: ${params.missionId}`,
    `- objective: ${stringifyScalar(params.mission.objective)}`,
    `- mode: ${params.execution.mode}`,
    `- expected outputs: ${params.execution.outputs.join(", ")}`,
    `- dry-run: ${params.execution.dryRun ? "yes" : "no"}`,
    `- execution model override: ${params.execution.model ?? "(default)"}`,
    `- execution base URL override: ${params.execution.baseUrl ?? "(default)"}`,
    ...plannerLines,
    "",
    "Target:",
    `- id: ${stringifyScalar(params.target.id)}`,
    `- name: ${stringifyScalar(params.target.name)}`,
    `- type: ${stringifyScalar(params.target.type)}`,
    `- value: ${stringifyScalar(params.target.value)}`,
    `- notes: ${stringifyScalar(params.target.notes)}`,
    "",
    "Scope:",
    `- id: ${stringifyScalar(params.scope.id)}`,
    `- description: ${stringifyScalar(params.scope.description)}`,
    `- autonomy: ${stringifyScalar(params.scope.autonomy ?? "bounded")}`,
    `- allowed targets: ${scopeAllowedTargets.join(", ") || "(none declared)"}`,
    `- allowed tools: ${scopeAllowedTools.join(", ") || "(none declared)"}`,
    `- forbidden actions: ${scopeForbiddenActions.join(", ") || "(none declared)"}`,
    "",
    "Execution instructions:",
    "1. Follow the objective and stay within scope.",
    "2. Prefer tool-backed observation over speculation.",
    "3. If you cannot safely proceed, explain why.",
    "4. Produce a concise operational summary, candidate findings, and recommended next steps.",
    "5. Keep the output useful for later persistence into findings/report artifacts.",
  ].join("\n");
}

function extractTextFromPayloads(payloads: unknown): string {
  if (!Array.isArray(payloads)) {
    return "";
  }
  return payloads
    .map((payload) => {
      if (!payload || typeof payload !== "object") {
        return "";
      }
      const text = (payload as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function detectAgentExecutionFailure(params: {
  result: unknown;
  outputText: string;
}): string | null {
  const text = params.outputText.trim();
  const payloads =
    params.result && typeof params.result === "object"
      ? ((params.result as { payloads?: unknown[] }).payloads ?? [])
      : [];

  if (Array.isArray(payloads)) {
    for (const payload of payloads) {
      if (!payload || typeof payload !== "object") {
        continue;
      }
      if ((payload as { isError?: unknown }).isError === true) {
        const payloadText = (payload as { text?: unknown }).text;
        return typeof payloadText === "string" && payloadText.trim().length > 0
          ? payloadText.trim()
          : text || "Agent execution returned an error payload.";
      }
    }
  }

  if (!text) {
    return null;
  }

  const failurePatterns = [
    /^[45]\d\d\s/u,
    /^error:/iu,
    /timed out/iu,
    /"error"\s*:/iu,
    /model requires more system memory/iu,
    /insufficient[_ -]?quota/iu,
    /payment required/iu,
    /forbidden/iu,
    /unauthorized/iu,
    /not found/iu,
  ];

  return failurePatterns.some((pattern) => pattern.test(text)) ? text : null;
}

export async function redforgeMissionRunCommand(
  opts: {
    workspace?: string;
    mission?: string;
    model?: string;
    baseUrl?: string;
    dryRun?: boolean;
    /** When set, runs as this configured agent; otherwise uses the default agent from config. */
    agent?: string;
  },
  runtime: RuntimeEnv = defaultRuntime,
): Promise<RedForgeMissionRunResult> {
  const workspaceDir =
    typeof opts.workspace === "string" && opts.workspace.trim().length > 0
      ? opts.workspace.trim()
      : DEFAULT_AGENT_WORKSPACE_DIR;
  const missionId = requireNonEmpty(opts.mission, "mission");

  await assertPathExists(path.join(workspaceDir, "MISSIONS"), "MISSIONS directory");
  await assertPathExists(path.join(workspaceDir, "TARGETS"), "TARGETS directory");
  await assertPathExists(path.join(workspaceDir, "SCOPES"), "SCOPES directory");
  await assertPathExists(path.join(workspaceDir, "RUNS"), "RUNS directory");
  await assertPathExists(path.join(workspaceDir, "ARTIFACTS"), "ARTIFACTS directory");
  await assertPathExists(path.join(workspaceDir, "REPORTS"), "REPORTS directory");

  const missionPath = path.join(workspaceDir, "MISSIONS", `${missionId}.yaml`);
  await assertPathExists(missionPath, "Mission file");
  const mission = await readYamlFile(missionPath);
  const planner = parsePlannerMetadata(mission.planner);
  const targetId = requireNonEmpty(stringifyScalar(mission.target), "mission.target");
  const scopeId = requireNonEmpty(stringifyScalar(mission.scope), "mission.scope");
  const targetPath = path.join(workspaceDir, "TARGETS", `${targetId}.yaml`);
  const scopePath = path.join(workspaceDir, "SCOPES", `${scopeId}.yaml`);
  await assertPathExists(targetPath, "Target file");
  await assertPathExists(scopePath, "Scope file");
  const target = await readYamlFile(targetPath);
  const scope = await readYamlFile(scopePath);

  const execution: RunExecutionConfig = {
    mode: stringifyScalar(mission.mode ?? "bounded-recon"),
    outputs: normalizeOutputs(mission.outputs),
    model: opts.model?.trim() || undefined,
    baseUrl: opts.baseUrl?.trim() || undefined,
    dryRun: Boolean(opts.dryRun),
  };

  const runId = generateRunId();
  const runDir = path.join(workspaceDir, "RUNS", runId);
  const artifactDir = path.join(workspaceDir, "ARTIFACTS", runId);
  const reportMarkdownPath = path.join(workspaceDir, "REPORTS", `${runId}.md`);
  const reportJsonPath = path.join(workspaceDir, "REPORTS", `${runId}.json`);
  const eventsPath = path.join(runDir, "events.jsonl");
  const stateTransitionsPath = path.join(runDir, "state-transitions.jsonl");
  const agentResultPath = path.join(runDir, "agent-result.json");
  const agentOutputPath = path.join(runDir, "agent-output.md");
  const createdAt = new Date().toISOString();

  await fs.mkdir(runDir, { recursive: true });
  await fs.mkdir(artifactDir, { recursive: true });

  const runState: RunState = {
    id: runId,
    status: "initialized",
    mission: missionId,
    target: targetId,
    scope: scopeId,
    createdAt,
    execution,
    planner,
  };

  await writeRunState(runDir, runState);
  await appendJsonl(eventsPath, {
    at: createdAt,
    type: "run.initialized",
    runId,
    mission: missionId,
    execution,
    planner,
  });
  await appendJsonl(stateTransitionsPath, {
    at: createdAt,
    from: null,
    to: "initialized",
  });

  try {
    const startedAt = new Date().toISOString();
    runState.status = "running";
    runState.startedAt = startedAt;
    await writeRunState(runDir, runState);
    await appendJsonl(eventsPath, {
      at: startedAt,
      type: "run.started",
      runId,
      execution,
      planner,
    });
    await appendJsonl(stateTransitionsPath, {
      at: startedAt,
      from: "initialized",
      to: "running",
    });

    const missionContext = {
      mission,
      target,
      scope,
      planner,
      run: {
        id: runId,
        runDir,
        artifactDir,
        reportMarkdownPath,
        reportJsonPath,
        eventsPath,
        stateTransitionsPath,
        agentResultPath,
        agentOutputPath,
      },
      execution,
    };

    await writeJson(path.join(runDir, "mission-context.json"), missionContext);
    await writeJson(path.join(runDir, "findings.json"), []);
    await fs.writeFile(
      path.join(runDir, "notes.md"),
      `# ${runId}\n\nMission: ${missionId}\nTarget: ${targetId}\nScope: ${scopeId}\nStatus: running\nDry-run: ${execution.dryRun ? "yes" : "no"}\n`,
      "utf-8",
    );

    let agentExecution: {
      prompt: string;
      result?: unknown;
      outputText?: string;
      skipped: boolean;
    } = {
      prompt: buildRedForgeMissionPrompt({
        runId,
        missionId,
        mission,
        target,
        scope,
        execution,
        planner,
      }),
      skipped: execution.dryRun,
    };

    if (!execution.dryRun) {
      await appendJsonl(eventsPath, {
        at: new Date().toISOString(),
        type: "agent.execution.started",
        runId,
        execution,
      });

      const cfg = loadConfig();
      const agentIdRaw = opts.agent?.trim();
      const agentId = agentIdRaw && agentIdRaw.length > 0 ? agentIdRaw : resolveDefaultAgentId(cfg);

      const result = await agentCommand(
        {
          message: agentExecution.prompt,
          agentId,
          model: execution.model,
          workspaceDir,
          runId,
          senderIsOwner: true,
          allowModelOverride: true,
        },
        runtime,
      );

      const outputText = extractTextFromPayloads((result as { payloads?: unknown[] })?.payloads);
      agentExecution = {
        ...agentExecution,
        result,
        outputText,
        skipped: false,
      };

      await writeJson(agentResultPath, result);
      await fs.writeFile(agentOutputPath, outputText || "(no agent text output)", "utf-8");

      const failureMessage = detectAgentExecutionFailure({ result, outputText });
      if (failureMessage) {
        await appendJsonl(eventsPath, {
          at: new Date().toISOString(),
          type: "agent.execution.failed",
          runId,
          error: failureMessage,
        });
        throw new Error(failureMessage);
      }

      await appendJsonl(eventsPath, {
        at: new Date().toISOString(),
        type: "agent.execution.completed",
        runId,
      });
    } else {
      await writeJson(agentResultPath, { skipped: true, reason: "dry-run" });
      await fs.writeFile(agentOutputPath, "Dry-run: agent execution skipped.", "utf-8");
    }

    const completedAt = new Date().toISOString();
    runState.status = "completed";
    runState.completedAt = completedAt;
    await writeRunState(runDir, runState);
    await appendJsonl(eventsPath, {
      at: completedAt,
      type: execution.dryRun ? "run.dry-run.completed" : "run.completed",
      runId,
      execution,
    });
    await appendJsonl(stateTransitionsPath, {
      at: completedAt,
      from: "running",
      to: "completed",
    });

    await fs.writeFile(
      reportMarkdownPath,
      [
        `# RedForge Report — ${runId}`,
        "",
        `- Mission: ${missionId}`,
        `- Target: ${targetId}`,
        `- Scope: ${scopeId}`,
        `- Mode: ${execution.mode}`,
        `- Status: ${runState.status}`,
        `- Dry-run: ${execution.dryRun ? "yes" : "no"}`,
        `- Model: ${execution.model ?? "(default)"}`,
        `- Base URL: ${execution.baseUrl ?? "(default)"}`,
        `- Outputs: ${execution.outputs.join(", ")}`,
        ...(planner
          ? [
              `- Planned from prompt: ${planner.prompt}`,
              `- Planner confidence: ${planner.confidence}`,
              `- Planner intent: ${planner.intent.kind} / ${planner.intent.scopeKind}`,
            ]
          : []),
        "",
        "## Agent Output",
        "",
        agentExecution.outputText ||
          (execution.dryRun ? "Dry-run: no agent execution performed." : "(no agent text output)"),
        "",
      ].join("\n"),
      "utf-8",
    );
    await writeJson(reportJsonPath, {
      runId,
      mission: missionId,
      target: targetId,
      scope: scopeId,
      status: runState.status,
      findings: [],
      execution,
      planner,
      agentExecution: {
        skipped: agentExecution.skipped,
        outputText: agentExecution.outputText ?? null,
      },
    });

    runtime.log(`RedForge run created: ${shortenHomePath(runDir)}`);
    runtime.log(`RedForge artifacts ready: ${shortenHomePath(artifactDir)}`);
    runtime.log(`RedForge report written: ${shortenHomePath(reportMarkdownPath)}`);

    return {
      runId,
      runDir,
      artifactDir,
      reportMarkdownPath,
      reportJsonPath,
      status: runState.status,
      dryRun: execution.dryRun,
    };
  } catch (error) {
    const failedAt = new Date().toISOString();
    runState.status = "failed";
    runState.failedAt = failedAt;
    runState.error = summarizeError(error);
    await writeRunState(runDir, runState);
    await appendJsonl(eventsPath, {
      at: failedAt,
      type: "run.failed",
      runId,
      error: runState.error,
      execution,
    });
    await appendJsonl(stateTransitionsPath, {
      at: failedAt,
      from: runState.startedAt ? "running" : "initialized",
      to: "failed",
    });
    throw error;
  }
}
