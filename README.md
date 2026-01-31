# OpenCode Beads Plugin

Integrates [Beads (bd)](https://github.com/steveyegge/beads) issue tracking with
[OpenCode](https://github.com/anomalyco/opencode). This is the OpenCode equivalent
of running `bd setup claude` for Claude Code.

## What It Does

| OpenCode Event              | Action                        | Claude Code Equivalent |
|-----------------------------|-------------------------------|------------------------|
| `session.created`           | Runs `bd prime`               | `SessionStart` hook    |
| `session.compacting`        | Injects `bd prime` into context | `PreCompact` hook    |
| `session.idle`              | Optional `bd sync`            | (no equivalent)        |

### session.created (SessionStart)

When a new OpenCode session starts, the plugin runs `bd prime` to load the full
beads workflow context. This gives the agent awareness of open issues,
dependencies, priorities, and the beads command reference.

### session.compacting (PreCompact)

When OpenCode compacts a long conversation to free up context window space, the
plugin injects the `bd prime` output into the compaction context. This ensures
beads knowledge survives compaction and the agent retains awareness of the issue
tracker state.

### session.idle (optional sync)

When the agent finishes and the session goes idle, the plugin can optionally run
`bd sync` to push beads changes to git. Disabled by default.

## Prerequisites

1. `bd` CLI installed and on your PATH
2. `bd init` already run in the project (`.beads/` directory must exist)

The plugin silently deactivates if no `.beads/` directory is found.

## Installation

The plugin is can be placed at `.opencode/plugins/beads.js`. OpenCode
automatically loads all plugins from `.opencode/plugins/` at startup.

No additional configuration is required.

## Environment Variables

Control the plugin behaviour with environment variables:

| Variable                | Default | Effect                                    |
|-------------------------|---------|-------------------------------------------|
| `BEADS_DISABLE_PRIME`   | unset   | Set to `1` to skip `bd prime` on session start |
| `BEADS_DISABLE_COMPACT` | unset   | Set to `1` to skip injecting context on compaction |
| `BEADS_DISABLE_IDLE`    | unset   | Set to `1` to skip idle event handling    |
| `BEADS_SYNC_ON_IDLE`    | unset   | Set to `1` to auto-run `bd sync` when session idles |

Example:

```bash
# Disable auto-prime, enable auto-sync
BEADS_DISABLE_PRIME=1 BEADS_SYNC_ON_IDLE=1 opencode
```

## Customising the Plugin

The plugin is a standard OpenCode plugin (ES module exporting an async function).
Edit `.opencode/plugins/beads.js` to change behaviour.

### Common modifications

**Add more events:**
OpenCode exposes many events you can hook into. Add handlers inside the
`event` callback:

```js
event: async ({ event }) => {
  if (event.type === "session.created") {
    // ... existing prime logic
  }

  // Example: log every file edit
  if (event.type === "file.edited") {
    console.log("File edited:", event);
  }
}
```

Available events: `session.created`, `session.idle`, `session.updated`,
`session.error`, `session.compacted`, `session.deleted`, `file.edited`,
`tool.execute.before`, `tool.execute.after`, `message.updated`, and more.
See https://opencode.ai/docs/plugins for the full list.

**Change the compaction context:**
Edit the `experimental.session.compacting` handler to inject different or
additional context:

```js
"experimental.session.compacting": async (_input, output) => {
  const prime = await runBd("prime");
  const ready = await runBd("ready --json");
  if (prime) {
    output.context.push(`## Beads Context\n\n${prime}`);
  }
  if (ready) {
    output.context.push(`## Ready Issues\n\n${ready}`);
  }
}
```

**Replace the compaction prompt entirely:**
Set `output.prompt` to override the default compaction prompt:

```js
"experimental.session.compacting": async (_input, output) => {
  output.prompt = `You are resuming a session that uses beads (bd) for tracking.
Run bd prime to reload context, then bd ready to find work.`;
}
```

**Run bd commands before/after tool execution:**

```js
"tool.execute.before": async (input, output) => {
  // Example: auto-sync before any bash command
  if (input.tool === "bash") {
    await runBd("sync");
  }
}
```

**Send system notifications:**

```js
if (event.type === "session.idle") {
  await $`osascript -e 'display notification "Session done - run bd sync" with title "OpenCode"'`;
}
```

## Using with bd setup (custom recipe)

You can register this as a custom `bd setup` recipe so other projects can
install it with one command:

```bash
bd setup --add opencode .opencode/plugins/beads.js
```

Then in any project:

```bash
bd setup opencode
```

You can also add this to recipes.toml in .beads directly:

```toml
[recipes]
  [recipes.opencode]
    name = "opencode"
    path = ".opencode/plugins/beads.js"
    type = "file"
    description = ""
    global_path = ""
    project_path = ""

```

## Troubleshooting

**Plugin not loading:**
- Check that `.opencode/plugins/beads.js` exists
- Ensure `.beads/` directory exists in the project root (`bd init` if not)
- Run `opencode` with verbose logging to see plugin load messages

**bd prime returning empty:**
- Run `bd prime` manually in your terminal to verify output
- Check `bd doctor` for any beads installation issues

**Compaction not preserving context:**
- The `experimental.session.compacting` hook is an experimental API
- Check OpenCode release notes if behaviour changes after an update

CopyAI (cAI) Igor Ryabchuk & Foundry of Zero.AI
