# UserTracker (Vencord userplugin)

Watch specific users across servers you share: roles, nick, join, leave/remove, ban, plus you-target friend changes. Optional mutual-friend polling detects when a tracked user friends/unfriends YOUR friends. Toasts + persistent history.

## Limits (read first)
- `left or was removed` cannot distinguish kick vs voluntary leave without Audit Log perms. Check the server Audit Log for certainty.
- Instant friend tracking covers only YOU and a tracked user. Discord never sends other people's friend events, so target-stranger tracking is impossible.
- Mutual-friend polling (opt-in, off by default) sees ONLY people who are also your friends — a tracked user friending a stranger is invisible by design. It works by re-reading the profile's `mutual_friends` list on a timer, so alerts lag up to one interval, and timed REST calls carry some rate-limit risk — keep the interval at 60+ minutes.
- Client mods violate Discord ToS. Test with an alt and a private test server.

## Install (Vencord source build only; official installer cannot load custom plugins)
1. Clone Vencord from source per https://docs.vencord.dev/installing/ and confirm `pnpm build` works once.
2. Copy this folder to `Vencord/src/userplugins/userTracker/` (create `userplugins/` if missing) so `index.ts`, `utils.ts`, and `mutuals.ts` sit side by side.
3. Rebuild: `pnpm build` (or `pnpm build --watch` for dev), then Ctrl+R in Discord.
4. Enable `Settings → Vencord → Plugins → UserTracker`.

## Use
1. Paste 1+ user IDs into `trackedIds` (right-click a user → Copy User ID; multiple IDs separated by comma/space/newline). Up to 25 recommended if mutual watching is enabled.
2. Faster: right-click any user → Track user (UserTracker).
3. Trigger a test: change the tracked user's role in a shared server → toast `Tracker • @name in Server: +Role`.
4. History persists safely via DataStore key `UserTracker_history` across restarts (schema-validated on load).

## Mutual-friend watching (opt-in)
Detects when a tracked user friends/unfriends someone on YOUR friend list.
1. First verify the data source (one time): open a tracked user's profile with DevTools → Network open, find the `profile` request, and confirm its `mutual_friends` array lists ALL your mutuals (compare against the count). If it's a truncated preview, leave this feature off — diffing a preview false-alerts.
2. Enable `watchMutualFriends` and pick `mutualCheckMinutes` (60 default, up to 120). The first cycle only takes a silent baseline — no flood of old news. Snapshots persist under DataStore key `UserTracker_mutuals`, so restarts resume diffing instead of re-baselining.
3. **Hardened Safety Protections:**
   - **429 Auto-Cooldown:** On any HTTP 429 response, polling pauses for at least 10 minutes with exponential backoff multipliers.
   - **Target Capping & Jitter:** Automatically caps mutual checks to 25 targets per cycle with randomized 15–30s delays between calls.
   - **Cycle Concurrency Lock:** Prevents overlapping cycles if requests take longer than the check interval.
4. Live test (needs a cooperating friend or second account B that is friends with you): track T, have B friend T → within one cycle expect `Tracker • @T became friends with @B`; have B unfriend T → expect `unfriended`. Toggling the plugin off/on requires re-enabling to pick up setting changes; alerts lag up to one interval by design.

## Verify it works
- `node --test tests/*.test.ts` passes in this repo (35 tests covering pure logic, validation, sanitization, 429 backoff).
- Inside Vencord checkout: `pnpm lint` clean for `src/userplugins/userTracker/`, `pnpm build` succeeds, plugin appears in Plugins tab.
- Manual with alt account: role add, role remove, nick change, leave, kick (shows as removed), ban, unban, friend/unfriend you — each produces a toast + history entry.

## Troubleshoot
- Plugin not listed: wrong folder depth (`userplugins/userTracker/index.ts`, not nested deeper), or empty file in `userplugins/` causing `localeCompare` error — remove empties and rebuild.
- No toast on role change: ID typo, event toggles off, or cache cold on first start (change role twice after enabling).
- `DataStore` empty after restart: normal if IndexedDB was cleared; history is best-effort persistent and schema-validated on load.
- Authors placeholder: replace authors: [{ name: "you", id: 0n }] in index.ts with your own { name, id } (right-click your avatar → Copy User ID, numeric, with n suffix) before building.

