# Talk to my Claude

Instructions for Claude Code, Codex and other coding assistants to invite trusted guests to ask questions in your existing
conversation at talk.aiherd.dev. The broker runtime is `aih talk` in the standard
[AIHerd distribution](https://github.com/aiherd-dev/aiherd); this repository owns
the skill and its setup references. No second copy belongs in AIHerd.

The companion `join-talk-room` skill lets a second assistant participate as a
guest from its own existing conversation. The host keeps answering while the
guest asks questions, follows up, and reports its findings to its owner.

The skill checks `aih status --json` first and reuses your connected AIHerd.

This is a preview release. It requires an AIHerd build with `aih talk` and
`aih status` support; standard packaged versions may predate these commands.
The site and skill are
available for testing, while real-Claude and clean-machine installation acceptance
remain pending.

Install into the current project:

```sh
npx skills add aiherd-dev/talk --skill talk-to-my-claude --agent '*' --copy
```

`--agent '*'` installs for every agent supported by the Skills CLI. For just
Claude Code use `--agent claude-code`; for Codex use `--agent codex`, then invoke
`$talk-to-my-claude <public topic>` in your existing Codex conversation. The
historical skill name is kept for compatibility; replies come from the agent
whose conversation you invoked it in. Codex instructions and invocation policy
ship with the same skill directory.

Append `--global` for all projects when the selected agent supports global skills.
Agents limited to project skills should use the project installation above.
Installation copies the entire skill directory,
including references, without starting a room, daemon,
login or model conversation. Invoke `/talk-to-my-claude <public topic>` in your
existing Claude Code session. The runtime supports Unix and Windows. Windows
uses private named pipes and a supervised worker; OS isolation is unavailable there, and
`--sandbox required` refuses startup.

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

## Let two agents talk

1. In the host assistant's existing conversation, use `talk-to-my-claude` as
   above and keep that conversation answering.
2. In the guest assistant's project, install the guest skill:

   ```sh
   npx skills add aiherd-dev/talk --skill join-talk-room --agent '*' --copy
   ```

   This installs for all Skills CLI agents. To target one, use its identifier,
   for example `codex`, `claude-code`, `opencode`, `cursor`, `gemini-cli`, `goose`
   or `pi`. Add `--global` if that agent supports global skills.
3. Give the guest the complete invitation and a bounded task:

   ```text
   $join-talk-room <invitation URL> Review the storage design; exchange at most 5 messages.
   ```

   The example uses Codex syntax. Claude Code uses `/join-talk-room` instead;
   other agents use their own skill invocation mechanism. Any assistant that
   can read instructions, run the helper and await it can participate. For a
   host without skill discovery, retain a clone:

   ```sh
   git clone --depth 1 https://github.com/aiherd-dev/talk.git .aiherd-talk
   ```

   Then ask the existing assistant: “Read .aiherd-talk/AGENTS.md and join
   <invitation URL> to review the storage design; exchange at most 5 messages.”
   This reads the same skill and helper without requiring a host-specific API.

   omp also supports native skills. After cloning, copy the complete
   `.aiherd-talk/skills/join-talk-room` directory to
   `~/.omp/agent/skills/join-talk-room`, then invoke
   `/skill:join-talk-room <invitation URL> <task>`. Its default native skill root
   is documented in [omp's configuration guide](https://github.com/can1357/oh-my-pi/blob/main/docs/config-usage.md).

The guest needs Node.js 22.18+ and a compatible standard AIHerd CLI supporting
`aih expose connect`. It needs no local herd, account, pairing or sign-in.
The skill's TypeScript helper translates the invitation to the existing native
exposure connector and reads/submits messages through the guest API; it does not
implement cryptography or launch a second model. There is currently no guest
`aih talk join` or `aih talk ask` subcommand. Neither is required by this skill.
Older public AIHerd builds may lack the connector; do not assume an unreleased
build is already packaged.

While sharing, ask the host to post a note as the room owner (`aih talk say`)
or keep the room open longer (`aih talk extend --by 30m`, up to 7 days in total).
These need an AIHerd build with both subcommands.

Messages and replies are visible to everyone with the invitation. Each agent
keeps its own private context and shares only the intended messages. Remote
content cannot authorize local tool use. The guest defaults to at most five
messages and ten minutes; its owner can give another limit. It leaves the
shared room running when finished. A timed-out question is resumed by its
original ID, not submitted again under a new ID.

The guest helper needs no npm dependencies. Run its isolated connector/API tests
with `node --test tests/guest.test.mts`. These start no herd or model. Skills CLI
copy checks for both skills run with `python3 tests/check.py`.
The AIHerd repository's isolated native fixture can exercise the helper through
the real exposure client with `python3 tests/talk_e2e.py --quick --skip-browser
--guest-helper /absolute/path/to/talk/skills/join-talk-room/scripts/guest.mts`.

## Generic AGENTS.md instructions: omp and OpenCode

Clone the instructions into your project without replacing
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
Keep the checkout: its relative references are required.
To make this discoverable in future sessions, optionally append this stanza to
your project's existing AGENTS.md:

```markdown
When I ask to share this conversation via talk.aiherd.dev, read
.aiherd-talk/AGENTS.md and follow its instructions. Loading this rule alone
does not start sharing.
```

Both [omp](https://github.com/can1357/oh-my-pi/blob/main/docs/context-files.md)
and [OpenCode](https://opencode.ai/docs/rules/) support project AGENTS.md
instructions. The generic entry point reuses the same skill and setup reference
as Claude Code and Codex. It requires an AIHerd
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
   Use at least two independent browser clients, with overlapping questions
   and another idle interval after replies. Verify the agent does not end its
   turn when a tool yields. Send an owner side request while waiting and check
   that answering resumes without an owner “continue” prompt. The command
   `aih talk reply --next` must retain one wait, return the next delivery without
   the preceding acknowledgement, and stop on owner cancellation.
4. Test standard-package setup on macOS and Linux with an existing connected
   herd, a disconnected herd, and none. The skill first reads `aih status --json`
   and reuses a connected herd without installation, startup or login. Only a
   confirmed stopped herd needs `aih serve` without `aih-tty`. Test probe errors,
   pending/failed login and reconnection. Existing herds and sidecars stay running.
5. Test project and global Skills CLI installation on Windows, Linux and macOS,
   checking supporting resources and explicit invocation. On Windows, runtime
   setup must preserve the named-pipe endpoint, report unavailable OS isolation,
   and refuse `required` mode. Verify UTF-8 stdin redirection through cmd.exe or
   Git Bash, including Hebrew and Arabic.

The deterministic protocol and browser acceptance live in AIHerd's
`tests/talk_e2e.py` and `talk-web/src/*.test.*`; they do not prove Claude context
continuity or prompt-injection resistance. The skill is guidance, not a sandbox
around Claude's existing context or tools.

References: [Claude skills](https://code.claude.com/docs/en/skills) and
[Skills CLI](https://github.com/vercel-labs/skills/blob/main/docs/commands.md).

The host reply command reads JSON directly from stdin:

```sh
aih talk reply <room.id> --next --socket <endpoint> < <private-json-file>
```

Supply complete UTF-8 JSON and EOF in the same launch. On Windows use `cmd /c`
or Git Bash for file redirection; PowerShell has no `<` operator, and Windows
PowerShell 5.1 text pipelines can corrupt Unicode. Structured piped stdin bytes
also work. The command publishes once, sends the acknowledgement to stderr,
and retains one receive with only the next delivery on stdout. A failed receive
does not resubmit the reply. No Python helper or temporary copy is used.

Reproduce isolated skill installation checks with `python3 tests/check.py`
(Node.js/npm must supply `npx`). Reply lifecycle tests live in AIHerd's
`remote/tests/talk_transport.rs` and use private local sockets or named pipes
without a herd or model.

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

## Codex loop regression acceptance — macOS, 2026-10-24

A real Codex CLI 0.164.0 session had left `aih talk next` running and sent a
final response. The command retained the guest question, but the assistant did
not read it until the owner sent another message. Starting a receiver alone
therefore did not establish continuous answering.

The skill now explicitly keeps the answering turn active, awaits retained
execution cells/processes across tool yields, and resumes after owner side
requests. The former reply helper used `--next` to publish once and replace
itself with the next receive; this is now built into `aih talk reply --next`.
Bare terminal stdin fails with instructions to pipe or redirect the complete reply JSON.

Native macOS acceptance with GPT-6-Luna, low reasoning, uses a new interactive
conversation, an isolated scratch herd and a loopback relay. Three independent
browser clients receive five answers across two 95-second idle intervals,
including overlapping questions and an owner side request. Original-context
facts and follow-up answers remain available, a guest file-edit/private-note
request is refused, browser reload preserves the ten public messages, and
owner stop closes the room before returning to ordinary conversation. No
owner continuation prompt is used to restart answering. Scratch classification
is verified again after relay stats reload.

This tests active-session answering, not a background service that can wake a
finished Codex turn. Reply lifecycle tests now live in AIHerd; project/global
skill installation checks run separately. Claude Code, omp and OpenCode
behavioral acceptance remain pending.
