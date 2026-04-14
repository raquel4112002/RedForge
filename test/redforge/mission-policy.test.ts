import { describe, expect, it } from "vitest";
import { evaluateMissionAutoRunPolicy } from "../../src/agents/planning/offensive/mission-policy.js";

describe("evaluateMissionAutoRunPolicy", () => {
  it("allows auto-run for high-confidence apply-and-run plans", () => {
    const decision = evaluateMissionAutoRunPolicy({
      confidence: "high",
      suggestedNextAction: "apply-and-run",
    });

    expect(decision.allowed).toBe(true);
    expect(decision.capability).toBe("offensive-planner");
    expect(decision.reason).toContain("high-confidence");
  });

  it("blocks auto-run for non-high confidence plans", () => {
    const decision = evaluateMissionAutoRunPolicy({
      confidence: "medium",
      suggestedNextAction: "apply-and-run",
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("did not produce");
  });
});
