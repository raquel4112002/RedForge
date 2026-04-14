import { describe, expect, it } from "vitest";
import { gateMissionIntent } from "../../src/redforge/planner/mission-intent-gate.js";
import { buildMissionPlan } from "../../src/redforge/planner/mission-plan-core.js";
import {
  renderMissionIntentGateResult,
  renderMissionPlan,
} from "../../src/redforge/planner/mission-plan-render.js";

describe("renderMissionPlan", () => {
  it("renders a normal mission plan", () => {
    const plan = buildMissionPlan(
      "Recon the web target demo.example.local and identify likely attack surface",
      "~/.openclaw/workspace",
    );

    const rendered = renderMissionPlan(plan);

    expect(rendered).toContain("RedForge mission plan for:");
    expect(rendered).toContain("Intent:");
    expect(rendered).toContain("Planner assessment:");
    expect(rendered).toContain("Target:");
    expect(rendered).toContain("Scope:");
    expect(rendered).toContain("Mission:");
    expect(rendered).toContain("demo.example.local");
    expect(rendered).toContain("surface-mapping");
  });
});

describe("renderMissionIntentGateResult", () => {
  it("renders clarify output", () => {
    const gate = gateMissionIntent("Assess this environment for weaknesses");

    const rendered = renderMissionIntentGateResult(gate);

    expect(rendered).toContain("could not be safely derived");
    expect(rendered).toContain("action: clarify");
    expect(rendered).toContain("Which target should RedForge plan against?");
  });

  it("renders noop output", () => {
    const gate = gateMissionIntent("What is attack surface mapping?");

    const rendered = renderMissionIntentGateResult(gate);

    expect(rendered).toContain("could not be derived");
    expect(rendered).toContain("action: noop");
    expect(rendered).toContain("informational rather than operational");
  });
});
