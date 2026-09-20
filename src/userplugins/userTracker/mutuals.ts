import { isValidSnowflake } from "./utils.ts";

export function diffMutuals(oldIds: string[], newIds: string[]): { added: string[]; removed: string[] } {
    const oldSet = new Set(oldIds ?? []);
    const newSet = new Set(newIds ?? []);
    return {
        added: [...newSet].filter(id => !oldSet.has(id)),
        removed: [...oldSet].filter(id => !newSet.has(id)),
    };
}

export function computeBackoff(failures: number, is429: boolean = false): number {
    if (failures <= 0 && !is429) return 0;
    if (is429) {
        return Math.min(16 * (2 ** Math.max(0, failures - 1)), 32);
    }
    return Math.min(2 ** (failures - 1), 8);
}

export function isRateLimited(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;
    const err = error as Record<string, any>;
    if (err.status === 429 || err.statusCode === 429) return true;
    if (err.response && (err.response.status === 429 || err.response.statusCode === 429)) return true;
    if (typeof err.message === "string" && (err.message.includes("429") || /rate\s*limit/i.test(err.message))) return true;
    return false;
}

export function getRateLimitCooldown(is429: boolean, retryAfterMs?: number): number {
    if (!is429) return 0;
    const minCooldownMs = 10 * 60 * 1000; // 10 minutes minimum
    if (typeof retryAfterMs === "number" && Number.isFinite(retryAfterMs) && retryAfterMs > minCooldownMs) {
        return retryAfterMs;
    }
    return minCooldownMs;
}

export function capMutualTargets(tracked: string[], maxLimit: number = 25): string[] {
    if (!Array.isArray(tracked)) return [];
    return tracked.slice(0, Math.max(1, maxLimit));
}

export function isValidMutualCacheEntry(entry: unknown): entry is [string, string[]] {
    if (!Array.isArray(entry) || entry.length !== 2) return false;
    const [userId, ids] = entry;
    if (!isValidSnowflake(userId)) return false;
    if (!Array.isArray(ids)) return false;
    return ids.every(id => isValidSnowflake(id));
}

export function snapshotUsable(listLength: number, totalCount: number | undefined): boolean {
    if (typeof totalCount !== "number" || !Number.isFinite(totalCount)) return true;
    return listLength >= totalCount;
}

export function formatMutualEvent(targetTag: string, friendTag: string, kind: "added" | "removed"): string {
    return kind === "added"
        ? `Tracker • ${targetTag} became friends with ${friendTag}`
        : `Tracker • ${targetTag} unfriended ${friendTag}`;
}

