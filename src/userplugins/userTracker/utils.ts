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
const SNOWFLAKE_RE = /^\d{17,20}$/;

export function isValidSnowflake(id: unknown): id is string {
    return typeof id === "string" && SNOWFLAKE_RE.test(id);
}

export function sanitizeText(text: unknown, maxLength: number = 300): string {
    if (typeof text !== "string") {
        if (text === null || text === undefined) return "";
        text = String(text);
    }
    const sanitized = (text as string)
        .replace(/[\r\n\t]+/g, " ")
        .replace(/[\x00-\x1F\x7F\u200B-\u200D\uFEFF\u202A-\u202E\u2066-\u2069]/g, "")
        .trim();
    return sanitized.slice(0, Math.max(1, maxLength));
}

export function isValidTrackerEntry(entry: unknown): entry is TrackerEntry {
    if (!entry || typeof entry !== "object") return false;
    const e = entry as Partial<TrackerEntry>;
    const validKinds = new Set<string>(["roles", "nick", "join", "leave", "ban", "unban", "relationship", "mutual-friend"]);
    return (
        typeof e.id === "string" && e.id.length > 0 &&
        typeof e.ts === "number" && Number.isFinite(e.ts) && e.ts > 0 &&
        isValidSnowflake(e.userId) &&
        typeof e.userTag === "string" && e.userTag.length > 0 &&
        typeof e.guildId === "string" && e.guildId.length > 0 &&
        typeof e.guildName === "string" && e.guildName.length > 0 &&
        typeof e.kind === "string" && validKinds.has(e.kind) &&
        typeof e.detail === "string" && e.detail.length > 0
    );
}

export function parseTrackedIds(raw: unknown): string[] {
    if (typeof raw !== "string" || !raw) return [];
    const found = raw.match(ID_RE) ?? [];
    return [...new Set(found)].filter(id => isValidSnowflake(id));
}

export function isTracked(userId: unknown, tracked: string[]): boolean {
    if (!isValidSnowflake(userId) || !Array.isArray(tracked)) return false;
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
    for (const n of addedNames) parts.push(`+${sanitizeText(n, 50)}`);
    for (const n of removedNames) parts.push(`-${sanitizeText(n, 50)}`);
    return `Tracker • ${sanitizeText(userTag, 100)} in ${sanitizeText(guildName, 100)}: ${parts.join(", ") || "no change"}`;
}

export function formatSimpleEvent(userTag: string, guildName: string, label: string): string {
    return `Tracker • ${sanitizeText(userTag, 100)} in ${sanitizeText(guildName, 100)}: ${sanitizeText(label, 150)}`;
}

export function trimHistory<T>(entries: T[], limit: number = 200): T[] {
    const n = Number.isFinite(limit) ? Math.max(1, Math.min(Math.floor(limit), 1000)) : 200;
    if (!Array.isArray(entries)) return [];
    if (entries.length <= n) return entries;
    return entries.slice(entries.length - n);
}

export function buildEntry(args: { userId: string; userTag: string; guildId: string; guildName: string; kind: TrackerKind; detail: string }): TrackerEntry {
    return {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        ts: Date.now(),
        userId: args.userId,
        userTag: sanitizeText(args.userTag, 100),
        guildId: args.guildId,
        guildName: sanitizeText(args.guildName, 100),
        kind: args.kind,
        detail: sanitizeText(args.detail, 300),
    };
}

