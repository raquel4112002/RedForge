import {
  detectTargetValue,
  gateMissionIntent,
  inferGateWarnings,
  inferMissionIntent,
} from "./mission-intent-gate.js";
import type {
  InferredMissionIntent,
  MissionPlan,
  PlannedMission,
  PlannedScope,
  PlannedTarget,
  PlannerConfidence,
  PlannerMetadata,
  PlannerNextAction,
} from "./mission-plan-types.js";

function slugifyId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function buildScopeDraft(params: {
  target: PlannedTarget;
  intent: InferredMissionIntent;
}): PlannedScope {
  let description = `Bounded assessment for ${params.target.value}`;
  let allowedTools: string[] = ["bash", "web_fetch"];

  if (params.intent.scopeKind === "web") {
    description = `Bounded web assessment for ${params.target.value}`;
    allowedTools = ["bash", "web_fetch", "web_search"];
  } else if (params.intent.scopeKind === "host") {
    description = `Bounded host assessment for ${params.target.value}`;
    allowedTools = ["bash", "web_search"];
  }

  return {
    id: slugifyId(description),
    description,
    allowedTargets: [params.target.id],
    allowedTools,
    forbiddenActions: [],
    autonomy: "bounded",
  };
}

export function buildMissionObjective(params: {
  prompt: string;
  target: PlannedTarget;
  intent: InferredMissionIntent;
}): string {
  if (params.intent.kind === "surface-mapping" && params.intent.scopeKind === "web") {
    return `Identify likely web attack surface for ${params.target.value} within bounded constraints.`;
  }
  if (params.intent.kind === "web-assessment") {
    return `Perform a bounded web assessment against ${params.target.value} and summarize the exposed surface.`;
  }
  if (params.intent.kind === "host-enumeration") {
    return `Enumerate host-level attack surface for ${params.target.value} within bounded constraints.`;
  }
  if (params.intent.scopeKind === "web") {
    return `Perform bounded reconnaissance against ${params.target.value} and identify likely web attack surface.`;
  }
  if (params.intent.scopeKind === "host") {
    return `Perform bounded reconnaissance against ${params.target.value} and identify likely host attack surface.`;
  }
  return params.prompt.charAt(0).toUpperCase() + params.prompt.slice(1);
}

export function buildMissionDraft(params: {
  prompt: string;
  target: PlannedTarget;
  scope: PlannedScope;
  intent: InferredMissionIntent;
}): PlannedMission {
  const objective = buildMissionObjective(params);
  return {
    id: slugifyId(objective),
    objective,
    target: params.target.id,
    scope: params.scope.id,
    mode: params.intent.kind,
    outputs: ["findings", "artifacts", "report"],
  };
}

export function inferToolFamilies(intent: InferredMissionIntent): string[] {
  if (intent.scopeKind === "web") {
    return ["web-recon", "search", "documentation"];
  }
  if (intent.scopeKind === "host") {
    return ["host-recon", "search", "documentation"];
  }
  return ["recon", "search"];
}

export function inferWarnings(params: {
  prompt: string;
  target: PlannedTarget;
  intent: InferredMissionIntent;
}): string[] {
  return inferGateWarnings(params);
}

export function inferConfidence(params: {
  target: PlannedTarget;
  intent: InferredMissionIntent;
  warnings: string[];
}): PlannerConfidence {
  if (
    ["url", "domain", "ip"].includes(params.target.type) &&
    params.intent.rationale.length >= 2 &&
    params.warnings.length === 0
  ) {
    return "high";
  }
  if (params.warnings.length >= 2 || params.target.type === "hostname") {
    return "low";
  }
  return "medium";
}

export function inferSuggestedNextAction(params: {
  confidence: PlannerConfidence;
  warnings: string[];
}): PlannerNextAction {
  if (params.confidence === "high") {
    return "apply-and-run";
  }
  if (params.confidence === "low") {
    return "ask-for-clarification";
  }
  return "apply";
}

export function buildMissionPlan(prompt: string, workspaceDir: string): MissionPlan {
  const normalizedPrompt = prompt.trim();
  if (!normalizedPrompt) {
    throw new Error("prompt is required");
  }

  const gate = gateMissionIntent(normalizedPrompt);
  if (gate.action !== "apply" || !gate.target) {
    throw new Error(`mission intent gate did not accept prompt: ${gate.action}`);
  }

  const targetDetection = detectTargetValue(normalizedPrompt);
  const targetName = targetDetection.value;
  const targetId = slugifyId(targetName);
  const target: PlannedTarget = {
    id: targetId,
    name: targetName,
    type: targetDetection.type,
    value: targetDetection.value,
    notes: `Planned from prompt: ${normalizedPrompt}`,
  };
  const intent = inferMissionIntent(normalizedPrompt, target.type);
  const scope = buildScopeDraft({ target, intent });
  const mission = buildMissionDraft({
    prompt: normalizedPrompt,
    target,
    scope,
    intent,
  });
  const toolFamilies = inferToolFamilies(intent);
  const warnings = inferWarnings({
    prompt: normalizedPrompt,
    target,
    intent,
  });
  const confidence = inferConfidence({
    target,
    intent,
    warnings,
  });
  const suggestedNextAction = inferSuggestedNextAction({ confidence, warnings });
  const planner: PlannerMetadata = {
    version: 1,
    source: "redforge-mission-plan",
    prompt: normalizedPrompt,
    confidence,
    suggestedNextAction,
    warnings: [...warnings],
    toolFamilies: [...toolFamilies],
    intent: {
      kind: intent.kind,
      scopeKind: intent.scopeKind,
      rationale: [...intent.rationale],
    },
    plannedAt: new Date().toISOString(),
  };

  return {
    workspaceDir,
    prompt: normalizedPrompt,
    target,
    scope,
    mission,
    intent,
    warnings,
    confidence,
    suggestedNextAction,
    toolFamilies,
    planner,
  };
}
