export function diffMutuals(oldIds: string[], newIds: string[]): { added: string[]; removed: string[] } {
    const oldSet = new Set(oldIds ?? []);
    const newSet = new Set(newIds ?? []);
    return {
        added: [...newSet].filter(id => !oldSet.has(id)),
        removed: [...oldSet].filter(id => !newSet.has(id)),
    };
}

export function computeBackoff(failures: number): number {
    if (failures <= 0) return 0;
    return Math.min(2 ** (failures - 1), 8);
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
