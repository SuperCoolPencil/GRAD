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
# 7. Creates a new GitHub release with the tag and release notes.
#
# Usage:
# ./release.sh <new_version>
#
# Example:
# ./release.sh 1.2.3
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

# --- Input Validation ---
NEW_VERSION=$1

if [ -z "$NEW_VERSION" ]; then
  echo "❌ Error: No version number provided."
  echo "Usage: ./release.sh <new_version>"
  exit 1
fi

echo "🚀 Starting release process for version: $NEW_VERSION"

# --- 1. Update app.json ---
echo "➡️  Updating version in app.json to $NEW_VERSION..."
if ! jq --arg v "$NEW_VERSION" '.expo.version = $v' app.json > app.json.tmp; then
    echo "❌ Error: Failed to update app.json with jq."
    rm -f app.json.tmp
    exit 1
fi
mv app.json.tmp app.json
echo "✅ Version updated successfully."

# --- 2. Build APK with EAS ---
echo "➡️  Starting EAS build for Android..."
# The build command will exit with a non-zero status on failure because of `set -e`.
eas build --local -p android --profile preview
echo "✅ EAS build complete."

# --- 3. Rename the APK ---
echo "➡️  Renaming APK to grad.apk..."
# Using a glob to find the APK file. This avoids parsing CLI output.
# It's safer as it doesn't depend on the exact wording of the build tool's success message.
shopt -s nullglob # If no files match, the glob expands to nothing.
apk_files=(build-*.apk)
shopt -u nullglob # Turn off nullglob

if [ ${#apk_files[@]} -eq 0 ]; then
    echo "❌ Error: Could not find the generated APK file (build-*.apk) in the current directory."
    exit 1
elif [ ${#apk_files[@]} -gt 1 ]; then
    echo "❌ Error: Found multiple APK files matching 'build-*.apk'. Please clean up old build artifacts."
    ls -1 build-*.apk
    exit 1
fi

# We have confirmed there is exactly one matching APK.
APK_PATH="${apk_files[0]}"
echo "ℹ️  Found build artifact: $APK_PATH"
if ! mv "$APK_PATH" grad.apk; then
    echo "❌ Error: Failed to rename the APK."
    exit 1
fi
echo "✅ APK renamed to grad.apk."

# --- 4. Commit Changes ---
echo "➡️  Committing changes..."
git add app.json grad.apk
COMMIT_MESSAGE="chore: bumped version number to $NEW_VERSION and updated build"
git commit -m "$COMMIT_MESSAGE"
echo "✅ Changes committed with message: '$COMMIT_MESSAGE'"

# --- 5. Create Release Notes and Tag ---
echo "➡️  Generating release notes and creating tag..."

# Find the most recent tag to get the range of commits for the release notes.
PREVIOUS_TAG=$(git describe --tags `git rev-list --tags --max-count=1` 2>/dev/null || true)

if [ -z "$PREVIOUS_TAG" ]; then
    echo "⚠️ Warning: No previous tag found. Release notes will include all commits."
    # Get all commits if no previous tag exists
    RELEASE_NOTES=$(git log --pretty=format:"* %s (%h)")
else
    echo "ℹ️  Previous tag found: $PREVIOUS_TAG. Generating notes from commits since then."
    RELEASE_NOTES=$(git log $PREVIOUS_TAG..HEAD --pretty=format:"* %s (%h)")
fi

if [ -z "$RELEASE_NOTES" ]; then
    RELEASE_NOTES="No new commits since the last release."
fi

echo "🗒️ Release Notes:"
echo "$RELEASE_NOTES"

# Create the new git tag
git tag "v$NEW_VERSION"
echo "✅ Tag v$NEW_VERSION created."

# --- 6. Push and Create GitHub Release ---
echo "➡️  Pushing commit and tag to remote..."
git push
git push --tags
echo "✅ Commit and tag pushed."

echo "➡️  Creating GitHub release..."
# Use the generated release notes to create the release on GitHub.
gh release create "v$NEW_VERSION" --title "Release v$NEW_VERSION" --notes "$RELEASE_NOTES"

echo "🎉 All done! Release v$NEW_VERSION has been successfully created on GitHub."
