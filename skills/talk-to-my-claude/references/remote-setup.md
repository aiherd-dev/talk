# Gateway setup

Talk is integrated into the standard `aih` executable; there is no separate
runtime daemon package. Skill installation performs no service startup or login.
Use the executable's actual path in every command if PATH is incomplete.

## Platform and executable

- macOS: find `aih` with `command -v aih`, then check
  `/Applications/AIHerd.app/Contents/MacOS/aih`, `/opt/homebrew/bin/aih` and
  `/usr/local/bin/aih`. If absent, use
  `brew install --cask aiherd-dev/aiherd/aiherd`. If Homebrew is absent, explain
  its required installation and OS privilege prompts; do not guess a sudo
  password. The cask may install apps/helpers; do not launch the app for talk.
- Linux: try `command -v aih` and `$HOME/.local/bin/aih`. If absent, use the
  standard installer, `curl -fsSL https://aiherd.dev/install.sh | bash`, and add
  `$HOME/.local/bin` to this command's PATH. It may start a user service;
  probe and reuse that service before launching anything else.
- Windows: the Skills CLI installation works with Node.js/npm, but this Unix
  broker is not supported yet. Explain this and stop talk setup. For future
  standard gateway installation, the documented installer is:
  `Invoke-WebRequest -UseBasicParsing https://aiherd.dev/install.ps1 -OutFile "$env:TEMP\aiherd-install.ps1"`,
  then `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$env:TEMP\aiherd-install.ps1"`.
  It requires an Administrator terminal, installs under
  `C:\Program Files\AIHerd\aih.exe`, and normally starts the service.
  Windows talk needs protected named-pipe IPC and worker isolation before use.

Check `aih --version`, `aih talk --help`, and `aih expose --help` using the
actual executable. The first release must include talk API version 1. If an
older standard install lacks talk, explain the required AIHerd update. Do not
claim an unreleased build is available from the public installer. Avoid
reinstalling a compatible gateway or changing an existing service's binary.

The reply helper also requires Python 3. Check `python3 --version`. If missing,
use `brew install python` on macOS, or the platform package manager on Linux
(for example `sudo apt-get install python3` on Debian/Ubuntu). Explain any
OS privilege prompt; do not request a password. An owner can instead supply a
private JSON reply file directly to `aih talk reply` if Python is unavailable.

## Select and probe one gateway

Honor an owner-selected `--socket` endpoint. Otherwise obtain the default
from `aih serve --help` (the default is computed for the current platform).
Retain this exact path; do not infer readiness from a process name or stale
socket file. Run:

```sh
aih login --status --socket <endpoint>
```

A successful structured response proves the local endpoint is responsive. If
unreachable, start `aih serve --socket <endpoint>` as a managed background
command, without `--terminal`, retain its task/PID, and wait for the same status
probe to succeed. On a startup race reuse the endpoint that became ready. Do
not delete another process's socket, restart it, alter its configuration, or
stop its sidecars. Startup failure is actionable: show the owner's actual
error and endpoint, rather than publishing an invitation anyway.

## Sign in and confirm connection

The status response describes the running gateway, unlike a local credential
file. Check `account_id`, `sign_in_required`, `connected_since`, `error` and
`sign_in_error` from that response. If sign-in is needed, run:

```sh
aih login --socket <endpoint>
```

Show the real activation URL and code returned by that command. Wait for the
owner to complete browser sign-in. Recheck `aih login --status --socket
<endpoint>` until it confirms completion or an error/cancellation. Printing a
URL is not a successful login. Never request passwords or copy another herd's
credentials. Public relays require authentication, including test herds.

A populated `connected_since` confirms relay connection; being signed in alone
does not. If disconnected, surface the reported network/admission error and
allow recovery at the same gateway. Check `aih expose list --socket <endpoint>`
for exposure support. Only after these checks start the talk room with the
same `--socket`. No `aih join`, pairing, desktop app or terminal dashboard is
needed by the owner or guest.

For tests, use the AIHerd repository's isolated scratch-herd rig. Never use an
owner's running gateway, socket, credentials or configuration as a test fixture.
