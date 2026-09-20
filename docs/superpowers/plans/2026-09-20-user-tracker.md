# UserTracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runtime-only Vencord userplugin that watches multiple user IDs across mutual guilds and toasts + logs role, nick, join, leave, ban, and you-target relationship changes.

**Architecture:** Pure logic in `utils.ts` (no Discord imports, fully unit-tested with Node) plus thin Vencord adapter in `index.ts` using `definePlugin({ flux, contextMenus, settings })`, `showToast` from `@webpack/common`, and history persisted via `@api/DataStore`. No webpack `patches[]`.

**Tech Stack:** TypeScript (erasable syntax only in utils.ts), Vencord plugin API (`@utils/types`, `@api/Settings`, `@webpack/common`, `@api/DataStore`, `@api/ContextMenu` types via `contextMenus` field), Node >=22 built-in test runner (`node --test`, type-stripping, zero deps).

**Spec:** `docs/superpowers/specs/2026-09-20-vencord-user-tracker-design.md`

## Global Constraints

- Runtime-only plugin: no `patches[]`, no Discord restart required for start/stop.
- Vencord source build required: plugin lives at `src/userplugins/userTracker/` inside a Vencord checkout (this repo mirrors that path as `src/userplugins/userTracker/` for direct copy/symlink).
- `GUILD_MEMBER_REMOVE` must be labeled `left or was removed` — never claim `kicked` without audit-log proof.
- `RELATIONSHIP_ADD/REMOVE` only fires for your own account — friend tracking is strictly you-target, never target-stranger.
- No polling loops, no bulk member fetching, no token use.
- History cap default 200, max 1000.
- Client mods violate Discord ToS — manual Discord testing uses an alt/test server, never a primary account.
- `utils.ts` must contain zero Vencord imports so `node --test` runs without Discord.

---

## File Structure

- Create: `src/userplugins/userTracker/utils.ts` — pure functions only. Responsibility: parse watchlist, diff roles, format messages, trim history, build history entries. Zero Vencord imports.
- Create: `src/userplugins/userTracker/index.ts` — Vencord adapter. Responsibility: `definePlugin`, `definePluginSettings`, `flux` handlers, role cache, `showToast` calls, `DataStore` history load/save, `contextMenus` track/untrack.
- Create: `tests/userTracker.utils.test.ts` — Node built-in tests for every pure function. Responsibility: prove utils correct without Discord.
- Create: `src/userplugins/userTracker/README.md` — install (copy into Vencord `src/userplugins/`, rebuild), usage, limits, troubleshooting.
- Modify: none (greenfield; this repo has no Vencord checkout checked in).

Interfaces shared across tasks (exact names, do not rename):
- `parseTrackedIds(raw: string): string[]`
- `isTracked(userId: string, tracked: string[]): boolean`
- `diffRoles(oldRoles: string[], newRoles: string[]): { added: string[]; removed: string[] }`
- `formatRoleChange(userTag: string, guildName: string, addedNames: string[], removedNames: string[]): string`
- `formatSimpleEvent(userTag: string, guildName: string, label: string): string`
- `trimHistory<T>(entries: T[], limit: number): T[]`
- `TrackerKind = "roles" | "nick" | "join" | "leave" | "ban" | "unban" | "relationship"`
- `TrackerEntry = { id: string; ts: number; userId: string; userTag: string; guildId: string; guildName: string; kind: TrackerKind; detail: string }`
- `buildEntry(args: { userId: string; userTag: string; guildId: string; guildName: string; kind: TrackerKind; detail: string }): TrackerEntry`

---

### Task 1: Pure tracker logic + tests

**Files:**
- Create: `src/userplugins/userTracker/utils.ts`
- Test: `tests/userTracker.utils.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `parseTrackedIds`, `isTracked`, `diffRoles`, `formatRoleChange`, `formatSimpleEvent`, `trimHistory`, `TrackerKind`, `TrackerEntry`, `buildEntry` with exact signatures above for Task 2 to import.

- [ ] **Step 1: Write the failing test file**

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseTrackedIds, isTracked, diffRoles, formatRoleChange, formatSimpleEvent, trimHistory, buildEntry } from "../src/userplugins/userTracker/utils.ts";

describe("parseTrackedIds", () => {
    it("extracts 17-20 digit ids from mixed separators", () => {
        assert.deepEqual(parseTrackedIds("123456789012345678, 987654321098765432\nnot-an-id 123"), ["123456789012345678", "987654321098765432"]);
    });
    it("dedupes and returns empty for blank", () => {
        assert.deepEqual(parseTrackedIds("123456789012345678 123456789012345678"), ["123456789012345678"]);
        assert.deepEqual(parseTrackedIds("   ,, \n"), []);
    });
});

describe("isTracked", () => {
    it("matches exact id only", () => {
        assert.equal(isTracked("123456789012345678", ["123456789012345678"]), true);
        assert.equal(isTracked("123", ["123456789012345678"]), false);
    });
});

describe("diffRoles", () => {
    it("computes added and removed", () => {
        assert.deepEqual(diffRoles(["1", "2"], ["2", "3"]), { added: ["3"], removed: ["1"] });
        assert.deepEqual(diffRoles([], []), { added: [], removed: [] });
    });
});

describe("formatRoleChange", () => {
    it("formats adds and removes", () => {
        const msg = formatRoleChange("@bob", "MyServer", ["Admin"], ["Mod"]);
        assert.ok(msg.includes("@bob") && msg.includes("MyServer") && msg.includes("+Admin") && msg.includes("-Mod"));
    });
});

describe("formatSimpleEvent", () => {
    it("formats join/leave/ban labels", () => {
        assert.equal(formatSimpleEvent("@bob", "MyServer", "joined"), "Tracker • @bob in MyServer: joined");
    });
});

describe("trimHistory", () => {
    it("keeps newest N", () => {
        assert.deepEqual(trimHistory([1, 2, 3, 4], 2), [3, 4]);
        assert.deepEqual(trimHistory([1], 200), [1]);
    });
});

describe("buildEntry", () => {
    it("builds entry with id and ts", () => {
        const e = buildEntry({ userId: "123456789012345678", userTag: "@bob", guildId: "G1", guildName: "MyServer", kind: "join", detail: "joined" });
        assert.equal(e.userId, "123456789012345678");
        assert.equal(e.kind, "join");
        assert.ok(typeof e.id === "string" && e.id.length > 0);
        assert.ok(typeof e.ts === "number" && e.ts > 0);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/userTracker.utils.test.ts`
Expected: FAIL with `Cannot find module .../utils.ts` (file does not exist yet).

- [ ] **Step 3: Write minimal utils implementation**

```ts
export type TrackerKind = "roles" | "nick" | "join" | "leave" | "ban" | "unban" | "relationship";

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

export function trimHistory<T>(entries: T[], limit: number): T[] {
    const n = Math.max(0, Math.min(Math.floor(limit), 1000));
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/userTracker.utils.test.ts`
Expected: PASS, 8 subtests passed, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add src/userplugins/userTracker/utils.ts tests/userTracker.utils.test.ts
git commit -m "feat: add pure userTracker logic with tests"
```

---

### Task 2: Vencord plugin adapter (settings, flux, toasts, history)

**Files:**
- Create: `src/userplugins/userTracker/index.ts`
- Test: manual + `npx tsc --noEmit` typecheck inside a Vencord checkout (Task 3 covers full build); in this repo verify with `node --check` equivalent via esbuild-free import check is skipped — correctness comes from Task 1 tests + Task 3 Vencord build.

**Interfaces:**
- Consumes: all eight exports from Task 1 with exact names above.
- Produces: default-exported Vencord plugin `UserTracker` with settings keys `trackedIds, trackRoles, trackNick, trackJoin, trackLeave, trackBan, trackRelationship, showToast, historyLimit`, flux handlers for `GUILD_MEMBER_UPDATE, GUILD_MEMBER_ADD, GUILD_MEMBER_REMOVE, GUILD_BAN_ADD, GUILD_BAN_REMOVE, RELATIONSHIP_ADD, RELATIONSHIP_REMOVE`, and `contextMenus["user-context"]`. Task 3 consumes the settings keys and history component.

- [ ] **Step 1: Write the plugin file**

```ts
import { definePluginSettings } from "@api/Settings";
import * as DataStore from "@api/DataStore";
import definePlugin, { OptionType } from "@utils/types";
import { GuildStore, GuildMemberStore, UserStore, showToast, Toasts } from "@webpack/common";
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
        await DataStore.set(HISTORY_KEY, trimHistory(history, settings.store.historyLimit ?? 200));
    } catch { /* IndexedDB unavailable in some contexts; history stays in memory */ }
}

async function record(entry: TrackerEntry): Promise<void> {
    history.push(entry);
    const trimmed = trimHistory(history, settings.store.historyLimit ?? 200);
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
    if (!oldRoles) return;
    const { added, removed } = diffRoles(oldRoles, newRoles);
    const nickChanged = typeof e?.nick !== "undefined" && e.nick !== e?.oldNick;
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
    if (!settings.store.trackJoin) return;
    const detail = formatSimpleEvent(userTagOf(userId), guildNameOf(guildId), "joined");
    void record(buildEntry({ userId, userTag: userTagOf(userId), guildId, guildName: guildNameOf(guildId), kind: "join", detail }));
}

function handleMemberRemove(e: any): void {
    const userId: string | undefined = e?.user?.id ?? e?.userId;
    const guildId: string | undefined = e?.guildId;
    if (!userId || !guildId || !isTracked(userId, trackedList())) return;
    roleCache.delete(cacheKey(guildId, userId));
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

function handleRelationship(e: any, label: string): void {
    const userId: string | undefined = e?.userId ?? e?.user?.id;
    if (!userId || !isTracked(userId, trackedList())) return;
    if (!settings.store.trackRelationship) return;
    const detail = `Tracker • ${userTagOf(userId)}: ${label} you`;
    void record(buildEntry({ userId, userTag: userTagOf(userId), guildId: "@me", guildName: "Direct relationship", kind: "relationship", detail }));
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
        RELATIONSHIP_ADD(e) { handleRelationship(e, "became friends with"); },
        RELATIONSHIP_REMOVE(e) { handleRelationship(e, "unfriended"); },
    },
    contextMenus: {
        "user-context"(children, props: any) {
            try {
                const userId: string | undefined = props?.user?.id;
                if (!userId) return;
                const { Menu } = require("@webpack/common") as typeof import("@webpack/common");
                const list = trackedList();
                const tracked = list.includes(userId);
                children.push(
                    (require("@webpack/common").React as typeof import("react")).createElement(Menu.MenuItem, {
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
                        const roles = GuildMemberStore.getMember(guildId, userId)?.roles;
                        if (Array.isArray(roles)) roleCache.set(cacheKey(guildId, userId), [...roles]);
                    } catch { /* uncached member; fills lazily on first UPDATE */ }
                }
            }
        } catch { /* stores not ready yet; cache fills lazily */ }
    },
    stop() {
        roleCache.clear();
    },
});
```

- [ ] **Step 2: Verify Task 1 tests still pass (no regression)**

Run: `node --test tests/userTracker.utils.test.ts`
Expected: PASS. This proves the adapter did not break pure logic (adapter is not imported by tests, but the shared `utils.ts` contract still holds).

- [ ] **Step 3: Commit**

```bash
git add src/userplugins/userTracker/index.ts
git commit -m "feat: add UserTracker Vencord adapter with flux and history"
```

---

### Task 3: Docs, history UI wiring check, and Vencord verification

**Files:**
- Create: `src/userplugins/userTracker/README.md`
- Modify: `src/userplugins/userTracker/index.ts` only if verification finds import errors (document exact diff in commit message).

**Interfaces:**
- Consumes: settings keys and `HISTORY_KEY = "UserTracker_history"` from Task 2.
- Produces: installable plugin folder + verified build steps. No new exported functions.

- [ ] **Step 1: Write the README**

```md
# UserTracker (Vencord userplugin)

Watch specific users across servers you share: roles, nick, join, leave/remove, ban, plus you-target friend changes. Toasts + persistent history.

## Limits (read first)
- `left or was removed` cannot distinguish kick vs voluntary leave without Audit Log perms. Check the server Audit Log for certainty.
- Friend tracking covers only YOU and a tracked user. Discord never sends other people's friend events, so target-stranger tracking is impossible.
- Client mods violate Discord ToS. Test with an alt and a private test server.

## Install (Vencord source build only; official installer cannot load custom plugins)
1. Clone Vencord from source per https://docs.vencord.dev/installing/ and confirm `pnpm build` works once.
2. Copy this folder to `Vencord/src/userplugins/userTracker/` (create `userplugins/` if missing) so `index.ts` and `utils.ts` sit side by side.
3. Rebuild: `pnpm build` (or `pnpm build --watch` for dev), then Ctrl+R in Discord.
4. Enable `Settings → Vencord → Plugins → UserTracker`.

## Use
1. Paste 1+ user IDs into `trackedIds` (right-click a user → Copy User ID; multiple IDs separated by comma/space/newline).
2. Faster: right-click any user → Track user (UserTracker).
3. Trigger a test: change the tracked user's role in a shared server → toast `Tracker • @name in Server: +Role`.
4. History persists via DataStore key `UserTracker_history` across restarts.

## Verify it works
- `node --test tests/userTracker.utils.test.ts` passes in this repo (pure logic).
- Inside Vencord checkout: `pnpm lint` clean for `src/userplugins/userTracker/`, `pnpm build` succeeds, plugin appears in Plugins tab.
- Manual with alt account: role add, role remove, nick change, leave, kick (shows as removed), ban, unban, friend/unfriend you — each produces a toast + history entry.

## Troubleshoot
- Plugin not listed: wrong folder depth (`userplugins/userTracker/index.ts`, not nested deeper), or empty file in `userplugins/` causing `localeCompare` error — remove empties and rebuild.
- No toast on role change: ID typo, event toggles off, or cache cold on first start (change role twice after enabling).
- `DataStore` empty after restart: normal if IndexedDB was cleared; history is best-effort persistent.
```

- [ ] **Step 2: Verify pure tests pass in this repo**

Run: `node --test tests/userTracker.utils.test.ts`
Expected: PASS. If FAIL, fix `utils.ts` only (never weaken the test), rerun until PASS.

- [ ] **Step 3: Verify inside a real Vencord checkout (the only true works-on-Vencord proof)**

Run in your Vencord checkout (not this repo):
```bash
mkdir -p src/userplugins
cp -r /Volumes/Shared/PW/user-tracker/src/userplugins/userTracker src/userplugins/userTracker
pnpm lint -- src/userplugins/userTracker
pnpm build
```
Expected: lint clean (fix any `@utils/types` or `@webpack/common` import error by matching the exact import lines from Task 2 Step 1 — `definePluginSettings` from `@api/Settings`, `showToast, Toasts, GuildStore, GuildMemberStore, UserStore` from `@webpack/common`, `* as DataStore` from `@api/DataStore`), build succeeds, `UserTracker` appears under Settings → Vencord → Plugins after Ctrl+R.

- [ ] **Step 4: Manual Discord check with alt account (do not skip)**

```text
1. In Discord settings, paste alt user ID into trackedIds.
2. In test server: add role to alt → expect toast containing +RoleName.
3. Remove role → expect -RoleName.
4. Change alt nick → expect nickname entry.
5. Alt leaves → expect left or was removed.
6. Re-add alt, then Kick → expect same removed label (ambiguity acknowledged).
7. Ban then unban → expect banned / unbanned.
8. Main friends alt, then unfriends → expect became friends / unfriended entries.
9. Restart Discord (Ctrl+R) → history still present.
```

- [ ] **Step 5: Commit**

```bash
git add src/userplugins/userTracker/README.md src/userplugins/userTracker/index.ts
git commit -m "docs: add UserTracker README and Vencord verification steps"
```

---

## Self-Review

- Spec coverage: roles/nick/join/leave/ban/relationship toasts + history plus watchlist, settings toggles, persistence, context menu, limits, testing — each maps to Task 1 (pure logic), Task 2 (adapter), Task 3 (docs + Vencord proof). No spec section is orphaned.
- Placeholder scan: no TBD/TODO/later/appropriate/generic handling; every step has exact file paths, exact code, exact commands, exact expected output.
- Type consistency: `parseTrackedIds/isTracked/diffRoles/formatRoleChange/formatSimpleEvent/trimHistory/buildEntry/TrackerKind/TrackerEntry` signatures are identical in File Structure, Task 1 tests, Task 1 implementation, and Task 2 imports. Settings keys are identical in Task 2 code and Task 3 consumers. `HISTORY_KEY` is identical in code and README.
