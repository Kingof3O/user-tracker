# UserTracker — Vencord User-Monitoring Plugin

A runtime-only [Vencord](https://vencord.dev) userplugin that watches the
people you choose across every server you share with them — and tells you
the moment something changes.

**Get notified when a tracked user:** gains or loses a role · changes
nickname · joins, leaves, or is removed · gets banned or unbanned ·
friends or unfriends **you**.

> **Honest limits, up front:** Discord never tells your client when someone
> is *kicked* (vs. leaving on their own) — those events show as
> “left or was removed”. And nobody's client receives *other people's*
> friend events, so friend tracking covers only **you ↔ tracked user**,
> never target ↔ stranger. Anything claiming otherwise is lying to you.

---

## ✨ Features

- 📋 **Watchlist** — track one user or many, by ID, across all mutual servers
- 🎭 **Role diffing** — `+Admin, -Mod` with real role names, not bare IDs
- 👋 **Join / leave / ban / unban** detection per server
- 💬 **Nickname** change alerts
- 🤝 **You ↔ target** friend/unfriend, block, and request alerts
- 🔔 **Toast popups** + persistent, searchable history (survives restarts)
- 🖱️ **Right-click any user → Track/Untrack** from the context menu
- 🧩 **Zero webpack patches** — pure event listeners, no restart needed

## 📁 What's in this repo

```
src/userplugins/userTracker/
├── index.ts     # Vencord adapter: settings, flux events, toasts, history
├── utils.ts     # Pure logic (no Discord imports — unit tested)
└── README.md    # Plugin install + usage + troubleshooting
tests/
└── userTracker.utils.test.ts   # 12 tests, Node built-in runner, zero deps
docs/
├── superpowers/specs/  # Design spec
└── superpowers/plans/  # Implementation plan
```

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
node --test tests/userTracker.utils.test.ts   # 12 pass, 0 fail
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
- **No polling, no tokens, no scraping** — the plugin only listens to
  events Discord already sends your client. It can't see anything you
  couldn't see by staring at the member list.
- **Design docs** live in `docs/` (spec + plan), including the approaches
  that were considered and rejected.

## 📄 License

GPL-3.0-only, matching Vencord itself.
