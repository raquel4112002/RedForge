export type PlannedTarget = {
  id: string;
  name: string;
  type: "url" | "domain" | "ip" | "hostname";
  value: string;
  notes: string;
};

export type PlannedScope = {
  id: string;
  description: string;
  allowedTargets: string[];
  allowedTools: string[];
  forbiddenActions: string[];
  autonomy: string;
};

export type PlannedMission = {
  id: string;
  objective: string;
  target: string;
  scope: string;
  mode: string;
  outputs: string[];
};

export type InferredMissionIntent = {
  kind: "bounded-recon" | "web-assessment" | "host-enumeration" | "surface-mapping";
  scopeKind: "web" | "host" | "generic";
  rationale: string[];
};

export type PlannerConfidence = "high" | "medium" | "low";
export type PlannerNextAction = "apply" | "apply-and-run" | "ask-for-clarification";

export type MissionPlan = {
  workspaceDir: string;
  prompt: string;
  target: PlannedTarget;
  scope: PlannedScope;
  mission: PlannedMission;
  intent: InferredMissionIntent;
  warnings: string[];
  confidence: PlannerConfidence;
  suggestedNextAction: PlannerNextAction;
  toolFamilies: string[];
};

export type MissionIntentGateAction = "apply" | "clarify" | "refuse" | "noop";

export type MissionIntentGateResult = {
  accepted: boolean;
  action: MissionIntentGateAction;
  confidence: PlannerConfidence;
  prompt: string;
  target?: {
    type: PlannedTarget["type"] | "unknown";
    value: string;
  };
  intent?: InferredMissionIntent;
  warnings: string[];
  questions: string[];
  rationale: string[];
};
