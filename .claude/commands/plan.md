---
description: Plan a change before writing any code. Follows explore-plan-code-commit.
allowed-tools: Read, Grep, Glob, Bash(git status), Bash(git log:*)
argument-hint: [what-you-want-to-build]
---

Goal: $ARGUMENTS

Follow this sequence. Do not write any implementation code in this command.

1. Explore: read the files, screens, or tables most relevant to this change. Use the Explore subagent for any search that will produce verbose output. Summarize what you found in 3-5 bullet points.
2. Identify risks: list anything that could go wrong, any patterns you need to match, any Supabase tables or RLS policies that will be touched.
3. Plan: produce a numbered list of concrete steps. Each step says which files will change and what. Think hard about the approach before writing the plan.
4. Stop: output the plan and wait for approval. Do not start coding.
