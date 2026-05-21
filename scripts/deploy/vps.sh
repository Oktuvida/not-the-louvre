#!/usr/bin/env sh
set -eu

resolve_bun() {
	if command -v bun >/dev/null 2>&1; then
		command -v bun
		return 0
	fi

	if [ -n "${BUN_INSTALL:-}" ] && [ -x "${BUN_INSTALL}/bin/bun" ]; then
		printf '%s\n' "${BUN_INSTALL}/bin/bun"
		return 0
	fi

	if [ -n "${HOME:-}" ] && [ -x "${HOME}/.bun/bin/bun" ]; then
		printf '%s\n' "${HOME}/.bun/bin/bun"
		return 0
	fi

	if [ -n "${SUDO_USER:-}" ]; then
		SUDO_HOME=$(getent passwd "$SUDO_USER" | cut -d: -f6)
		if [ -n "$SUDO_HOME" ] && [ -x "$SUDO_HOME/.bun/bin/bun" ]; then
			printf '%s\n' "$SUDO_HOME/.bun/bin/bun"
			return 0
		fi
	fi

	printf '%s\n' 'Unable to resolve bun. Install bun on PATH, set BUN_INSTALL, or run with a user that has ~/.bun/bin/bun.' >&2
	exit 1
}

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
BUN_BIN=$(resolve_bun)

cd "$REPO_ROOT/apps/web"
exec "$BUN_BIN" run ./scripts/deploy/vps-admin.ts "$@"