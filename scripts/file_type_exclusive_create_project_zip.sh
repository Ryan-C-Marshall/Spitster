#!/usr/bin/env bash
#
# create_project_zip_filtered.sh
#
# Zips git-tracked files with selected extensions only and places the
# resulting archive next to the project root (i.e. one directory above
# the repo root). Any previously generated archives (matching the
# naming pattern below) are removed first.
#
# Default included extensions:
#   .ts
#   .tsx
#   .html
#   .css
#   .md
#
# Usage:
#   ./create_project_zip_filtered.sh [project-name]
#
# If [project-name] is omitted, the repo's directory name is used.

set -euo pipefail

# --- Locate the git repo root ---------------------------------------------
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "Error: not inside a git repository." >&2
  exit 1
}

cd "$REPO_ROOT"

pwd

# --- Naming ---------------------------------------------------------------
PROJECT_NAME="${1:-$(basename "$REPO_ROOT")}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUTPUT_DIR="$(dirname "$REPO_ROOT")"
ZIP_PATTERN="${PROJECT_NAME}_*.zip"
ZIP_NAME="${PROJECT_NAME}_${TIMESTAMP}_fileexclusive.zip"
ZIP_PATH="${OUTPUT_DIR}/${ZIP_NAME}"

# --- Included extensions --------------------------------------------------
INCLUDED_EXTENSIONS="ts tsx html css md"

# --- Clean up any previously generated zip files ---------------------------
echo "Cleaning up previous archives matching '${ZIP_PATTERN}' in ${OUTPUT_DIR}..."
find "$OUTPUT_DIR" -maxdepth 1 -type f -name "$ZIP_PATTERN" -print -delete

# --- Collect matching files and skipped extensions -------------------------
FILES_TO_ZIP=""
SKIPPED_EXTENSIONS=""

echo "Scanning git-tracked files..."

while IFS= read -r FILE; do
  BASENAME="$(basename "$FILE")"

  # Extract extension
  case "$BASENAME" in
    *.*)
      EXTENSION="${BASENAME##*.}"
      ;;
    *)
      EXTENSION="[no extension]"
      ;;
  esac

  INCLUDE=false

  for ALLOWED in $INCLUDED_EXTENSIONS; do
    if [ "$EXTENSION" = "$ALLOWED" ]; then
      INCLUDE=true
      break
    fi
  done

  if [ "$INCLUDE" = true ]; then
    FILES_TO_ZIP="${FILES_TO_ZIP}${FILE}
"
  else
    FOUND=false

    for SKIPPED in $SKIPPED_EXTENSIONS; do
      if [ "$SKIPPED" = "$EXTENSION" ]; then
        FOUND=true
        break
      fi
    done

    if [ "$FOUND" = false ]; then
      SKIPPED_EXTENSIONS="${SKIPPED_EXTENSIONS} ${EXTENSION}"
    fi
  fi
done <<EOF
$(git ls-files)
EOF

# --- Report skipped file types --------------------------------------------
echo ""
echo "Skipped file types:"
if [ -z "$SKIPPED_EXTENSIONS" ]; then
  echo "  None"
else
  for EXT in $SKIPPED_EXTENSIONS; do
    echo "  $EXT"
  done
fi

# --- Create archive -------------------------------------------------------
echo ""
echo "Creating archive: ${ZIP_PATH}"

if [ -z "$FILES_TO_ZIP" ]; then
  echo "Error: no matching files found." >&2
  exit 1
fi

printf "%s" "$FILES_TO_ZIP" | zip -q "$ZIP_PATH" -@

echo "Done. Archive created at: ${ZIP_PATH}"