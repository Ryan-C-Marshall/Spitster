#!/usr/bin/env bash

set -euo pipefail

# Ensure we're at the root of a Git repository.
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
    echo "Error: not inside a Git repository."
    exit 1
}

cd "$PROJECT_ROOT"

PROJECT_NAME=$(basename "$PROJECT_ROOT")
PARENT_DIR="$(dirname "$PROJECT_ROOT")"
OUTPUT_PREFIX="${PROJECT_NAME}_selected_"

# Remove any previous output directories created by this script.
find "$PARENT_DIR" -maxdepth 1 -type d -name "${OUTPUT_PREFIX}*" -exec rm -rf {} +

OUTPUT_DIR="$PARENT_DIR/${OUTPUT_PREFIX}$(date +%Y%m%d_%H%M%S)"
mkdir -p "$OUTPUT_DIR"

# Detect the appropriate stat command.
if stat -f "%m" . >/dev/null 2>&1; then
    stat_mtime() {
        stat -f "%m" "$1"
    }
else
    stat_mtime() {
        stat -c "%Y" "$1"
    }
fi

echo "Collecting tracked files..."

FILES=()

while IFS= read -r file; do
    FILES+=("$file")
done < <(
    while IFS= read -r file; do
        printf "%s\t%s\n" "$(stat_mtime "$file")" "$file"
    done < <(git ls-files) |
        sort -rn |
        cut -f2-
)

TOTAL=${#FILES[@]}
COPIED=0

echo
echo "Output directory:"
echo "  $OUTPUT_DIR"
echo

for ((i=0; i<TOTAL; i++)); do
    file="${FILES[$i]}"
    filename="$(basename "$file")"

    while true; do
        read -rp "[$((i+1))/$TOTAL] Include ${file}? [y/N/d] " ans

        case "${ans:-n}" in
            y|Y)
                if [[ -e "$OUTPUT_DIR/$filename" ]]; then
                    echo "WARNING: '$filename' already exists in the output directory."
                    echo "         Overwriting with '$file'."
                fi

                cp "$file" "$OUTPUT_DIR/$filename"
                ((COPIED++))
                break
                ;;
            n|N|"")
                break
                ;;
            d|D)
                echo
                echo "Done."
                echo "Copied $COPIED file(s) to:"
                echo "  $OUTPUT_DIR"
                exit 0
                ;;
            *)
                echo "Please enter y, n, d, or press Enter for No."
                ;;
        esac
    done
done

echo
echo "Finished."
echo "Copied $COPIED file(s) to:"
echo "  $OUTPUT_DIR"
