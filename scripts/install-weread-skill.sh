#!/usr/bin/env bash
set -euo pipefail

URL="${WEREAD_SKILL_URL:-https://cdn.weread.qq.com/skills/weread-skills.zip}"
SKILLS_DIR="${SKILLS_DIR:-/home/oai/skills}"
TARGET_DIR="${TARGET_DIR:-$SKILLS_DIR/weread-skills}"
TMP_ZIP="${TMPDIR:-/tmp}/weread-skills.zip"

echo "Downloading weread-skills from: $URL"
mkdir -p "$TARGET_DIR"

if command -v curl >/dev/null 2>&1; then
  curl -L "$URL" -o "$TMP_ZIP"
elif command -v wget >/dev/null 2>&1; then
  wget -O "$TMP_ZIP" "$URL"
else
  echo "curl/wget not found" >&2
  exit 1
fi

unzip -o "$TMP_ZIP" -d "$TARGET_DIR"

if [ -f "$TARGET_DIR/SKILL.md" ]; then
  echo "Installed: $TARGET_DIR/SKILL.md"
else
  nested_skill=$(find "$TARGET_DIR" -maxdepth 3 -name SKILL.md | head -n 1 || true)
  if [ -n "$nested_skill" ]; then
    nested_dir=$(dirname "$nested_skill")
    if [ "$nested_dir" != "$TARGET_DIR" ]; then
      cp -a "$nested_dir"/. "$TARGET_DIR"/
    fi
    echo "Installed: $TARGET_DIR/SKILL.md"
  else
    echo "Warning: SKILL.md not found after unzip. Please inspect $TARGET_DIR" >&2
  fi
fi

rm -f "$TMP_ZIP"
