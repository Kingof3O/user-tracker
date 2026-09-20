# Contributing to UserTracker

Thank you for your interest in contributing to **UserTracker**! We welcome bug reports, feature requests, documentation improvements, and code contributions.

---

## 🛠 Development Workflow

UserTracker is developed as a pure-logic TypeScript plugin for [Vencord](https://vencord.dev).

### 1. Prerequisites
- **Node.js**: v20 or later
- **pnpm**: v9 or later
- **Git**: Installed and configured

### 2. Setting Up Local Environment
```bash
# Clone the repository
git clone https://github.com/Kingof3O/user-tracker.git
cd user-tracker

# Run the test suite
node --test tests/*.test.ts
```

### 3. Coding Guidelines
- **Test-Driven Development (TDD):** When introducing new features or fixing bugs, write a failing unit test first, verify the failure, and then write the minimal code to pass.
- **Pure Logic in `utils.ts` and `mutuals.ts`:** Keep Discord-independent helper logic strictly decoupled from Vencord/Discord Webpack imports so they can be unit-tested directly via Node.js.
- **Safety First:**
  - Any external Discord REST API call must be guarded by rate-limit detection (`isRateLimited`) and backoff cooldowns.
  - All Flux event listeners must maintain isolated error boundaries (`try...catch`).
  - Strings rendered in toasts or history must be passed through `sanitizeText()`.

---

## 🧪 Testing Your Changes

Before submitting a Pull Request, verify that all tests pass:
```bash
node --test tests/userTracker.utils.test.ts tests/userTracker.mutuals.test.ts
```

---

## 📦 Pull Request Process

1. Fork the repository and create a descriptive branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Commit your changes with clear, semantic commit messages:
   ```bash
   git commit -m "Add feature: ..."
   ```
3. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
4. Open a Pull Request against the `main` branch with a clear summary of your changes and test verification results.

---

## 📄 License

By contributing to UserTracker, you agree that your contributions will be licensed under the [GNU General Public License v3.0 (GPL-3.0)](LICENSE).
