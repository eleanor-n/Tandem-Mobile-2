---
description: Review the current working-tree changes.
allowed-tools: Read, Grep, Glob, Bash(git diff:*), Bash(git status)
argument-hint: [optional-scope]
---

## Changed files
!`git diff --name-only HEAD`

## Detailed changes
!`git diff HEAD`

## Your task
Review the changes above for:
1. Code quality and readability
2. Tandem conventions (theme tokens, state-based navigation, safe area, membership hook)
3. Security issues (exposed keys, missing input validation)
4. Test coverage gaps

Scope hint: $ARGUMENTS

Provide feedback organized by priority (Critical / Warnings / Suggestions).
