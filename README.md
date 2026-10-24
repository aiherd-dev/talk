# Talk to my Claude

Instructions for Claude Code, Codex and other coding assistants to invite trusted guests to ask questions in your existing
conversation at talk.aiherd.dev. The broker runtime is `aih talk` in the standard
[AIHerd distribution](https://github.com/aiherd-dev/aiherd); this repository owns
the skill and its setup references. No second copy belongs in AIHerd.

The skill checks `aih status --json` first and reuses your connected AIHerd.
There is one standard `aih` installation; a remote-only package is not required.

This is a preview release. It requires an AIHerd build with `aih talk` and
`aih status` support; standard packaged versions may predate these commands.
The site and skill are
available for testing, while real-Claude and native macOS acceptance remain pending.

Install into the current project:

```sh
npx skills add aiherd-dev/talk --skill talk-to-my-claude --agent claude-code --copy
```

For Codex, replace `--agent claude-code` with `--agent codex`, then invoke
`$talk-to-my-claude <public topic>` in your existing Codex conversation. The
historical skill name is kept for compatibility; replies come from the agent
whose conversation you invoked it in. Codex instructions and invocation policy
ship with the same skill directory.

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

## Specify how to deliver the invitation

The skill argument includes both the topic and how to send the link:

```text
/talk-to-my-claude Explain the design we discussed; email the invitation link to alex@example.com.
$talk-to-my-claude Explain the design we discussed; send the invitation link to Slack channel #design-review.
```

Delivery uses tools available in your current assistant. Include the channel and
recipient or destination; if omitted, the link is shown in your conversation.
Delivery details stay out of the public room description. If the channel is
unavailable, the assistant reports that and shows the link for manual sharing.
The same instructions work in the ordinary-language requests below, for example
by appending “and email the invitation link to alex@example.com.”

## Generic AGENTS.md instructions: omp and OpenCode

Clone the instructions and their helper into your project without replacing
its existing AGENTS.md:

```sh
git clone --depth 1 https://github.com/aiherd-dev/talk.git .aiherd-talk
```

In your **existing omp conversation**, send:

```text
Read .aiherd-talk/AGENTS.md and use it to invite guests to ask about the design we just discussed.
```

In your **existing OpenCode conversation**, send the same ordinary-language
request. Neither example launches a second model or requires a slash command.
Keep the checkout: its relative references and Python reply helper are required.
To make this discoverable in future sessions, optionally append this stanza to
your project's existing AGENTS.md:

```markdown
When I ask to share this conversation via talk.aiherd.dev, read
.aiherd-talk/AGENTS.md and follow its instructions. Loading this rule alone
does not start sharing.
```

Both [omp](https://github.com/can1357/oh-my-pi/blob/main/docs/context-files.md)
and [OpenCode](https://opencode.ai/docs/rules/) support project AGENTS.md
instructions. The generic entry point reuses the same skill, setup reference
and reply helper as Claude Code and Codex. It requires Unix, Python 3, an AIHerd
build with `aih talk`, and a host that can retain and await a blocking command
while allowing owner interruption. Real omp/OpenCode runtime acceptance is
pending; if a host cannot do this, the instructions stop the room and explain.

## Acceptance before release

Use a disposable project and an isolated, explicitly marked scratch herd with
its own config, socket, credentials and secret-free attribution manifest, as
required by AIHerd's AGENTS.md. Never use the owner's running herd for tests.
Record the exact host and model version. The Codex run below has passed;
Claude Code remains untested in this environment.

1. Tell the agent a random fact in the original conversation, invoke the skill,
   and ask about it through the browser. Verify the answer uses that fact,
   while earlier transcript, files and tool output never appear automatically.
2. Keep the same `next` command pending beyond both 45 and 90 seconds, then
   send a question. Verify no idle model turns or replacement waits occur.
   Repeat after several minutes, including the shell runtime's background
   task completion path. Interrupt as the owner and confirm the wait exits.
3. Ask sequential questions; follow-up answers use prior talk turns. Verify
   owner-only instructions stay local. Stop sharing and return to ordinary work.
4. Test standard-package setup on macOS and Linux with an existing connected
   herd, a disconnected herd, and none. The skill first reads `aih status --json`
   and reuses a connected herd without installation, startup or login. Only a
   confirmed stopped herd needs `aih serve` without `aih-tty`. Test probe errors,
   pending/failed login and reconnection. Existing herds and sidecars stay running.
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

## Real Codex acceptance — 2026-10-24

Passed on Linux with Codex CLI 0.164.0 and GPT-6.1-Sol in a new interactive tmux
session, with the skill installed using `--agent codex --copy`. The session used
its normal ChatGPT sign-in; apps/plugins were disabled for this fixture. The
herd and relay were isolated, explicitly marked scratch, with no borrowed herd
configuration or credentials.

A fact supplied in an owner turn before skill invocation informed the answer
to a real browser question, and a follow-up used the same conversation. One
receive command remained alive for over 219 seconds before the first question.
The agent refused a guest request to edit a canary file, the owner-only note was
absent from the guest transcript, and browser reload preserved the six intended
messages. Owner interruption cancelled the pending receive, revoked the room,
and returned to ordinary conversation while retaining the original fact.

Codex awaits its retained command through managed execution cells. Those cells
can yield and require another tool-level wait; this check establishes live
availability/context continuity, not a zero-usage indefinite background service.
It also does not prove model-level prompt-injection resistance or native macOS/
Windows behavior. The original Codex conversation can stay open after the
scratch herd and relay are stopped.
