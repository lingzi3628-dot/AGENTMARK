# Contributing to AGENTMARK

First off, thank you for your interest in AGENTMARK! 🎉

## 📋 Open Source Model

AGENTMARK is **open source** under the MIT License. This means:

- ✅ **Anyone can view, fork, and use the code** — for free, forever
- ✅ **Anyone can self-host** their own instance
- ✅ **Anyone can modify their fork** for personal use
- ✅ **Anyone can submit issues and feature requests**

However, to maintain quality and direction:

- 🔒 **Only the repository owner ([lingzi3628-dot](https://github.com/lingzi3628-dot)) can push directly to `main`**
- 🔒 **Only invited collaborators can review and merge pull requests**
- 🔒 **The official AGENTMARK roadmap is managed by the owner**

## 🚀 How to Contribute

### Option 1: Report a Bug or Request a Feature

1. Go to [Issues](https://github.com/lingzi3628-dot/AGENTMARK/issues)
2. Click **New Issue**
3. Choose **Bug report** or **Feature request**
4. Fill out the template
5. Submit!

### Option 2: Contribute Code (via Fork + PR)

1. **Fork the repository** — click the "Fork" button at the top right
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/AGENTMARK.git
   cd AGENTMARK
   ```
3. **Create a feature branch**:
   ```bash
   git checkout -b feature/my-awesome-feature
   ```
4. **Make your changes** and commit:
   ```bash
   git commit -m "Add awesome feature"
   ```
5. **Push to your fork**:
   ```bash
   git push origin feature/my-awesome-feature
   ```
6. **Open a Pull Request** — go to your fork on GitHub, click "Compare & pull request"

### What happens after I submit a PR?

1. The owner reviews your code
2. If approved, it gets merged into `main`
3. You get credit as a contributor! 🌟

### PR Guidelines

- ✅ Code must pass `bun run lint` with 0 errors
- ✅ Code must pass `bun run build` without errors
- ✅ Follow the existing code style (TypeScript, Tailwind, shadcn/ui)
- ✅ Add tests for new features (Playwright E2E tests in `tests/`)
- ✅ Update documentation if you add new features
- ✅ Keep PRs focused — one feature per PR

## 🛡️ Branch Protection

The `main` branch is protected with:
- ✅ Requires pull request review before merging
- ✅ Requires status checks to pass (CI: lint + build + tests)
- ✅ Requires branches to be up to date before merging

This ensures the codebase stays stable and high-quality.

## 💬 Community

- 🐛 [Report bugs](https://github.com/lingzi3628-dot/AGENTMARK/issues)
- 💡 [Request features](https://github.com/lingzi3628-dot/AGENTMARK/issues)
- ❓ [Ask questions](https://github.com/lingzi3628-dot/AGENTMARK/issues)

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for helping make AGENTMARK better! 🚀
