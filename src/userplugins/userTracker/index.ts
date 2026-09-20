import { definePluginSettings } from "@api/Settings";
import * as DataStore from "@api/DataStore";
import definePlugin, { OptionType } from "@utils/types";
import { GuildStore, GuildMemberStore, UserStore, showToast, Toasts, Menu, React } from "@webpack/common";
import { buildEntry, diffRoles, formatRoleChange, formatSimpleEvent, isTracked, parseTrackedIds, trimHistory } from "./utils";
import type { TrackerEntry } from "./utils";

const settings = definePluginSettings({
    trackedIds: { type: OptionType.STRING, description: "Comma/space/newline separated user IDs to watch", default: "" },
    trackRoles: { type: OptionType.BOOLEAN, description: "Notify on role add/remove", default: true },
    trackNick: { type: OptionType.BOOLEAN, description: "Notify on nickname change", default: true },
    trackJoin: { type: OptionType.BOOLEAN, description: "Notify on join", default: true },
    trackLeave: { type: OptionType.BOOLEAN, description: "Notify on leave/remove (kick vs leave is ambiguous)", default: true },
    trackBan: { type: OptionType.BOOLEAN, description: "Notify on ban/unban", default: true },
    trackRelationship: { type: OptionType.BOOLEAN, description: "Notify when a tracked user friends/unfriends YOU (only direction Discord exposes)", default: true },
    showToast: { type: OptionType.BOOLEAN, description: "Show toast popups (history always records when enabled below)", default: true },
    historyLimit: { type: OptionType.NUMBER, description: "Max history entries kept (1-1000)", default: 200 },
});

const HISTORY_KEY = "UserTracker_history";
const roleCache = new Map<string, string[]>();
const nickCache = new Map<string, string | null>();
const history: TrackerEntry[] = [];
let loaded = false;

function trackedList(): string[] {
    return parseTrackedIds(settings.store.trackedIds ?? "");
}

function cacheKey(guildId: string, userId: string): string {
    return `${guildId}:${userId}`;
}

function guildNameOf(guildId: string): string {
    try {
        return GuildStore.getGuild(guildId)?.name ?? guildId;
    } catch { return guildId; }
}

function userTagOf(userId: string): string {
    try {
        const u = UserStore.getUser(userId) as any;
        if (!u) return userId;
        return u.globalName ? `${u.globalName} (@${u.username})` : `@${u.username ?? userId}`;
    } catch { return userId; }
}

function roleNameOf(guildId: string, roleId: string): string {
    try {
        return GuildStore.getRole(guildId, roleId)?.name ?? roleId;
    } catch { return roleId; }
}

async function persistHistory(): Promise<void> {
    try {
        await DataStore.set(HISTORY_KEY, trimHistory(history, Math.min(1000, Math.max(1, settings.store.historyLimit ?? 200))));
    } catch { /* IndexedDB unavailable in some contexts; history stays in memory */ }
}

async function record(entry: TrackerEntry): Promise<void> {
    history.push(entry);
    const trimmed = trimHistory(history, Math.min(1000, Math.max(1, settings.store.historyLimit ?? 200)));
    history.length = 0;
    history.push(...trimmed);
    if (settings.store.showToast) {
        try {
            showToast(entry.detail, Toasts.Type.MESSAGE, { duration: 5000 });
        } catch { /* toasts unavailable during startup; history still records */ }
    }
    void persistHistory();
}

function handleMemberUpdate(e: any): void {
    const userId: string | undefined = e?.user?.id ?? e?.userId;
    const guildId: string | undefined = e?.guildId;
    if (!userId || !guildId || !isTracked(userId, trackedList())) return;
    const newRoles: string[] = Array.isArray(e?.roles) ? e.roles : [];
    const key = cacheKey(guildId, userId);
    const oldRoles = roleCache.get(key);
    roleCache.set(key, [...newRoles]);
    const hasNickInfo = typeof e?.nick !== "undefined";
    const cachedNick = nickCache.get(key);
    let nickChanged = false;
    if (hasNickInfo) {
        const newNick: string | null = e.nick ?? null;
        if (cachedNick !== undefined && newNick !== cachedNick) {
            nickChanged = true;
        }
        nickCache.set(key, newNick);
    }
    if (!oldRoles) return;
    const { added, removed } = diffRoles(oldRoles, newRoles);
    if (settings.store.trackRoles && (added.length > 0 || removed.length > 0)) {
        const detail = formatRoleChange(userTagOf(userId), guildNameOf(guildId), added.map(r => roleNameOf(guildId, r)), removed.map(r => roleNameOf(guildId, r)));
        void record(buildEntry({ userId, userTag: userTagOf(userId), guildId, guildName: guildNameOf(guildId), kind: "roles", detail }));
    }
    if (settings.store.trackNick && nickChanged) {
        const detail = formatSimpleEvent(userTagOf(userId), guildNameOf(guildId), `nickname → ${String(e.nick ?? "none")}`);
        void record(buildEntry({ userId, userTag: userTagOf(userId), guildId, guildName: guildNameOf(guildId), kind: "nick", detail }));
    }
}

function handleMemberAdd(e: any): void {
    const userId: string | undefined = e?.user?.id ?? e?.userId;
    const guildId: string | undefined = e?.guildId ?? e?.guild?.id;
    if (!userId || !guildId || !isTracked(userId, trackedList())) return;
    if (Array.isArray(e?.roles)) roleCache.set(cacheKey(guildId, userId), [...e.roles]);
    nickCache.set(cacheKey(guildId, userId), e.nick ?? null);
    if (!settings.store.trackJoin) return;
    const detail = formatSimpleEvent(userTagOf(userId), guildNameOf(guildId), "joined");
    void record(buildEntry({ userId, userTag: userTagOf(userId), guildId, guildName: guildNameOf(guildId), kind: "join", detail }));
}

function handleMemberRemove(e: any): void {
    const userId: string | undefined = e?.user?.id ?? e?.userId;
    const guildId: string | undefined = e?.guildId;
    if (!userId || !guildId || !isTracked(userId, trackedList())) return;
    roleCache.delete(cacheKey(guildId, userId));
    nickCache.delete(cacheKey(guildId, userId));
    if (!settings.store.trackLeave) return;
    const detail = formatSimpleEvent(userTagOf(userId), guildNameOf(guildId), "left or was removed (check audit log for kick vs leave)");
    void record(buildEntry({ userId, userTag: userTagOf(userId), guildId, guildName: guildNameOf(guildId), kind: "leave", detail }));
}

function handleBanAdd(e: any): void {
    const userId: string | undefined = e?.user?.id ?? e?.userId;
    const guildId: string | undefined = e?.guildId;
    if (!userId || !guildId || !isTracked(userId, trackedList())) return;
    if (!settings.store.trackBan) return;
    const detail = formatSimpleEvent(userTagOf(userId), guildNameOf(guildId), "banned");
    void record(buildEntry({ userId, userTag: userTagOf(userId), guildId: guildId, guildName: guildNameOf(guildId), kind: "ban", detail }));
}

function handleBanRemove(e: any): void {
    const userId: string | undefined = e?.user?.id ?? e?.userId;
    const guildId: string | undefined = e?.guildId;
    if (!userId || !guildId || !isTracked(userId, trackedList())) return;
    if (!settings.store.trackBan) return;
    const detail = formatSimpleEvent(userTagOf(userId), guildNameOf(guildId), "unbanned");
    void record(buildEntry({ userId, userTag: userTagOf(userId), guildId, guildName: guildNameOf(guildId), kind: "unban", detail }));
}

function handleRelationship(e: any, action: "add" | "remove"): void {
    const userId: string | undefined = e?.userId ?? e?.user?.id;
    if (!userId || !isTracked(userId, trackedList())) return;
    if (!settings.store.trackRelationship) return;
    const relType = e?.relationship?.type ?? e?.type;
    const tag = userTagOf(userId);
    let detail: string;
    if (action === "add") {
        if (relType === 2) {
            detail = `Tracker • ${tag}: blocked you`;
        } else if (relType === 3) {
            detail = `Tracker • ${tag} sent you a friend request`;
        } else if (relType === 4) {
            detail = `Tracker • ${tag} received your friend request`;
        } else {
            detail = `Tracker • ${tag}: became friends with you`;
        }
    } else {
        const label = relType === 2 ? "unblocked" : "unfriended";
        detail = `Tracker • ${tag}: ${label} you`;
    }
    void record(buildEntry({ userId, userTag: tag, guildId: "@me", guildName: "Direct relationship", kind: "relationship", detail }));
}

export default definePlugin({
    name: "UserTracker",
    description: "Watch specific users across mutual servers: roles, nick, join, leave/remove, ban, plus you-target friend changes. Toasts + persistent history.",
    authors: [{ name: "you", id: 0n }],
    settings,
    flux: {
        GUILD_MEMBER_UPDATE(e) { handleMemberUpdate(e); },
        GUILD_MEMBER_ADD(e) { handleMemberAdd(e); },
        GUILD_MEMBER_REMOVE(e) { handleMemberRemove(e); },
        GUILD_BAN_ADD(e) { handleBanAdd(e); },
        GUILD_BAN_REMOVE(e) { handleBanRemove(e); },
        RELATIONSHIP_ADD(e) { handleRelationship(e, "add"); },
        RELATIONSHIP_REMOVE(e) { handleRelationship(e, "remove"); },
    },
    contextMenus: {
        "user-context"(children, props: any) {
            try {
                const userId: string | undefined = props?.user?.id;
                if (!userId) return;
                const list = trackedList();
                const tracked = list.includes(userId);
                children.push(
                    React.createElement(Menu.MenuItem, {
                        id: "usertracker-toggle",
                        label: tracked ? "Untrack user (UserTracker)" : "Track user (UserTracker)",
                        action: () => {
                            const next = tracked ? list.filter(id => id !== userId) : [...list, userId];
                            settings.store.trackedIds = next.join(", ");
                        },
                    })
                );
            } catch { /* context menu is best-effort */ }
        },
    },
    async start() {
        roleCache.clear();
        nickCache.clear();
        if (!loaded) {
            loaded = true;
            try {
                const saved = await DataStore.get<TrackerEntry[]>(HISTORY_KEY);
                if (Array.isArray(saved)) history.push(...trimHistory(saved, 1000));
            } catch { /* fresh start with empty history */ }
        }
        try {
            for (const userId of trackedList()) {
                for (const guildId of Object.keys(GuildStore.getGuilds?.() ?? {})) {
                    try {
                        const member = GuildMemberStore.getMember(guildId, userId);
                        const roles = member?.roles;
                        if (Array.isArray(roles)) roleCache.set(cacheKey(guildId, userId), [...roles]);
                        nickCache.set(cacheKey(guildId, userId), member?.nick ?? null);
                    } catch { /* uncached member; fills lazily on first UPDATE */ }
                }
            }
        } catch { /* stores not ready yet; cache fills lazily */ }
    },
    stop() {
        roleCache.clear();
        nickCache.clear();
    },
});
