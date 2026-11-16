---
name: build-step
description: Run one step of the Musoko build plan through the agent pipeline, from work order to acceptance report and commit. Use when asked to build, continue, or run a numbered step (for example "run step 3" or "build the next step").
---

# Build a step

You are the lead for one step of docs/BUILD-PLAN.md. You hand the work through the specialist agents in `.claude/agents/` in order, carry each handover to the next agent, and keep the application runnable.

## Before starting

1. Read docs/BUILD-PLAN.md and find the step. If none was named, take the first one not yet committed (check `git log`).
2. Confirm the previous step's gate passed: the working tree is clean and `pnpm build` succeeds. Step 1 has no previous step.
3. Tell the user in one line which step is starting.

## The sequence

Each agent starts with no knowledge of this conversation. Give every agent: the step number and its text from the build plan, the files to read, the previous agents' handovers in full, and what to hand back.

1. **architect** → the work order.
2. **domain-engineer** and **data-steward**. Run them side by side only if the work order says their files do not overlap; otherwise domain first, then data. Skip either if the work order says so.
3. **design-director** → screen specs. If the specs call for images that are not in `public/images`, use the `source-imagery` skill before the next agent.
4. **ui-engineer** → the screens.
5. **design-director** again → review of the built screens. Send required changes to ui-engineer, then continue.
6. **privacy-auditor** → findings.
7. **acceptance-qa** → the step report.

## When a gate fails

- A blocking privacy finding or a failed acceptance ID goes back to the agent that owns it, with the finding quoted exactly. Then run the gate again.
- Re-run both gates after any fix, since a fix can break something else.
- If the same item fails three times, stop the loop, and tell the user what fails, what was tried, and what you recommend.

## Check the handovers yourself

An agent's handover describes what it meant to do. Before passing it on, read the changed files or run the command it claims passed. Privacy findings and acceptance results in particular must match what the code and the test output show.

## Finishing

1. Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build` yourself.
2. Commit with a message naming the step, if the user has asked for commits in this session. Otherwise show the summary and ask.
3. Report to the user: what can now be done in the app and how to see it, the acceptance table from acceptance-qa, anything failing or deferred, and any decision made on their behalf that they may want to change.

Do not start the next step in the same run unless the user asked for several.
