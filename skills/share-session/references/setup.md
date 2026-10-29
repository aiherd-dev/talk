# AIHerd setup

Use the standard AIHerd installation and its `aih` command, including an
existing desktop or terminal installation. Talk is the `aih talk` subcommand;
it does not need a separate remote-only installation or daemon package. Skill
installation itself starts no service or login.

## Check the existing herd first

Find `aih` with `command -v aih` on Unix or `Get-Command aih` in PowerShell. If PATH is incomplete, check the usual installed
locations below and use the actual executable path in every command. Windows
uses named pipes; preserve the returned endpoint exactly, including backslashes.
A LocalService herd requires an elevated CLI. Windows supports the default
`--sandbox auto` mode with isolation reported as unavailable; explain that status.
If the owner requires OS isolation, stop because Windows does not support
`--sandbox required`. Do not represent a supervised process as an OS sandbox.

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

- Windows: also check `$env:ProgramFiles\AIHerd\aih.exe`. If missing, use the
  standard Windows installer linked from <https://aiherd.dev/?platform=windows>.
  It needs an elevated PowerShell window and installs the normal service. Return
  to `aih status --json` afterward; do not create a second herd. An older build
  without `aih talk` needs an update; do not claim an unreleased build is packaged.

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

Before creating a room, check `aih talk --help` and
`aih expose list --socket <endpoint>`. Host replies use `aih talk reply` with
complete UTF-8 JSON on redirected or piped stdin; no Python runtime is needed.
All talk and exposure commands must use the retained endpoint. No pairing or
`aih join` is required.

For tests, use the AIHerd repository's isolated, explicitly marked scratch-herd
rig. Never use the owner's running herd, socket, credentials or configuration as
a test fixture.
