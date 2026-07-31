#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_FILE="$ROOT_DIR/tree.txt"

# Ensure we're operating from the project root (where the script lives)
cd "$ROOT_DIR"

# Generate the tree, excluding all node_modules directories
tree -a -I 'node_modules' > "$OUTPUT_FILE"

echo "Project tree written to: $OUTPUT_FILE"
