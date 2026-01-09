#!/bin/bash

# A script to automate the release process for an Expo application.
#
# This script performs the following actions:
# 1. Updates the version number in app.json.
# 2. Builds an Android APK using EAS Build locally.
# 3. Renames the generated APK to a standard name (grad.apk).
# 4. Commits the version bump and the new APK.
# 5. Creates a new Git tag for the version.
# 6. Generates release notes from commits since the last tag.
# 7. Creates a new GitHub release with the tag, release notes, and the APK as an asset.
#
# Usage:
#   ./release.sh [OPTIONS] <version>
#
# Options:
#   -b, --build-only    Only build the APK, skip git/GitHub operations
#   -d, --dry-run       Show what would be done without making any changes
#   -h, --help          Show this help message
#
# Examples:
#   ./release.sh 1.2.3           # Full release with version 1.2.3
#   ./release.sh v2.5.1          # Works with or without 'v' prefix
#   ./release.sh -b 1.2.3        # Build only, no git operations
#   ./release.sh --dry-run 1.2.3 # Preview what would happen
#
# Prerequisites:
# - Must be run from the root of your Expo project.
# - The following tools must be installed and in your PATH:
#   - git: For version control.
#   - jq: For parsing and updating JSON (app.json).
#   - eas-cli: The Expo Application Services CLI.
#   - gh: The official GitHub CLI.
# - You must be authenticated with both `eas-cli` and `gh`.

# --- Configuration ---
set -e # Exit immediately if a command exits with a non-zero status.
set -o pipefail # The return value of a pipeline is the status of the last command to exit with a non-zero status.

# --- Defaults ---
BUILD_ONLY=false
DRY_RUN=false
NEW_VERSION=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_DIR=""

# --- Functions ---
show_help() {
    cat << EOF
Usage: ./release.sh [OPTIONS] <version>

A script to automate the release process for an Expo application.

Options:
  -b, --build-only    Only build the APK, skip git/GitHub operations
                      Output APK will be copied to ./grad.apk in current directory
  -d, --dry-run       Show what would be done without making any changes
  -h, --help          Show this help message

Arguments:
  <version>           Version number (e.g., 1.2.3 or v1.2.3)
                      The 'v' prefix is optional and will be normalized

Examples:
  ./release.sh 1.2.3           # Full release with version 1.2.3
  ./release.sh v2.5.1          # Works with or without 'v' prefix
  ./release.sh -b 1.2.3        # Build only, no git operations
  ./release.sh --dry-run 1.2.3 # Preview what would happen

Prerequisites:
  - git, jq, eas-cli, gh must be installed
  - Must be authenticated with eas-cli and gh
EOF
}

# Validate version format (semver-like: X.Y.Z with optional prerelease)
validate_version() {
    local version="$1"
    # Match: X.Y.Z or X.Y.Z-alpha.1 etc.
    if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?$ ]]; then
        echo "❌ Error: Invalid version format '$version'"
        echo "   Expected format: X.Y.Z (e.g., 1.2.3) or X.Y.Z-prerelease (e.g., 1.2.3-beta.1)"
        exit 1
    fi
}

# Normalize version: strip 'v' or 'V' prefix if present
normalize_version() {
    local version="$1"
    # Remove leading 'v' or 'V' if present
    echo "${version#[vV]}"
}

# Cleanup function for trap
cleanup() {
    local exit_code=$?
    if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then
        echo "🧹 Cleaning up temporary directory..."
        rm -rf "$TMP_DIR"
    fi
    exit $exit_code
}

# Check required tools
check_dependencies() {
    local missing_deps=()
    
    for cmd in git jq; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_deps+=("$cmd")
        fi
    done
    
    # Only check eas and gh if not in dry-run mode
    if [ "$DRY_RUN" = false ]; then
        if ! command -v eas &> /dev/null; then
            missing_deps+=("eas-cli")
        fi
        if [ "$BUILD_ONLY" = false ] && ! command -v gh &> /dev/null; then
            missing_deps+=("gh (GitHub CLI)")
        fi
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        echo "❌ Error: Missing required dependencies:"
        for dep in "${missing_deps[@]}"; do
            echo "   - $dep"
        done
        exit 1
    fi
}

# Run a command, or just print it in dry-run mode
run_cmd() {
    if [ "$DRY_RUN" = true ]; then
        echo "   [DRY-RUN] Would run: $*"
    else
        "$@"
    fi
}

# --- Parse Arguments ---
while [[ $# -gt 0 ]]; do
    case $1 in
        -b|--build-only)
            BUILD_ONLY=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        -*)
            echo "❌ Error: Unknown option: $1"
            echo "Use --help for usage information."
            exit 1
            ;;
        *)
            if [ -z "$NEW_VERSION" ]; then
                NEW_VERSION="$1"
            else
                echo "❌ Error: Multiple version arguments provided."
                echo "Use --help for usage information."
                exit 1
            fi
            shift
            ;;
    esac
done

# --- Input Validation ---
if [ -z "$NEW_VERSION" ]; then
    echo "❌ Error: No version number provided."
    echo "Usage: ./release.sh [OPTIONS] <version>"
    echo "Use --help for more information."
    exit 1
fi

# Normalize and validate version
NEW_VERSION=$(normalize_version "$NEW_VERSION")
validate_version "$NEW_VERSION"

# Check dependencies
check_dependencies

# Set up cleanup trap
trap cleanup EXIT INT TERM

# --- Start ---
if [ "$DRY_RUN" = true ]; then
    echo "🔍 DRY-RUN MODE: No changes will be made"
fi

if [ "$BUILD_ONLY" = true ]; then
    echo "🚀 Starting BUILD-ONLY process for version: $NEW_VERSION"
else
    echo "🚀 Starting release process for version: $NEW_VERSION"
fi

echo "➡️  Fetching the latest files..."
TMP_DIR="$SCRIPT_DIR/tmp"
if [ "$DRY_RUN" = true ]; then
    echo "   [DRY-RUN] Would create: $TMP_DIR"
    echo "   [DRY-RUN] Would clone: https://github.com/SuperCoolPencil/GRAD"
else
    mkdir -p "$TMP_DIR"
    cd "$TMP_DIR"
    git clone https://github.com/SuperCoolPencil/GRAD
    cd GRAD
fi

# --- 1. Update app.json ---
echo "➡️  Updating version in app.json to $NEW_VERSION..."
if [ "$DRY_RUN" = true ]; then
    echo "   [DRY-RUN] Would update .expo.version to '$NEW_VERSION' in app.json"
else
    if ! jq --arg v "$NEW_VERSION" '.expo.version = $v' app.json > app.json.tmp; then
        echo "❌ Error: Failed to update app.json with jq."
        rm -f app.json.tmp
        exit 1
    fi
    mv app.json.tmp app.json
fi
echo "✅ Version updated successfully."

# --- 2. Build APK with EAS ---
echo "➡️  Starting EAS build for Android..."
if [ "$DRY_RUN" = true ]; then
    echo "   [DRY-RUN] Would run: eas build --local -p android --profile preview"
else
    eas build --local -p android --profile preview
fi
echo "✅ EAS build complete."

# --- 3. Rename the APK ---
echo "➡️  Renaming APK to grad.apk..."
if [ "$DRY_RUN" = true ]; then
    echo "   [DRY-RUN] Would find and rename build-*.apk to grad.apk"
else
    shopt -s nullglob
    apk_files=(build-*.apk)
    shopt -u nullglob

    if [ ${#apk_files[@]} -eq 0 ]; then
        echo "❌ Error: Could not find the generated APK file (build-*.apk) in the current directory."
        exit 1
    elif [ ${#apk_files[@]} -gt 1 ]; then
        echo "❌ Error: Found multiple APK files matching 'build-*.apk'. Please clean up old build artifacts."
        ls -1 build-*.apk
        exit 1
    fi

    APK_PATH="${apk_files[0]}"
    echo "ℹ️  Found build artifact: $APK_PATH"
    if ! mv "$APK_PATH" grad.apk; then
        echo "❌ Error: Failed to rename the APK."
        exit 1
    fi
fi
echo "✅ APK renamed to grad.apk."

# --- Build-only mode: copy APK and exit ---
if [ "$BUILD_ONLY" = true ]; then
    echo "➡️  Copying APK to output directory..."
    if [ "$DRY_RUN" = true ]; then
        echo "   [DRY-RUN] Would copy grad.apk to $SCRIPT_DIR/grad.apk"
    else
        cp grad.apk "$SCRIPT_DIR/grad.apk"
        echo "✅ APK copied to: $SCRIPT_DIR/grad.apk"
    fi
    echo "🎉 Build-only complete! APK is ready at: $SCRIPT_DIR/grad.apk"
    exit 0
fi

# --- 4. Commit Changes ---
echo "➡️  Committing changes..."
COMMIT_MESSAGE="chore: bumped version number to $NEW_VERSION"
if [ "$DRY_RUN" = true ]; then
    echo "   [DRY-RUN] Would run: git add app.json"
    echo "   [DRY-RUN] Would run: git commit -m '$COMMIT_MESSAGE'"
else
    git add app.json
    git commit -m "$COMMIT_MESSAGE"
fi
echo "✅ Changes committed with message: '$COMMIT_MESSAGE'"

# --- 5. Create Release Notes and Tag ---
echo "➡️  Generating release notes and creating tag..."

if [ "$DRY_RUN" = true ]; then
    echo "   [DRY-RUN] Would find previous tag and generate release notes"
    RELEASE_NOTES="[DRY-RUN] Release notes would be generated here"
else
    PREVIOUS_TAG=$(git describe --tags $(git rev-list --tags --max-count=1) 2>/dev/null || true)

    if [ -z "$PREVIOUS_TAG" ]; then
        echo "⚠️ Warning: No previous tag found. Release notes will include all commits."
        RELEASE_NOTES=$(git log --pretty=format:"* %s (%h)")
    else
        echo "ℹ️  Previous tag found: $PREVIOUS_TAG. Generating notes from commits since then."
        RELEASE_NOTES=$(git log "$PREVIOUS_TAG"..HEAD --pretty=format:"* %s (%h)")
    fi

    if [ -z "$RELEASE_NOTES" ]; then
        RELEASE_NOTES="No new commits since the last release."
    fi
fi

echo "🗒️ Release Notes:"
echo "$RELEASE_NOTES"

# Create the new git tag
TAG_NAME="v$NEW_VERSION"
if [ "$DRY_RUN" = true ]; then
    echo "   [DRY-RUN] Would run: git tag '$TAG_NAME'"
else
    git tag "$TAG_NAME"
fi
echo "✅ Tag $TAG_NAME created."

# --- 6. Push and Create GitHub Release ---
echo "➡️  Pushing commit and tag to remote..."
if [ "$DRY_RUN" = true ]; then
    echo "   [DRY-RUN] Would run: git push"
    echo "   [DRY-RUN] Would run: git push --tags"
else
    git push
    git push --tags
fi
echo "✅ Commit and tag pushed."

echo "➡️  Creating GitHub release..."
if [ "$DRY_RUN" = true ]; then
    echo "   [DRY-RUN] Would run: gh release create '$TAG_NAME' grad.apk --title '$TAG_NAME' --notes '...' --latest"
else
    gh release create "$TAG_NAME" grad.apk --title "$TAG_NAME" --notes "$RELEASE_NOTES" --latest
fi

echo "🎉 All done! Release $TAG_NAME has been successfully created on GitHub."
