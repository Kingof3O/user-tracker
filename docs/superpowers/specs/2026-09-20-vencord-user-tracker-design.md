# Vencord User Tracker — Design Spec
Date: 2026-09-20
Status: Approved in chat (4/4 sections)
Approach: A — mutual-server event tracker

## 1. Purpose & Scope
Build a Vencord `userplugin` that watches a user-defined watchlist (multiple user IDs) across all mutual guilds and notifies when:
- roles added/removed (with role names)
- nickname changed
- joined / left-removed / banned / unbanned per guild
- relationship with YOU changed (friend add/remove, block, incoming/outgoing request)

Explicit non-goal (honest limit):
- Full stranger friend-list tracking (`target <-> stranger`) is NOT possible. Discord gateway only sends `RELATIONSHIP_ADD/REMOVE` for your own account. There is no client API for another user's friend list. This spec does not attempt profile scraping, token abuse, or polling that violates privacy/rate limits.

Success criteria:
- Add 1+ user IDs to watchlist, get toast + history entry on role/join/leave/ban/nick/you<->target events in mutual servers.
- No webpack patches, no Discord restart required for start/stop.
- History persists across restarts.

## 2. Architecture
- Location: `src/userplugins/userTracker/index.ts` (folder with `index.ts` to allow future `styles.css` / `components/`).
- Type: runtime-only Vencord plugin via `definePlugin({ name: "UserTracker", description, authors, settings, start(), stop() })`.
- No `patches[]` — pure `FluxDispatcher.subscribe` + stores + `Toasts`.
- Dependencies (Vencord aliases):
  - `@utils/types` (definePlugin)
  - `@api/Settings` (definePluginSettings, OptionType)
  - `@api/Toasts` (showToast)
  - `@api/DataStore` (persist history + watchlist backup)
  - `@webpack/common` (`FluxDispatcher`, `GuildStore`, `UserStore`, `RelationshipStore` if available, `RestAPI` only if needed for name resolution)
  - `@vencord/discord-types` for event typing
- Requires Vencord source build (`src/userplugins/`). Official installer build cannot load custom plugins.

File layout in this repo (mirrors Vencord checkout):
- `docs/superpowers/specs/2026-09-20-vencord-user-tracker-design.md` (this file)
- future: `userTracker/index.ts`, `userTracker/README.md`

## 3. Components
### 3.1 Settings (`definePluginSettings`)
- `trackedIds: STRING` — comma/space/newline-separated user IDs. Validated as `/\d{17,20}/g`. UI helper to add/remove.
- Toggles (BOOLEAN, default true):
  - `trackRoles`, `trackNick`, `trackJoin`, `trackLeave`, `trackBan`, `trackRelationship` (you<->target only)
  - `showToast` (default true), `persistHistory` (default true)
- `toastDuration: SELECT` (3s/5s/8s) or NUMBER seconds.
- `historyLimit: NUMBER` (default 200, max 1000).

### 3.2 Watcher (Flux subscriptions)
Subscribe on `start()`, unsubscribe on `stop()`:
- `GUILD_MEMBER_UPDATE` → `{ guildId, user, roles, nick }`. Diff `roles` vs cached `memberRoles[guildId+userId]`. Lookup role names via `GuildStore.getRole(guildId, roleId)`.
- `GUILD_MEMBER_ADD` → join.
- `GUILD_MEMBER_REMOVE` → label `left or was removed (kick/leave)` — cannot distinguish without Audit Log. Do NOT claim “kicked”.
- `GUILD_BAN_ADD` / `GUILD_BAN_REMOVE` → ban/unban.
- `RELATIONSHIP_ADD` / `RELATIONSHIP_REMOVE` / `FRIEND_REQUEST_*` if exposed → only fires for own account; filter `event.userId in watchlist`.
- Optional: `USER_UPDATE` for avatar/username change (low priority, behind toggle if added).

Cache:
- `memberRoles: Map<string, Set<string>>` key `${guildId}:${userId}`.
- Warmup on start: for each mutual guild (`GuildStore.getGuilds()`), for each tracked ID, read `MemberStore.getMember(guildId, userId)?.roles` if cached. Do not bulk-fetch (rate-limit safe). Cache fills lazily on first UPDATE.

### 3.3 Resolver / Enricher
- Guild name: `GuildStore.getGuild(guildId)?.name ?? guildId`.
- User display: `UserStore.getUser(userId)?.username ?? userId` + discriminator/globalName.
- Role names: map IDs → names, fallback to ID if role deleted/uncached.
- Timestamp: `Date.now()`.

### 3.4 Notifier + History Store
- Toast: `Toasts.show({ message, id, type, options: { duration } })`. Message e.g. `Tracker • @bob in MyServer: +Role Admin, -Role Mod`.
- History entry: `{ id, ts, userId, userTag, guildId, guildName, kind: 'roles'|'nick'|'join'|'leave'|'ban'|'unban'|'relationship', detail }`.
- Persist via `DataStore.get/set("UserTracker_history", entries)` trimmed to `historyLimit`. Load on start.
- Settings panel custom component: list with Clear + Export (copy JSON to clipboard).

### 3.5 Context Menu (nice-to-have, in scope)
- Runtime-only `addContextMenuPatch("user-context", ...)` — no webpack `patches[]`, no restart required. Adds `Track/Untrack user` toggling `trackedIds`. If API unavailable in pinned Vencord version, skip this sub-feature (settings manual entry remains).

## 4. Data Flow
1. Discord gateway → `FluxDispatcher.dispatch(event)`.
2. Watcher callback checks `isTracked(event.userId)` → ignore if not.
3. Enricher resolves guild/user/role names.
4. Differ (for UPDATE) computes `addedRoles`, `removedRoles`, `nickChanged`. If no diff → ignore.
5. Notifier shows toast (if enabled) + appends history + persists (debounced).
6. Settings UI reads history store for display.

Sequence example (role):
`GUILD_MEMBER_UPDATE {guildId=G, user.id=U, roles=[1,2,3]}` → cache had `[1,2]` → added `[3:Admin]` → toast + log.

## 5. Error Handling & Limits
- Kick vs leave: always label `left/removed`. Tooltip: “Check server Audit Log for kick vs voluntary leave”. No audit-log fetch (requires mod perms + REST, out of scope for v1).
- Uncached members/roles: show IDs with note, update when cache warms.
- Invalid IDs in settings: ignored with console warning, no crash.
- Flux unsubscribe on `stop()` to avoid leaks/double toasts.
- No polling loops → no rate-limit risk.
- History trim to prevent storage bloat.
- ToS / safety: client mods violate Discord ToS. Risk is low for read-only listeners but non-zero. Recommend testing with alt account, never distribute token-dependent code, never attempt to fetch another user's private relationships.

## 6. Testing Plan
Manual (with 2 test accounts sharing a test server):
1. Add alt ID to watchlist → change role → expect toast `+Role X`.
2. Remove role → expect `-Role X`.
3. Change nick → expect nick entry.
4. Alt leaves → expect `left/removed`.
5. Kick alt → expect same `left/removed` (acknowledge ambiguity).
6. Ban/unban alt → expect ban entries.
7. Friend alt from main → expect relationship entry; unfriend → expect entry.
8. Restart Discord → history persists, no duplicate subscriptions.
9. `pnpm lint` + `pnpm test` (plugin-related) clean in Vencord checkout.
10. Empty/invalid IDs → no crash.

Out of scope for v1:
- Audit-log-accurate kick detection, helper bot (Approach C).
- Mutual-friend polling inference (Approach B — fragile, rejected).
- DM-to-self forwarding, sound alerts, per-user per-guild filters.

## 7. Alternatives Considered
- B (mutual-friend polling): rejected — incomplete, rate-limited, fragile, privacy-sensitive.
- C (helper bot): deferred — accurate kick vs leave but requires bot token + admin invite; can be v2.
- A chosen: feasible with public client events, minimal risk, meets “multiple users, all servers, toasts+log” requirements.

## 8. Open Questions (resolved)
- Friend tracking = full list? → Impossible; scoped to you<->target, user accepted.
- Scope = multiple users, all servers? → Yes.
- Notifications = toasts + log panel? → Yes.
