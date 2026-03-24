# AGENTS.md

## Commit Convention

This repository uses Angular-style Conventional Commits with a required emoji prefix.

### Format

```text
<emoji> <type>(scope): <description>
<emoji> <type>: <description>
<emoji> <type>(scope)!: <description>
```

### Rules

- Match the emoji with the commit type.
- Keep the type lowercase.
- Use `scope` when it adds clarity.
- Keep the description short, imperative, and without a trailing period.
- Use `!` for breaking changes and explain the impact in the body or footer.

### Types

| Emoji | Type | Use |
| --- | --- | --- |
| ✨ | `feat` | New feature |
| 🐛 | `fix` | Bug fix |
| 📝 | `docs` | Documentation changes |
| 💄 | `style` | Formatting or visual-only changes |
| ♻️ | `refactor` | Internal refactor with no behavior change |
| ⚡ | `perf` | Performance improvement |
| ✅ | `test` | Tests added or updated |
| 🏗️ | `build` | Build system or dependency changes |
| 👷 | `ci` | CI/CD changes |
| 🧹 | `chore` | Maintenance tasks |
| ⏪ | `revert` | Revert a previous commit |

### Examples

```text
✨ feat(gallery): add artwork forking flow
🐛 fix(canvas): prevent brush offset on mobile
📝 docs(readme): update setup instructions
♻️ refactor(auth): simplify session validation
✅ test(voting): cover downvote edge cases
👷 ci: run checks on pull requests
⏪ revert: revert "✨ feat(gallery): add artwork forking flow"
```

### Notes

- Use `feat`, not `feature`.
- Keep each commit focused on one logical change.

## Local Setup

After cloning, run once to activate the commit-msg hook:

```sh
git config core.hooksPath .githooks
```
