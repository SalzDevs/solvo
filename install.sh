#!/usr/bin/env bash
# Solvo installer.
#
# Installs Bun if it isn't already on this machine, downloads Solvo, and
# starts it — no git, no manual dependency install.
#
#   curl -fsSL https://raw.githubusercontent.com/SalzDevs/solvo/main/install.sh | bash
#
# Environment variables:
#   SOLVO_DIR       Where to install Solvo (default: $HOME/solvo)
#   SOLVO_NO_START  Set to 1 to install only, without starting the dev server

set -euo pipefail

REPO="SalzDevs/solvo"
DIR="${SOLVO_DIR:-$HOME/solvo}"
PORT="${SOLVO_PORT:-5173}"

info() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }
die() {
	printf '\033[1;31mError:\033[0m %s\n' "$1" >&2
	exit 1
}

# --- 1. Bun -------------------------------------------------------------
if ! command -v bun >/dev/null 2>&1; then
	info "Bun not found — installing it first..."
	curl -fsSL https://bun.sh/install | bash
	export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
	export PATH="$BUN_INSTALL/bin:$PATH"
fi

command -v bun >/dev/null 2>&1 ||
	die "Bun was installed but isn't on PATH yet. Open a new terminal and re-run this script."

info "Using $(bun --version)"

# --- 2. Get Solvo ---------------------------------------------------------
if [ -d "$DIR" ]; then
	# `bun create` renames package.json's "name" to the destination folder's
	# basename, so checking for "name": "solvo" isn't reliable once someone
	# picks a custom SOLVO_DIR. A file unique to this repo is a sturdier signal.
	if [ -f "$DIR/src/lib/registry.ts" ]; then
		info "Solvo already exists at $DIR — reinstalling dependencies..."
		# `bun create` doesn't set up a git remote, so there's nothing to pull;
		# re-running just makes sure dependencies are up to date.
		(cd "$DIR" && bun install)
	else
		die "$DIR already exists and isn't a Solvo install. Re-run with SOLVO_DIR=/some/other/path."
	fi
else
	info "Downloading Solvo into $DIR..."
	bun create "$REPO" "$DIR"
fi

cd "$DIR"

# --- 3. Run it -------------------------------------------------------------
if [ "${SOLVO_NO_START:-0}" = "1" ]; then
	info "Installed at $DIR. Start it any time with:"
	echo "  cd $DIR && bun run dev"
	exit 0
fi

info "Starting Solvo at http://localhost:$PORT (Ctrl+C to stop)..."
(
	sleep 1.5
	url="http://localhost:$PORT"
	if command -v open >/dev/null 2>&1; then
		open "$url" >/dev/null 2>&1 || true
	elif command -v xdg-open >/dev/null 2>&1; then
		xdg-open "$url" >/dev/null 2>&1 || true
	fi
) &

exec bun --bun vite dev --port "$PORT"
