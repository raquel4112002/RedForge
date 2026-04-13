import type { Command } from "commander";
import { redforgeInitCommand } from "../../commands/redforge.init.js";
import { redforgeMissionCreateCommand } from "../../commands/redforge.mission-create.js";
import { redforgeMissionPlanCommand } from "../../commands/redforge.mission-plan.js";
import { redforgeMissionRunCommand } from "../../commands/redforge.mission-run.js";
import { redforgeScopeCreateCommand } from "../../commands/redforge.scope-create.js";
import { redforgeTargetAddCommand } from "../../commands/redforge.target-add.js";
import { defaultRuntime } from "../../runtime.js";
import { runCommandWithRuntime } from "../cli-utils.js";

export function registerRedForgeCommand(program: Command) {
  const redforge = program
    .command("redforge")
    .description("Initialize and manage RedForge workspace structure");

  redforge
    .command("init")
    .description("Initialize a RedForge workspace structure")
    .option("--workspace <dir>", "Workspace directory (default: ~/.openclaw/workspace)")
    .option("--force", "Overwrite RedForge seed files if they already exist", false)
    .option("--quiet", "Reduce output", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await redforgeInitCommand(
          {
            workspace: opts.workspace as string | undefined,
            force: Boolean(opts.force),
            quiet: Boolean(opts.quiet),
          },
          defaultRuntime,
        );
      });
    });

  redforge
    .command("target-add")
    .description("Create a target definition in TARGETS/")
    .requiredOption("--name <name>", "Target display name")
    .requiredOption("--type <type>", "Target type (for example: domain, ip, url)")
    .requiredOption("--value <value>", "Primary target value")
    .option("--workspace <dir>", "Workspace directory (default: ~/.openclaw/workspace)")
    .option("--id <id>", "Explicit target id (default: slug from name)")
    .option("--notes <text>", "Optional notes")
    .option("--force", "Overwrite target file if it already exists", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await redforgeTargetAddCommand(
          {
            workspace: opts.workspace as string | undefined,
            id: opts.id as string | undefined,
            name: opts.name as string,
            type: opts.type as string,
            value: opts.value as string,
            notes: opts.notes as string | undefined,
            force: Boolean(opts.force),
          },
          defaultRuntime,
        );
      });
    });

  redforge
    .command("scope-create")
    .description("Create a scope definition in SCOPES/")
    .requiredOption("--description <text>", "Scope description")
    .option("--workspace <dir>", "Workspace directory (default: ~/.openclaw/workspace)")
    .option("--id <id>", "Explicit scope id (default: slug from description)")
    .option("--allowed-target <id>", "Allowed target id", collectRepeatable, [])
    .option("--allowed-tool <tool>", "Allowed tool name", collectRepeatable, [])
    .option("--forbidden-action <action>", "Forbidden action", collectRepeatable, [])
    .option("--autonomy <mode>", "Autonomy level (default: bounded)")
    .option("--force", "Overwrite scope file if it already exists", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await redforgeScopeCreateCommand(
          {
            workspace: opts.workspace as string | undefined,
            id: opts.id as string | undefined,
            description: opts.description as string,
            allowedTarget: opts.allowedTarget as string[] | string | undefined,
            allowedTool: opts.allowedTool as string[] | string | undefined,
            forbiddenAction: opts.forbiddenAction as string[] | string | undefined,
            autonomy: opts.autonomy as string | undefined,
            force: Boolean(opts.force),
          },
          defaultRuntime,
        );
      });
    });

  redforge
    .command("mission-create")
    .description("Create a mission definition in MISSIONS/")
    .requiredOption("--objective <text>", "Mission objective")
    .requiredOption("--target <id>", "Target id")
    .requiredOption("--scope <id>", "Scope id")
    .option("--workspace <dir>", "Workspace directory (default: ~/.openclaw/workspace)")
    .option("--id <id>", "Explicit mission id (default: slug from objective)")
    .option("--mode <mode>", "Mission mode (default: bounded-recon)")
    .option("--output <name>", "Expected mission output", collectRepeatable, [])
    .option("--force", "Overwrite mission file if it already exists", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await redforgeMissionCreateCommand(
          {
            workspace: opts.workspace as string | undefined,
            id: opts.id as string | undefined,
            objective: opts.objective as string,
            target: opts.target as string,
            scope: opts.scope as string,
            mode: opts.mode as string | undefined,
            output: opts.output as string[] | string | undefined,
            force: Boolean(opts.force),
          },
          defaultRuntime,
        );
      });
    });

  redforge
    .command("mission-plan")
    .description("Plan a mission from a natural-language prompt")
    .requiredOption("--prompt <text>", "Mission planning prompt")
    .option("--workspace <dir>", "Workspace directory (default: ~/.openclaw/workspace)")
    .option("--apply", "Create target, scope, and mission from the generated plan", false)
    .option("--run", "Run the generated mission after applying it", false)
    .option("--json", "Output the generated plan as JSON", false)
    .option("--agent <id>", "Agent id to use when running the planned mission")
    .option("--model <ref>", "Execution model override for --run")
    .option("--base-url <url>", "Execution base URL override for --run")
    .option("--dry-run", "Pass dry-run through to mission-run when used with --run", false)
    .option("--force", "Overwrite planned target/scope/mission files if they already exist", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await redforgeMissionPlanCommand(
          {
            prompt: opts.prompt as string,
            workspace: opts.workspace as string | undefined,
            apply: Boolean(opts.apply),
            run: Boolean(opts.run),
            json: Boolean(opts.json),
            agent: opts.agent as string | undefined,
            model: opts.model as string | undefined,
            baseUrl: opts.baseUrl as string | undefined,
            dryRun: Boolean(opts.dryRun),
            force: Boolean(opts.force),
          },
          defaultRuntime,
        );
      });
    });

  redforge
    .command("mission-run")
    .description("Initialize and execute a concrete run from a mission definition")
    .requiredOption("--mission <id>", "Mission id")
    .option("--workspace <dir>", "Workspace directory (default: ~/.openclaw/workspace)")
    .option("--agent <id>", "Agent id for this run (default: configured default agent)")
    .option("--model <ref>", "Execution model override")
    .option("--base-url <url>", "Execution base URL override")
    .option("--dry-run", "Initialize the run without real execution", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await redforgeMissionRunCommand(
          {
            workspace: opts.workspace as string | undefined,
            mission: opts.mission as string,
            agent: opts.agent as string | undefined,
            model: opts.model as string | undefined,
            baseUrl: opts.baseUrl as string | undefined,
            dryRun: Boolean(opts.dryRun),
          },
          defaultRuntime,
        );
      });
    });
}

function collectRepeatable(value: string, previous: string[]): string[] {
  return [...previous, value];
}
