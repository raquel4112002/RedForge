import fs from "node:fs/promises";
import path from "node:path";

export type OffensiveMemoryKind = "finding" | "observation" | "report" | "playbook" | "notes";

export type OffensiveMemoryRecord = {
  key: string;
  kind: OffensiveMemoryKind;
  targetId: string;
  organizationId?: string;
  missionId?: string;
  summary: string;
  source?: string;
  confidence?: "low" | "medium" | "high";
  outcome?: "success" | "failed" | "neutral";
  successCount: number;
  failedCount: number;
  tags: string[];
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
};

type OffensiveMemoryStore = {
  version: 1;
  updatedAt: string;
  records: OffensiveMemoryRecord[];
};

type UpsertMemoryInput = {
  kind: OffensiveMemoryKind;
  targetId: string;
  organizationId?: string;
  missionId?: string;
  summary: string;
  source?: string;
  confidence?: "low" | "medium" | "high";
  outcome?: "success" | "failed" | "neutral";
  tags?: string[];
  at?: string;
};

const STORE_VERSION = 1 as const;

function memoryStorePath(workspaceDir: string): string {
  return path.join(workspaceDir, "KNOWLEDGE", "offensive-memory.json");
}

function normalizeSummary(summary: string): string {
  return summary.replace(/\s+/g, " ").trim();
}

function buildMemoryKey(params: {
  kind: OffensiveMemoryKind;
  targetId: string;
  summary: string;
}): string {
  const normalizedSummary = normalizeSummary(params.summary).toLowerCase().slice(0, 180);
  return `${params.kind}:${params.targetId.toLowerCase()}:${normalizedSummary}`;
}

async function readStore(workspaceDir: string): Promise<OffensiveMemoryStore> {
  const storePath = memoryStorePath(workspaceDir);
  try {
    const raw = await fs.readFile(storePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<OffensiveMemoryStore>;
    if (
      parsed.version === STORE_VERSION &&
      Array.isArray(parsed.records) &&
      typeof parsed.updatedAt === "string"
    ) {
      return {
        version: STORE_VERSION,
        updatedAt: parsed.updatedAt,
        records: parsed.records
          .filter((entry) => Boolean(entry && entry.key && entry.summary))
          .map((entry) => ({
            ...entry,
            successCount: entry.successCount ?? 0,
            failedCount: entry.failedCount ?? 0,
          })),
      };
    }
  } catch {
    // fallback to empty store
  }
  return {
    version: STORE_VERSION,
    updatedAt: new Date().toISOString(),
    records: [],
  };
}

async function writeStore(workspaceDir: string, store: OffensiveMemoryStore): Promise<void> {
  const storePath = memoryStorePath(workspaceDir);
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(store, null, 2), "utf-8");
}

export async function upsertOperationalMemory(
  workspaceDir: string,
  entries: UpsertMemoryInput[],
): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  const store = await readStore(workspaceDir);
  const now = new Date().toISOString();

  for (const entry of entries) {
    const summary = normalizeSummary(entry.summary);
    if (!summary) {
      continue;
    }
    const key = buildMemoryKey({
      kind: entry.kind,
      targetId: entry.targetId,
      summary,
    });
    const at = entry.at ?? now;
    const existing = store.records.find((record) => record.key === key);
    if (existing) {
      existing.lastSeenAt = at;
      existing.count += 1;
      existing.organizationId = entry.organizationId ?? existing.organizationId;
      existing.missionId = entry.missionId ?? existing.missionId;
      existing.source = entry.source ?? existing.source;
      existing.confidence = entry.confidence ?? existing.confidence;
      existing.outcome = entry.outcome ?? existing.outcome;
      if (entry.outcome === "success") {
        existing.successCount += 1;
      } else if (entry.outcome === "failed") {
        existing.failedCount += 1;
      }
      existing.tags = [...new Set([...existing.tags, ...(entry.tags ?? [])])];
      continue;
    }

    store.records.push({
      key,
      kind: entry.kind,
      targetId: entry.targetId,
      organizationId: entry.organizationId,
      missionId: entry.missionId,
      summary,
      source: entry.source,
      confidence: entry.confidence,
      outcome: entry.outcome,
      successCount: entry.outcome === "success" ? 1 : 0,
      failedCount: entry.outcome === "failed" ? 1 : 0,
      tags: [...new Set(entry.tags ?? [])],
      count: 1,
      firstSeenAt: at,
      lastSeenAt: at,
    });
  }

  store.updatedAt = now;
  await writeStore(workspaceDir, store);
}

export async function readOperationalMemory(params: {
  workspaceDir: string;
  targetId: string;
  organizationId?: string;
  missionId?: string;
  primaryTarget?: string;
  kinds?: OffensiveMemoryKind[];
  limit?: number;
}): Promise<OffensiveMemoryRecord[]> {
  const store = await readStore(params.workspaceDir);
  const limit = Math.max(1, params.limit ?? 6);
  const targetNeedle = params.primaryTarget?.trim().toLowerCase() ?? "";
  const missionNeedle = params.missionId?.trim().toLowerCase() ?? "";
  const organizationNeedle = params.organizationId?.trim().toLowerCase() ?? "";
  const kindSet = params.kinds ? new Set(params.kinds) : null;

  return store.records
    .filter((record) => {
      if (kindSet && !kindSet.has(record.kind)) {
        return false;
      }
      if (record.targetId === params.targetId) {
        return true;
      }
      if (
        organizationNeedle &&
        record.organizationId &&
        record.organizationId.toLowerCase() === organizationNeedle
      ) {
        return true;
      }
      const normalized = record.summary.toLowerCase();
      if (missionNeedle && normalized.includes(missionNeedle)) {
        return true;
      }
      if (targetNeedle && normalized.includes(targetNeedle)) {
        return true;
      }
      return false;
    })
    .toSorted((a, b) => {
      const scoreA = a.successCount - a.failedCount;
      const scoreB = b.successCount - b.failedCount;
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
      return b.lastSeenAt.localeCompare(a.lastSeenAt);
    })
    .slice(0, limit);
}

export async function readAttemptGuidance(params: {
  workspaceDir: string;
  targetId: string;
  organizationId?: string;
  attemptKey: string;
  limit?: number;
}): Promise<OffensiveMemoryRecord[]> {
  const records = await readOperationalMemory({
    workspaceDir: params.workspaceDir,
    targetId: params.targetId,
    organizationId: params.organizationId,
    kinds: ["observation", "playbook", "finding"],
    limit: Math.max(1, (params.limit ?? 5) * 3),
  });
  const keyTag = `attempt-key:${params.attemptKey}`;
  return records
    .filter((record) => record.tags.includes(keyTag))
    .toSorted((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
    .slice(0, Math.max(1, params.limit ?? 5));
}
