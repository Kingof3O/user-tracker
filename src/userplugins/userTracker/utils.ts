export type TrackerKind = "roles" | "nick" | "join" | "leave" | "ban" | "unban" | "relationship" | "mutual-friend";

export interface TrackerEntry {
    id: string;
    ts: number;
    userId: string;
    userTag: string;
    guildId: string;
    guildName: string;
    kind: TrackerKind;
    detail: string;
}

const ID_RE = /\d{17,20}/g;

export function parseTrackedIds(raw: string): string[] {
    if (!raw) return [];
    const found = raw.match(ID_RE) ?? [];
    return [...new Set(found)];
}

export function isTracked(userId: string, tracked: string[]): boolean {
    return tracked.includes(userId);
}

export function diffRoles(oldRoles: string[], newRoles: string[]): { added: string[]; removed: string[] } {
    const oldSet = new Set(oldRoles ?? []);
    const newSet = new Set(newRoles ?? []);
    return {
        added: [...newSet].filter(r => !oldSet.has(r)),
        removed: [...oldSet].filter(r => !newSet.has(r)),
    };
}

export function formatRoleChange(userTag: string, guildName: string, addedNames: string[], removedNames: string[]): string {
    const parts: string[] = [];
    for (const n of addedNames) parts.push(`+${n}`);
    for (const n of removedNames) parts.push(`-${n}`);
    return `Tracker • ${userTag} in ${guildName}: ${parts.join(", ") || "no change"}`;
}

export function formatSimpleEvent(userTag: string, guildName: string, label: string): string {
    return `Tracker • ${userTag} in ${guildName}: ${label}`;
}

export function trimHistory<T>(entries: T[], limit: number = 200): T[] {
    const n = Number.isFinite(limit) ? Math.max(1, Math.min(Math.floor(limit), 1000)) : 200;
    if (entries.length <= n) return entries;
    return entries.slice(entries.length - n);
}

export function buildEntry(args: { userId: string; userTag: string; guildId: string; guildName: string; kind: TrackerKind; detail: string }): TrackerEntry {
    return {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        ts: Date.now(),
        userId: args.userId,
        userTag: args.userTag,
        guildId: args.guildId,
        guildName: args.guildName,
        kind: args.kind,
        detail: args.detail,
    };
}
