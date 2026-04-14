import { describe, expect, it } from "vitest";
import { gateMissionIntent } from "../../src/redforge/planner/mission-intent-gate.js";

describe("gateMissionIntent", () => {
  it("accepts a valid web reconnaissance prompt", () => {
    const result = gateMissionIntent(
      "Recon the web target demo.example.local and identify likely attack surface",
    );

    expect(result.accepted).toBe(true);
    expect(result.action).toBe("apply");
    expect(result.target).toEqual({
      type: "domain",
      value: "demo.example.local",
    });
    expect(result.intent?.kind).toBe("surface-mapping");
    expect(result.intent?.scopeKind).toBe("web");
  });

  it("accepts a valid host enumeration prompt", () => {
    const result = gateMissionIntent(
      "Enumerate exposed services on 10.10.10.5 within bounded constraints",
    );

    expect(result.accepted).toBe(true);
    expect(result.action).toBe("apply");
    expect(result.target).toEqual({
      type: "ip",
      value: "10.10.10.5",
    });
    expect(result.intent?.kind).toBe("host-enumeration");
    expect(result.intent?.scopeKind).toBe("host");
    expect(result.confidence).toBe("high");
  });

  it("returns clarify for operational prompts without an inferable target", () => {
    const result = gateMissionIntent("Assess this environment for weaknesses");

    expect(result.accepted).toBe(false);
    expect(result.action).toBe("clarify");
    expect(result.target).toBeUndefined();
    expect(result.questions).toContain("Which target should RedForge plan against?");
    expect(result.questions).toContain(
      "Should this be treated as web, host, or broader environment assessment?",
    );
    expect(result.warnings).toContain("No target could be inferred from the prompt.");
  });

  it("returns noop for informational prompts", () => {
    const result = gateMissionIntent("What is attack surface mapping?");

    expect(result.accepted).toBe(false);
    expect(result.action).toBe("noop");
    expect(result.confidence).toBe("high");
    expect(result.target).toBeUndefined();
    expect(result.rationale).toContain("prompt appears informational rather than operational");
  });

  it("accepts a contextual hostname target", () => {
    const result = gateMissionIntent(
      "Enumerate services on host app-server-01 within bounded constraints",
    );

    expect(result.accepted).toBe(true);
    expect(result.action).toBe("apply");
    expect(result.target).toEqual({
      type: "hostname",
      value: "app-server-01",
    });
    expect(result.intent?.scopeKind).toBe("host");
  });
});
