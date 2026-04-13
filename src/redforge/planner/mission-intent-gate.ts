import type {
  InferredMissionIntent,
  MissionIntentGateResult,
  PlannedTarget,
  PlannerConfidence,
} from "./mission-plan-types.js";

const MISSION_KEYWORDS = [
  "recon",
  "enumerat",
  "assess",
  "identify",
  "map",
  "attack surface",
  "services",
  "target",
  "scan",
  "probe",
  "discover",
] as const;

const INFORMATIONAL_PATTERNS = [
  /\bwhat is\b/iu,
  /\bexplain\b/iu,
  /\bdifference between\b/iu,
  /\bsummarize\b/iu,
  /\brewrite\b/iu,
  /\btranslate\b/iu,
] as const;

export function detectTargetValue(prompt: string): {
  type: PlannedTarget["type"];
  value: string;
} {
  const urlMatch = prompt.match(/https?:\/\/[^\s]+/iu);
  if (urlMatch) {
    return { type: "url", value: urlMatch[0] };
  }

  const ipMatch = prompt.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/u);
  if (ipMatch) {
    return { type: "ip", value: ipMatch[0] };
  }

  const domainMatch = prompt.match(/\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/iu);
  if (domainMatch) {
    return { type: "domain", value: domainMatch[0].toLowerCase() };
  }

  const hostMatch = prompt.match(/\b[a-z0-9][a-z0-9-]{1,62}\b/iu);
  if (hostMatch) {
    return { type: "hostname", value: hostMatch[0] };
  }

  throw new Error("Could not infer target from prompt");
}

export function inferMissionIntent(
  prompt: string,
  targetType: PlannedTarget["type"],
): InferredMissionIntent {
  const lower = prompt.toLowerCase();
  const rationale: string[] = [];

  let kind: InferredMissionIntent["kind"] = "bounded-recon";
  if (lower.includes("attack surface")) {
    kind = "surface-mapping";
    rationale.push("prompt contains attack-surface language");
  } else if (lower.includes("enumerat")) {
    kind = "host-enumeration";
    rationale.push("prompt contains enumeration language");
  } else if (lower.includes("web")) {
    kind = "web-assessment";
    rationale.push("prompt contains web-specific language");
  } else if (lower.includes("recon")) {
    kind = "bounded-recon";
    rationale.push("prompt contains reconnaissance language");
  }

  let scopeKind: InferredMissionIntent["scopeKind"] = "generic";
  if (targetType === "url" || targetType === "domain" || lower.includes("web")) {
    scopeKind = "web";
    rationale.push("target appears to be web-oriented");
  } else if (targetType === "ip" || targetType === "hostname") {
    scopeKind = "host";
    rationale.push("target appears to be host-oriented");
  }

  if (rationale.length === 0) {
    rationale.push("using bounded reconnaissance defaults");
  }

  return {
    kind,
    scopeKind,
    rationale,
  };
}

export function inferGateWarnings(params: {
  prompt: string;
  target?: { type: PlannedTarget["type"] | "unknown"; value: string };
  intent?: InferredMissionIntent;
}): string[] {
  const warnings: string[] = [];
  if (params.prompt.trim().split(/\s+/u).length < 6) {
    warnings.push("Prompt is short; mission intent may be underspecified.");
  }
  if (!params.target) {
    warnings.push("No target could be inferred from the prompt.");
  }
  if (params.intent?.scopeKind === "generic") {
    warnings.push("Scope kind fell back to generic defaults.");
  }
  if (params.target?.type === "hostname") {
    warnings.push("Target was inferred as a generic hostname; verify target semantics.");
  }
  if (!/within|bounded|scope|limit|only|without/iu.test(params.prompt)) {
    warnings.push("No explicit operational constraints were provided.");
  }
  return warnings;
}

function inferGateConfidence(params: {
  target?: { type: PlannedTarget["type"] | "unknown"; value: string };
  intent?: InferredMissionIntent;
  warnings: string[];
}): PlannerConfidence {
  if (
    params.target &&
    ["url", "domain", "ip"].includes(params.target.type) &&
    (params.intent?.rationale.length ?? 0) >= 2 &&
    params.warnings.length === 0
  ) {
    return "high";
  }
  if (!params.target || params.warnings.length >= 2 || params.target.type === "hostname") {
    return "low";
  }
  return "medium";
}

export function gateMissionIntent(prompt: string): MissionIntentGateResult {
  const normalizedPrompt = prompt.trim();
  if (!normalizedPrompt) {
    throw new Error("prompt is required");
  }

  const lower = normalizedPrompt.toLowerCase();
  const isInformational = INFORMATIONAL_PATTERNS.some((pattern) => pattern.test(normalizedPrompt));
  const looksOperational = MISSION_KEYWORDS.some((keyword) => lower.includes(keyword));

  if (isInformational && !looksOperational) {
    return {
      accepted: false,
      action: "noop",
      confidence: "high",
      prompt: normalizedPrompt,
      warnings: [],
      questions: [],
      rationale: ["prompt appears informational rather than operational"],
    };
  }

  let target: MissionIntentGateResult["target"];
  try {
    target = detectTargetValue(normalizedPrompt);
  } catch {
    target = undefined;
  }

  const intent =
    target && target.type !== "unknown"
      ? inferMissionIntent(normalizedPrompt, target.type)
      : undefined;
  const warnings = inferGateWarnings({
    prompt: normalizedPrompt,
    target,
    intent,
  });
  const confidence = inferGateConfidence({
    target,
    intent,
    warnings,
  });

  if (!looksOperational && !target) {
    return {
      accepted: false,
      action: "noop",
      confidence: "medium",
      prompt: normalizedPrompt,
      warnings,
      questions: [],
      rationale: ["prompt does not clearly describe a RedForge mission"],
    };
  }

  if (!target) {
    return {
      accepted: false,
      action: "clarify",
      confidence,
      prompt: normalizedPrompt,
      intent,
      warnings,
      questions: ["Which target should RedForge plan against?"],
      rationale: ["prompt suggests an operational task but no target could be inferred"],
    };
  }

  return {
    accepted: true,
    action: "apply",
    confidence,
    prompt: normalizedPrompt,
    target,
    intent,
    warnings,
    questions: [],
    rationale: intent?.rationale ?? ["target and mission intent were inferred from the prompt"],
  };
}
