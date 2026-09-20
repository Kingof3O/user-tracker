# UserTracker — Vencord User-Monitoring Plugin

A runtime-only [Vencord](https://vencord.dev) userplugin that watches the
people you choose across every server you share with them — and tells you
the moment something changes.

**Get notified when a tracked user:** gains or loses a role · changes
nickname · joins, leaves, or is removed · gets banned or unbanned ·
friends or unfriends **you**.

> **Honest limits, up front:** Discord never tells your client when someone
> is *kicked* (vs. leaving on their own) — those events show as
> “left or was removed”. Instant friend alerts cover **you ↔ tracked user**
> only; the opt-in mutual-friend poller additionally sees tracked-user
> changes among **your own friends** (hourly-ish, not instant), while a
> tracked user friending a stranger stays invisible to everyone but them.

---

## ✨ Features

- 📋 **Watchlist** — track one user or many, by ID, across all mutual servers
- 🎭 **Role diffing** — `+Admin, -Mod` with real role names, not bare IDs
- 👋 **Join / leave / ban / unban** detection per server
- 💬 **Nickname** change alerts
- 🤝 **You ↔ target** friend/unfriend, block, and request alerts
- 👥 **Mutual-friend watching (opt-in)** — detects when a tracked user friends/unfriends *your* friends, via timed profile snapshots
- 🔔 **Toast popups** + persistent, searchable history (survives restarts)
- 🖱️ **Right-click any user → Track/Untrack** from the context menu
- 🧩 **Zero webpack patches** — pure event listeners, no restart needed

## 📁 What's in this repo

```
src/userplugins/userTracker/
├── index.ts     # Vencord adapter: settings, flux events, toasts, history
├── utils.ts     # Pure logic: validation, sanitization, diffing (unit tested)
├── mutuals.ts   # Mutual friend logic: rate-limiting, 429 backoff, capping (unit tested)
└── README.md    # Plugin install + usage + troubleshooting
tests/
├── userTracker.utils.test.ts    # 20 tests (validation, sanitization, diffing)
└── userTracker.mutuals.test.ts  # 15 tests (rate-limits, 429 backoff, snapshot safety)
docs/
├── superpowers/specs/  # Design spec
└── superpowers/plans/  # Implementation plan
```

## 🛡️ Hardening & Reliability

This plugin is hardened for production reliability, account safety, and client stability:

- **Discord API & Account Safety:**
  - **HTTP 429 Shield:** Automatically detects rate-limit (429) responses. On 429, all mutual polling is immediately paused for a minimum 10-minute cooldown with exponential backoff multipliers.
  - **Concurrency Locking:** Mutual polling cycles cannot overlap or stack if requests take longer than the polling interval.
  - **Target Capping & Jitter:** Mutual polling is capped to 25 users per cycle with 15–30s randomized delays between requests to prevent burst patterns.
- **Crash & Runtime Resilience:**
  - **Flux Dispatcher Isolation:** All Flux event handlers are wrapped in try/catch boundaries so an unexpected Discord payload never crashes Discord's core event dispatcher.
  - **Defensive Store Lookups:** Safe fallbacks for Discord internal stores (`GuildStore`, `GuildMemberStore`, `UserStore`).
- **Data Integrity & Sanitization:**
  - **Strict Snowflake Validation:** Enforces `/^\d{17,20}$/` for user and guild IDs.
  - **DataStore Type Guards:** Validates `UserTracker_history` and `UserTracker_mutuals` schemas on startup to safely discard corrupted or tampered records from IndexedDB.
  - **String Sanitization:** Strips control characters, zero-width characters, and bidirectional override characters (`\u202E`) from tags, guild names, and roles before rendering in toasts or history.
  - **Cache Pruning:** Automatically purges untracked users from all internal caches (`roleCache`, `nickCache`, `mutualCache`, failure counters) to prevent memory leaks.

## 🚀 Install (2 minutes)

Requires a **Vencord source build** — the stock installer can't load custom
plugins. One-time setup: https://docs.vencord.dev/installing/

```bash
# 1. Copy the plugin into your Vencord checkout
cp -r src/userplugins/userTracker /path/to/Vencord/src/userplugins/userTracker

# 2. Open index.ts and put your own info in `authors`
#    authors: [{ name: "YourName", id: 123456789012345678n }]

# 3. Rebuild and reload Discord
pnpm build        # or: pnpm build --watch  (dev loop)
# then Ctrl+R in Discord

# 4. Enable it: Settings → Vencord → Plugins → UserTracker
```

## 🧭 Use

1. **Add someone to watch** — right-click them → *Track user (UserTracker)*,
   or paste their ID (right-click → Copy User ID) into the `trackedIds`
   setting. Multiple IDs, any separator.
2. **Tune events** — toggle roles / nick / join / leave / ban /
   relationship tracking individually.
3. **Watch it work** — change a tracked user's role in a shared server:
   `Tracker • @bob in MyServer: +Admin, -Mod` 🍞
4. **History** persists across restarts via Vencord's DataStore.

## ✅ Verify it works

```bash
node --test tests/*.test.ts   # 35 pass, 0 fail
```

Then in Discord with an **alt account on a private test server**
(never your main — client mods violate Discord's ToS):
role add → role remove → nick change → leave → kick (shows as
*removed*) → ban → unban → friend/unfriend you. Each should toast.

Full checklist + troubleshooting:
[`src/userplugins/userTracker/README.md`](src/userplugins/userTracker/README.md).

## ⚠️ Good to know

- **Discord ToS:** all client mods violate it. Enforcement against
  read-only plugins is unheard of, but test with an alt if your account
  matters to you.
- **No polling, no tokens, no scraping** — the core plugin only listens to
  events Discord already sends your client. It can't see anything you
  couldn't see by staring at the member list.
- **Design docs** live in `docs/` (spec + plan), including the approaches
  that were considered and rejected.

## 📄 License

GPL-3.0-only, matching Vencord itself.

