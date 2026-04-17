---
description: Pre-flight checks then kick off an EAS production build.
allowed-tools: Read, Bash(git status), Bash(git log:*), Bash(npx expo-doctor), Bash(cat:*)
argument-hint: [optional-release-notes]
---

## Pre-flight
Working tree:
!`git status`

Last commit:
!`git log -1 --oneline`

Expo doctor:
!`npx expo-doctor`

Current app.json version and build number:
!`cat app.json | grep -E '"version"|"buildNumber"'`

## Your task
1. Check the pre-flight output above.
2. If the working tree is not clean, stop and tell me what's uncommitted.
3. If expo-doctor reported red flags, stop and list them.
4. Otherwise, ask me whether to bump version, ios.buildNumber, or both. Wait for my answer.
5. After I confirm, edit app.json to bump, then run: npx eas-cli build --platform ios --profile production
6. Do NOT run eas submit.

Release notes for this build: $ARGUMENTS
