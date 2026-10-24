# AIHerd setup

Use the standard AIHerd installation and its `aih` command, including an
existing desktop or terminal installation. Talk is the `aih talk` subcommand;
it does not need a separate remote-only installation or daemon package. Skill
installation itself starts no service or login.

## Check the existing herd first

Find `aih` with `command -v aih`. If PATH is incomplete, check the usual installed
locations below and use the actual executable path in every command. V1 talk
requires Unix; explain the unsupported broker on Windows before installation
or login.

Honor an owner-selected `--socket` endpoint. Otherwise run:

```sh
aih status --json
```

With an explicit endpoint, use `aih status --json --socket <endpoint>` instead.
Read the JSON even when the command exits nonzero. Retain the returned `socket`
for every subsequent command; it is the current platform's actual default.
The command only reads the selected running herd, without starting services,
loading credentials, or changing configuration.

- `running: true, connected: true`: reuse this herd immediately. Skip installation,
  startup and login. An existing standard AIHerd service already does the work.
- `running: true, connected: false`: keep the same herd and endpoint. Follow
  connection recovery below; do not launch a replacement.
- `running: false`: the selected herd is stopped. Start
  `aih serve --socket <endpoint>` as a managed background command **without
  `--terminal`**, retain its task/PID, and wait for `aih status --json --socket
  <endpoint>` to report `running: true`. Reuse the endpoint if another process
  wins a startup race. Do not delete another process's socket.
- `running: null`: the probe failed (for example, permission denied, timeout or
  an invalid response). Show its `error` and endpoint. Do not treat this as a
  stopped herd or launch a replacement. Resolve the failure before proceeding.

Exit status is zero when the herd responds, including when disconnected, and
one for a stopped herd or probe failure. Use the JSON fields for decisions,
not just the exit status or a socket file's presence. If an older `aih` lacks
`status` or `talk`, explain the required update of the standard installation;
do not install another daemon or claim an unreleased build is publicly packaged.
Never replace/restart an existing herd or change its sidecars for this skill.

## Install only when AIHerd is missing

- macOS: also check `/Applications/AIHerd.app/Contents/MacOS/aih`,
  `/opt/homebrew/bin/aih` and `/usr/local/bin/aih`. If absent, use the standard
  `brew install --cask aiherd-dev/aiherd/aiherd`. If Homebrew is absent, explain
  its installation and OS privilege prompts; never request a sudo password.
- Linux: also check `$HOME/.local/bin/aih`. If absent, use the standard installer,
  `curl -fsSL https://aiherd.dev/install.sh | bash`, and add `$HOME/.local/bin`
  to this command's PATH. The installer may start a user service: return to
  `aih status --json` and reuse it before considering `aih serve`.

## Connect the selected running herd if needed

Skip this section when `connected` is already true. For a running but disconnected
herd, inspect `phase`, `sign_in_required`, `login_pending` and `error` from
`aih status --json --socket <endpoint>`.

If the relay is off or sign-in is required, run:

```sh
aih login --socket <endpoint>
```

This enables the relay on the same herd and reuses valid sign-in credentials.
If login is already pending, the same command returns its current activation
information. Show the actual activation URL and code only when the command
requires browser sign-in, then wait for the owner to complete it. Recheck
`aih status --json --socket <endpoint>` until `connected: true` or an
error/cancellation. Printing a URL or `signed_in: true` alone does not establish
relay connectivity. Never request passwords or copy another herd's credentials.
Public relays require authentication, including scratch herds.

When the relay is already serving with valid sign-in, allow the same herd to
reconnect and surface its reported network/admission error if it cannot. Do not
repeat login, reinstall AIHerd or start a second herd to fix a connection error.

Before creating a room, check `aih talk --help`, `aih expose list --socket
<endpoint>` and Python 3 availability. If Python is missing, use the platform's
normal package manager, explaining privilege prompts. The owner can instead
supply a private JSON file directly to `aih talk reply`. All talk and exposure
commands must use the retained endpoint. No pairing or `aih join` is required.

For tests, use the AIHerd repository's isolated, explicitly marked scratch-herd
rig. Never use the owner's running herd, socket, credentials or configuration as
a test fixture.
