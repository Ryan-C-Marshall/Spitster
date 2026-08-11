#!/usr/bin/env bash

set -euo pipefail

###############################################################################
# Configuration
###############################################################################

PROJECT_ROOT_NAME="Spitster"
CHANGES_DIR_NAME="SpitsterChanges"

###############################################################################
# Locate project root
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

CURRENT="$SCRIPT_DIR"
PROJECT_ROOT=""

while [ "$CURRENT" != "/" ]; do
    if [ "$(basename "$CURRENT")" = "$PROJECT_ROOT_NAME" ]; then
        PROJECT_ROOT="$CURRENT"
        break
    fi
    CURRENT="$(dirname "$CURRENT")"
done

if [ -z "$PROJECT_ROOT" ]; then
    echo "Error: Could not locate project root '$PROJECT_ROOT_NAME'."
    exit 1
fi

PARENT_DIR="$(dirname "$PROJECT_ROOT")"
CHANGES_DIR="$PARENT_DIR/$CHANGES_DIR_NAME"
CHANGES_ZIP="$PARENT_DIR/$CHANGES_DIR_NAME.zip"

if [ ! -d "$CHANGES_DIR" ] && [ -f "$CHANGES_ZIP" ]; then
    echo "Changes directory not found, but zip archive exists:"
    echo "  $CHANGES_ZIP"
    echo "Unzipping..."
    unzip -q "$CHANGES_ZIP" -d "$PARENT_DIR"
    rm -f "$CHANGES_ZIP"
    echo "Removed archive."
    echo
fi

if [ ! -d "$CHANGES_DIR" ]; then
    echo "Error: Changes directory not found:"
    echo "  $CHANGES_DIR"
    exit 1
fi

echo "Project root : $PROJECT_ROOT"
echo "Changes dir  : $CHANGES_DIR"
echo

###############################################################################
# Copy files
###############################################################################

count=0

while IFS= read -r source_file; do

    relative_path="${source_file#$CHANGES_DIR/}"
    destination="$PROJECT_ROOT/$relative_path"

    mkdir -p "$(dirname "$destination")"

    if [ -f "$destination" ]; then
        action="Replaced"
    else
        action="Added"
    fi

    cp "$source_file" "$destination"

    count=$((count + 1))

    printf "%-8s %s\n" "$action" "$relative_path"

done < <(find "$CHANGES_DIR" -type f)

echo
echo "Copied $count file(s)."

###############################################################################
# Delete changes directory
###############################################################################

if [ -d "$CHANGES_DIR" ]; then
    echo
    echo "Removing changes directory..."
    rm -rf "$CHANGES_DIR"
fi

echo
echo "Finished."

echo
echo "Done."
