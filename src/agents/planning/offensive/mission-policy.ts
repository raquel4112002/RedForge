import type { MissionPlan, PlannerConfidence, PlannerNextAction } from "./mission-plan-types.js";

export type OffensivePlannerCapability = "offensive-planner";

export type MissionRunPolicyDecision = {
  allowed: boolean;
  capability: OffensivePlannerCapability;
  confidence: PlannerConfidence;
  suggestedNextAction: PlannerNextAction;
  reason: string;
};

type MissionRunPolicyInput = Pick<MissionPlan, "confidence" | "suggestedNextAction">;

export function evaluateMissionAutoRunPolicy(
  plan: MissionRunPolicyInput,
): MissionRunPolicyDecision {
  if (plan.suggestedNextAction === "apply-and-run" && plan.confidence === "high") {
    return {
      allowed: true,
      capability: "offensive-planner",
      confidence: plan.confidence,
      suggestedNextAction: plan.suggestedNextAction,
      reason: "planner produced high-confidence apply-and-run recommendation",
    };
  }

  return {
    allowed: false,
    capability: "offensive-planner",
    confidence: plan.confidence,
    suggestedNextAction: plan.suggestedNextAction,
    reason: "planner did not produce a high-confidence apply-and-run recommendation",
  };
}
