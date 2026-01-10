# Agent Skills

Agent Skills are modular packages that provide specialized knowledge, workflows,
and tools to the agent.

## Structure

A skill is a directory containing a `SKILL.md` file and optional resource
directories.

```
my-skill/
├── SKILL.md (required)
│   ├── YAML frontmatter (name, description)
│   └── Markdown instructions
├── scripts/    - Executable code
├── references/ - Documentation to be loaded as needed
└── assets/     - Templates, boilerplate, etc.
```

## SKILL.md

### Frontmatter

```yaml
---
name: my-skill
description:
  'Briefly explain WHAT the skill does and WHEN to use it. This is the primary
  triggering mechanism.'
---
```

### Body

Contains detailed instructions for the agent on how to use the skill and its
resources.

## Locations

- **Project Skills**: `.gemini/skills/` (**Preferred for development and
  iteration**).
- **User Skills**: `~/.gemini/skills/` (manually added for global use).
- **Built-in Skills**: `packages/core/src/skills/builtin/` (pre-installed).
- **Extension Skills**: `skills/` directory within an extension folder.

## Activation

After creating or modifying a skill, you must tell Gemini CLI to rediscover it:

- **Command**: `/skills reload`

This refreshes the list of available skills across all locations (Project, User,
and Extensions) without needing to restart the CLI.

## Best Practices

- **Concise**: Only include context the agent doesn't already have.
- **Progressive Disclosure**: Use the `references/` directory for detailed
  documentation and link to it from `SKILL.md`.
- **Scripts**: Use scripts for deterministic tasks or to avoid repetitive code
  generation.
- **Imperative Tone**: Use commands (e.g., "Analyze the logs", "Generate a
  test").

## Verification

To validate that a skill is correctly discovered and can be activated:

1.  **Targeted Activation**: Headlessly trigger the skill using:
    `gemini --debug --allowed-tools activate_skill,<minimal_tools> "your targeted prompt"`
2.  **Verification Choice**: **Ask the user first** if they want to verify
    **manually** (interactive session) or have **you** (the agent) verify it on
    their behalf. Mention that agent-led verification involves the agent
    invoking itself headlessly and will require extra confirmations.
3.  **Security WARNING**: If the user chooses agent-led verification, **you must
    explicitly WARN them** that you will be invoking Gemini CLI on their behalf
    and will need to allow-list the tools required for verification. This means
    those tools will run without further confirmation for that specific command.
4.  **Confirmation & Invocation**: Once the user provides verbal confirmation,
    inform them you are using the `--allowed-tools` flag and then execute the
    targeted headless command.
5.  **Troubleshooting**: Inspect the `--debug` logs to verify skill discovery
    and activation.
6.  **UI List**: **The user** can use `/skills list` in an interactive session.

**Note**: You must include any _modifying_ tools the skill intends to use in the
`--allowed-tools` list. Read-only tools like `read_file` are permitted by
default headlessly.

## Documentation

For more information, visit the
[official skills documentation](https://geminicli.com/docs/cli/skills).
