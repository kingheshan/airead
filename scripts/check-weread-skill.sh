#!/usr/bin/env bash
set -euo pipefail
SKILL_DIR="${1:-/home/oai/skills/weread-skills}"
if [ -f "$SKILL_DIR/SKILL.md" ]; then
  echo "weread-skills is installed at $SKILL_DIR"
  sed -n '1,80p' "$SKILL_DIR/SKILL.md"
else
  echo "weread-skills not found at $SKILL_DIR" >&2
  exit 1
fi
