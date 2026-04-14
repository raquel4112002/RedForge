import { shortenHomePath } from "../../../utils.js";
import type { MissionIntentGateResult, MissionPlan } from "./mission-plan-types.js";

export function renderMissionPlan(plan: MissionPlan): string {
  const warningLines =
    plan.warnings.length > 0
      ? plan.warnings.map((warning) => `  - ${warning}`).join("\n")
      : "  - none";
  return [
    `RedForge mission plan for: ${plan.prompt}`,
    `Workspace: ${shortenHomePath(plan.workspaceDir)}`,
    "",
    "Intent:",
    `- kind: ${plan.intent.kind}`,
    `- scopeKind: ${plan.intent.scopeKind}`,
    `- rationale: ${plan.intent.rationale.join("; ")}`,
    "",
    "Planner assessment:",
    `- confidence: ${plan.confidence}`,
    `- suggestedNextAction: ${plan.suggestedNextAction}`,
    `- toolFamilies: ${plan.toolFamilies.join(", ")}`,
    "- warnings:",
    warningLines,
    "",
    "Target:",
    `- id: ${plan.target.id}`,
    `- name: ${plan.target.name}`,
    `- type: ${plan.target.type}`,
    `- value: ${plan.target.value}`,
    "",
    "Scope:",
    `- id: ${plan.scope.id}`,
    `- description: ${plan.scope.description}`,
    `- autonomy: ${plan.scope.autonomy}`,
    `- allowedTargets: ${plan.scope.allowedTargets.join(", ")}`,
    `- allowedTools: ${plan.scope.allowedTools.join(", ")}`,
    "",
    "Mission:",
    `- id: ${plan.mission.id}`,
    `- objective: ${plan.mission.objective}`,
    `- target: ${plan.mission.target}`,
    `- scope: ${plan.mission.scope}`,
    `- mode: ${plan.mission.mode}`,
    `- outputs: ${plan.mission.outputs.join(", ")}`,
  ].join("\n");
}

export function renderMissionIntentGateResult(result: MissionIntentGateResult): string {
  if (result.action === "noop") {
    return [
      `RedForge mission plan could not be derived for: ${result.prompt}`,
      "",
      "Assessment:",
      `- action: ${result.action}`,
      `- confidence: ${result.confidence}`,
      `- rationale: ${result.rationale.join("; ")}`,
    ].join("\n");
  }

  const warningLines =
    result.warnings.length > 0
      ? result.warnings.map((warning) => `  - ${warning}`).join("\n")
      : "  - none";
  const questionLines =
    result.questions.length > 0
      ? result.questions.map((question) => `  - ${question}`).join("\n")
      : "  - none";

  return [
    `RedForge mission plan could not be safely derived for: ${result.prompt}`,
    "",
    "Assessment:",
    `- action: ${result.action}`,
    `- confidence: ${result.confidence}`,
    `- rationale: ${result.rationale.join("; ")}`,
    "- warnings:",
    warningLines,
    "- questions:",
    questionLines,
  ].join("\n");
}
