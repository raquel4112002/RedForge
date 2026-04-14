import { describe, expect, it } from "vitest";
import { buildMissionPlan } from "../../src/redforge/planner/mission-plan-core.js";

describe("buildMissionPlan", () => {
  it("builds a coherent web mission plan", () => {
    const plan = buildMissionPlan(
      "Recon the web target demo.example.local and identify likely attack surface",
      "~/.openclaw/workspace",
    );

    expect(plan.target.id).toBe("demo-example-local");
    expect(plan.target.type).toBe("domain");
    expect(plan.scope.description).toBe("Bounded web assessment for demo.example.local");
    expect(plan.scope.allowedTools).toEqual(["bash", "web_fetch", "web_search"]);
    expect(plan.mission.mode).toBe("surface-mapping");
    expect(plan.suggestedNextAction).toBe("apply");
  });

  it("builds a coherent host mission plan", () => {
    const plan = buildMissionPlan(
      "Enumerate exposed services on 10.10.10.5 within bounded constraints",
      "~/.openclaw/workspace",
    );

    expect(plan.target.type).toBe("ip");
    expect(plan.scope.description).toBe("Bounded host assessment for 10.10.10.5");
    expect(plan.scope.allowedTools).toEqual(["bash", "web_search"]);
    expect(plan.confidence).toBe("high");
    expect(plan.suggestedNextAction).toBe("apply-and-run");
  });

  it("rejects prompts that do not pass the mission intent gate", () => {
    expect(() =>
      buildMissionPlan("What is attack surface mapping?", "~/.openclaw/workspace"),
    ).toThrow(/mission intent gate did not accept prompt/i);
  });
});
