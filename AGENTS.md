# LobeHub Development Guidelines

This document serves as a comprehensive guide for all team members when developing LobeHub.

## Project Description

You are developing an open-source, modern-design AI Agent Workspace: LobeHub (previously LobeChat).

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **UI Components**: Ant Design, @lobehub/ui, antd-style
- **State Management**: Zustand, SWR
- **Database**: PostgreSQL, PGLite, Drizzle ORM
- **Testing**: Vitest, Testing Library
- **Package Manager**: pnpm (monorepo structure)

## Directory Structure

```plaintext
lobehub/
├── apps/desktop/           # Electron desktop app
├── packages/               # Shared packages (@lobechat/*)
│   ├── database/           # Database schemas, models, repositories
│   ├── agent-runtime/      # Agent runtime
│   └── ...
├── src/
│   ├── app/                # Next.js app router
│   ├── spa/                # SPA entry points (entry.*.tsx) and router config
│   ├── routes/             # SPA page components (roots)
│   ├── features/           # Business components by domain
│   ├── store/              # Zustand stores
│   ├── services/           # Client services
│   ├── server/             # Server services and routers
│   └── ...
├── .agents/skills/         # AI development skills
└── e2e/                    # E2E tests (Cucumber + Playwright)
```

## Development Workflow

### Git Workflow

- **Branch strategy**: `canary` is the development branch (cloud production); `main` is the release branch (periodically cherry-picks from canary)
- New branches should be created from `canary`; PRs should target `canary`
- Use rebase for git pull
- Git commit messages should prefix with gitmoji
- Git branch name format: `feat/feature-name`
- Use `.github/PULL_REQUEST_TEMPLATE.md` for PR descriptions
- **Protection of local changes**: Never use `git restore`, `git checkout --`, `git reset --hard`, or any other command or workflow that can forcibly overwrite, discard, or silently replace user-owned uncommitted changes. Before any revert or restoration affecting existing files, inspect the working tree carefully and obtain explicit user confirmation.

### Package Management

- Use `pnpm` as the primary package manager
- Use `bun` to run npm scripts
- Use `bunx` to run executable npm packages

### Code Style Guidelines

#### TypeScript

- Prefer interfaces over types for object shapes

### Testing Strategy

```bash
# Web tests
bunx vitest run --silent='passed-only' '[file-path-pattern]'

# Package tests (e.g., database)
cd packages/[package-name] && bunx vitest run --silent='passed-only' '[file-path-pattern]'
```

**Important Notes**:

- Wrap file paths in single quotes to avoid shell expansion
- Never run `bun run test` - this runs all tests and takes \~10 minutes

### Type Checking

- Use `bun run type-check` to check for type errors

### i18n

- **Keys**: Add to `src/locales/default/namespace.ts`
- **Dev**: Translate `locales/zh-CN/namespace.json` locale file only for preview
- DON'T run `pnpm i18n`, let CI auto handle it

## SPA Routes and Features

- **`src/routes/`** holds only page segments (`_layout/index.tsx`, `index.tsx`, `[id]/index.tsx`). Keep route files **thin** — import from `@/features/*` and compose, no business logic.
- **`src/features/`** holds business components by **domain** (e.g. `Pages`, `PageEditor`, `Home`). Layout pieces, hooks, and domain UI go here.
- **Desktop router parity:** When changing the main SPA route tree, update **both** `src/spa/router/desktopRouter.config.tsx` (dynamic imports) and `src/spa/router/desktopRouter.config.desktop.tsx` (sync imports) so paths and nesting match. Changing only one can leave routes unregistered and cause **blank screens**.
- See the **spa-routes** skill (`.agents/skills/spa-routes/SKILL.md`) for the full convention and file-division rules.

## Skills (Auto-loaded)

All AI development skills are available in `.agents/skills/` directory and auto-loaded by Claude Code when relevant.

**IMPORTANT**: When reviewing PRs or code diffs, ALWAYS read `.agents/skills/code-review/SKILL.md` first.

---

## 🤖 全局要求（所有 AI Agent 必读）

> ⚠️ **所有操作此项目的 Agent（包括 OpenCode、OhMyOpenCode、Claude Code 等）必须遵守以下规则。**
> 工作流中通过 OpenCode/OMO 调用大模型时，必须先读取本文件的完整内容。

### 一、语言规范
- **所有回复使用中文**，除非用户明确要求其他语言。
- 代码注释使用英文，文档和交互信息使用中文。

### 二、代码修改与提交

| 规则 | 说明 |
|------|------|
| **提交前语法校验** | 每次修改代码后必须运行 `bun run type-check` 或 `pnpm lint` 确保无语法错误 |
| **临时文件清理** | 调试产生的临时文件（`*.log`、`*.tmp` 等）测试完成后必须删除 |
| **文档同步更新** | 新增功能或修改结构时，必须同步更新 README 和 AGENTS.md |
| **Git Commit 规范** | 使用 gitmoji 前缀，如 `✨ feat:`、`🐛 fix:`、`📝 docs:` |

### 三、工作流 AI 调用规则

| 规则 | 说明 |
|------|------|
| **优先读取 AGENTS.md** | 工作流通过 OpenCode/OMO 调用 AI 时，必须先读取本项目 AGENTS.md |
| **冲突解决策略** | 上游同步冲突时，保留上游重要更新，同时保留本地定制（如工作流中的 AI 配置） |
| **安全规则** | 参考 `.claude/prompts/security-rules.md`，禁止泄露任何 Token/密钥 |

### 四、测试与部署

| 规则 | 说明 |
|------|------|
| **单元测试** | 推送前确保测试通过：`bunx vitest run --silent='passed-only'` |
| **构建验证** | 修改后必须验证构建成功：`bun run build` |
| **禁止 force push** | 除非用户明确要求，否则禁止使用 `git push --force` |

### 五、关键文件速查

| 文件 | 用途 |
|------|------|
| `AGENTS.md` | AI Agent 全局约束（本文件）|
| `.claude/prompts/security-rules.md` | Claude 安全规则 |
| `.github/workflows/sync-upstream.yml` | 上游同步 + AI 冲突解决 |
| `.github/workflows/claude.yml` | Claude Code 工作流 |
| `custom_scripts/resolve_upstream_conflicts.py` | Python AI 冲突解决脚本 |
| `custom_scripts/pick_best_model.py` | 模型选择脚本 |
| `opencode.json` | OpenCode 配置 |

---

**最后更新**: 2026-04-22
**维护者**: Fatty911 + OpenCode Agent
