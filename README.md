# Talk to my Claude

Claude Code skill for inviting trusted guests to ask questions in your existing
conversation at talk.aiherd.dev. The broker runtime is `aih talk` in the standard
[AIHerd distribution](https://github.com/aiherd-dev/aiherd); this repository owns
the skill and its setup references. No second copy belongs in AIHerd.

This is a preview release. It requires an AIHerd build with `aih talk` support;
standard packaged versions may predate that command. The site and skill are
available for testing, while real-Claude and native macOS acceptance remain pending.

Install into the current project:

```sh
npx skills add aiherd-dev/talk --skill talk-to-my-claude --agent claude-code --copy
```

Append `--global` for all projects. Installation copies the entire skill directory,
including references and the reply helper, without starting a room, daemon,
login or model conversation. Invoke `/talk-to-my-claude <public topic>` in your
existing Claude Code session. V1 runtime requires Unix and Python 3. Windows
skill installation is supported by the Skills CLI; Windows broker use is pending.

For development, install from this local repository path instead of the GitHub
shorthand. For example, from an isolated project directory:

```sh
npx skills add /absolute/path/to/talk --skill talk-to-my-claude --agent claude-code --copy
```

## Acceptance before release

Use a disposable project and an isolated, explicitly marked scratch herd with
its own config, socket, credentials and secret-free attribution manifest, as
required by AIHerd's AGENTS.md. Never use the owner's running herd for tests.
Record the exact Claude Code version; no version has passed the real-session
gate in this implementation environment, where Claude Code is unavailable.

1. Tell Claude a random fact in the original conversation, invoke the skill,
   and ask about it through the browser. Verify the answer uses that fact,
   while earlier transcript, files and tool output never appear automatically.
2. Keep the same `next` command pending beyond both 45 and 90 seconds, then
   send a question. Verify no idle model turns or replacement waits occur.
   Repeat after several minutes, including the shell runtime's background
   task completion path. Interrupt as the owner and confirm the wait exits.
3. Ask sequential questions; follow-up answers use prior talk turns. Verify
   owner-only instructions stay local. Stop sharing and return to ordinary work.
4. Test clean standard-package setup on macOS and Linux with both an existing
   gateway and none. With none, the skill starts `aih serve` without `aih-tty`,
   completes actual browser login and verifies relay connection. Test pending
   and failed login. Existing gateway and sidecars remain running.
5. Test project and global Skills CLI installation on Windows, Linux and macOS,
   checking supporting resources and explicit invocation. On Windows, runtime
   setup must explain the unsupported broker rather than creating a false link.

The deterministic protocol and browser acceptance live in AIHerd's
`tests/talk_e2e.py` and `talk-web/src/*.test.*`; they do not prove Claude context
continuity or prompt-injection resistance. The skill is guidance, not a sandbox
around Claude's existing context or tools.

References: [Claude skills](https://code.claude.com/docs/en/skills) and
[Skills CLI](https://github.com/vercel-labs/skills/blob/main/docs/commands.md).

Local Linux validation: the Skills CLI installed both project and global copies
under an isolated HOME, including references and the helper, with no symlinks.
The helper passed a literal shell-metacharacter/Unicode payload through a fake
`aih` subprocess in a 0600 file and removed that file afterward. These checks
do not replace native macOS/Windows installation or real-Claude acceptance.

Reproduce the isolated Linux skill/helper checks with `python3 tests/check.py`
(Node.js/npm must supply `npx`).

The preview site is deployed at [talk.aiherd.dev](https://talk.aiherd.dev).
The static deployment lives on `gh-pages`; keep skill sources on `main`.
To verify the documented public GitHub installation rather than a local copy,
run `AIH_TALK_SKILL_SOURCE=aiherd-dev/talk python3 tests/check.py`.
