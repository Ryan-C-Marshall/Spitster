#!/usr/bin/env bash
#
# create_project_zip.sh
#
# Zips all git-tracked files in the current repository and places the
# resulting archive next to the project root (i.e. one directory above
# the repo root). Any previously generated archives (matching the
# naming pattern below) are removed first.
#
# Usage:
#   ./create_project_zip.sh [project-name]
#
# If [project-name] is omitted, the repo's directory name is used.

set -euo pipefail

# --- Locate the git repo root ---------------------------------------------
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "Error: not inside a git repository." >&2
  exit 1
}

cd "$REPO_ROOT"

# --- Naming ------------------------------------------------------------
PROJECT_NAME="${1:-$(basename "$REPO_ROOT")}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUTPUT_DIR="$(dirname "$REPO_ROOT")"
ZIP_PATTERN="${PROJECT_NAME}_*.zip"
ZIP_NAME="${PROJECT_NAME}_${TIMESTAMP}.zip"
ZIP_PATH="${OUTPUT_DIR}/${ZIP_NAME}"

# --- Clean up any previously generated zip files ---------------------------
echo "Cleaning up previous archives matching '${ZIP_PATTERN}' in ${OUTPUT_DIR}..."
find "$OUTPUT_DIR" -maxdepth 1 -type f -name "$ZIP_PATTERN" -print -delete

# --- Build the archive from git-tracked files only --------------------------
echo "Creating archive: ${ZIP_PATH}"
git ls-files -z | xargs -0 zip -q "$ZIP_PATH"

echo "Done. Archive created at: ${ZIP_PATH}"
