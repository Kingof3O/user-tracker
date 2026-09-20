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
- Authors placeholder: replace authors: [{ name: "you", id: 0n }] in index.ts with your own { name, id } (right-click your avatar → Copy User ID, numeric, with n suffix) before building.
