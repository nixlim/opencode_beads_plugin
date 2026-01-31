// Beads (bd) integration plugin for OpenCode
// Equivalent to `bd setup claude` hooks: SessionStart + PreCompact
//
// What this does:
//   1. On session.created  - runs `bd prime` to load beads workflow context
//   2. On session.compacting - injects `bd prime` output into compaction context
//   3. On session.idle - reminds about `bd sync` (optional notification)
//
// Requirements:
//   - `bd` CLI installed and on PATH
//   - `bd init` already run in the project (`.beads/` directory exists)
//
// Configuration:
//   Set environment variables to customise behaviour:
//     BEADS_DISABLE_PRIME=1      - Skip auto-prime on session start
//     BEADS_DISABLE_COMPACT=1    - Skip injecting context on compaction
//     BEADS_DISABLE_IDLE=1       - Skip idle notification
//     BEADS_SYNC_ON_IDLE=1       - Auto-run `bd sync` when session goes idle

import { existsSync } from "fs";
import { join } from "path";

export const BeadsPlugin = async ({ $, directory }) => {
  // Only activate if this project uses beads
  const beadsDir = join(directory, ".beads");
  if (!existsSync(beadsDir)) {
    return {};
  }

  /**
   * Run a bd command and return stdout, or null on failure.
   */
  async function runBd(args) {
    try {
      const result = await $`bd ${args}`.text();
      return result.trim();
    } catch (e) {
      return null;
    }
  }

  return {
    event: async ({ event }) => {
      // --- Session Start: load beads context ---
      if (event.type === "session.created") {
        if (process.env.BEADS_DISABLE_PRIME === "1") return;
        await runBd("prime");
      }

      // --- Session Idle: optional sync reminder / auto-sync ---
      if (event.type === "session.idle") {
        if (process.env.BEADS_DISABLE_IDLE === "1") return;

        if (process.env.BEADS_SYNC_ON_IDLE === "1") {
          await runBd("sync");
        }
      }
    },

    // --- Compaction: inject beads context so it survives ---
    "experimental.session.compacting": async (_input, output) => {
      if (process.env.BEADS_DISABLE_COMPACT === "1") return;

      const prime = await runBd("prime");
      if (prime) {
        output.context.push(`## Beads Issue Tracker Context\n\n${prime}`);
      }
    },
  };
};
