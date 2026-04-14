import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  readOperationalMemory,
  upsertOperationalMemory,
} from "../../src/agents/planning/offensive/mission-memory.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    }),
  );
});

async function mkWorkspace(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-"));
  tempDirs.push(dir);
  return dir;
}

describe("operational memory store", () => {
  it("upserts and deduplicates findings by semantic key", async () => {
    const workspaceDir = await mkWorkspace();

    await upsertOperationalMemory(workspaceDir, [
      {
        kind: "finding",
        targetId: "target-1",
        missionId: "mission-1",
        summary: "Interesting application surface identified",
        confidence: "medium",
      },
    ]);
    await upsertOperationalMemory(workspaceDir, [
      {
        kind: "finding",
        targetId: "target-1",
        missionId: "mission-1",
        summary: "Interesting application surface identified",
        confidence: "medium",
      },
    ]);

    const entries = await readOperationalMemory({
      workspaceDir,
      targetId: "target-1",
      missionId: "mission-1",
      limit: 10,
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].count).toBe(2);
  });

  it("filters by target and limits results", async () => {
    const workspaceDir = await mkWorkspace();

    await upsertOperationalMemory(workspaceDir, [
      {
        kind: "finding",
        targetId: "target-a",
        missionId: "mission-a",
        summary: "First record",
      },
      {
        kind: "finding",
        targetId: "target-b",
        missionId: "mission-b",
        summary: "Second record",
      },
    ]);

    const entries = await readOperationalMemory({
      workspaceDir,
      targetId: "target-a",
      missionId: "mission-a",
      limit: 1,
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].targetId).toBe("target-a");
  });
});
