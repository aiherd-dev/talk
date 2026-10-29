# Publish the visible session history

Session history is included by default. A recap in `--description` is separate
and never substitutes for the actual earlier messages. This requires an AIHerd
build with `aih talk session write`, `publish` and `follow`, and a website that
understands Talk version 2. If unavailable, explain the required update rather
than silently sharing a room without history. The owner can explicitly request
`--history none` for a legacy question-only room.

## Prepare an export before creating the invitation

Create a dedicated private directory for this share (0700 on Unix; protected
owner ACLs on Windows). Retain its path and the export path for the duration of
sharing. The private directory can be inside the owner's workspace or their
explicitly selected scratch rig. Do not use predictable files directly in a
shared temporary directory.

Use the file-writing tool to prepare this UTF-8 JSON shape inside that directory:

```json
{
  "version": 1,
  "session_id": "this-conversation",
  "revision": 1,
  "complete": true,
  "messages": [
    {"id": "owner-1", "role": "user", "text": "The original visible owner message."},
    {"id": "assistant-1", "role": "assistant", "text": "The original visible assistant response."}
  ]
}
```

Export **all available visible owner and assistant turns** of the conversation,
in their original order and wording. Do not replace them with a recap, invented
messages or progress notes. Exclude system/developer instructions, hidden
reasoning, tool calls/results, host-injected skill bodies and unrelated subagents. Omit explicitly owner-only
material, credentials, private setup paths and invitation delivery details;
mark a redaction in a mixed visible message instead of silently rewriting the
rest of it. Guest question/answer turns already have their own Talk transcript;
do not duplicate them in the owner-session history.

Use unique stable IDs made of letters, digits, hyphens or underscores (at most
128 bytes), and keep those IDs on later exports. `session_id` is an opaque local
identifier with the same character rules, not a filesystem path. `timestamp`
may be omitted when unknown. `complete` is false if earlier visible history is
unavailable after compaction; tell the owner and let the page show that limitation.
Do not reconstruct missing messages from a summary or pretend they are verbatim.
The export can contain up to 4096 messages and 4 MiB of encoded JSON. A larger
history must fail explicitly; ask the owner to choose a smaller scope and mark
it incomplete, rather than silently truncating it.

Validate and atomically install the export using the existing `aih` executable:

```sh
aih talk session write --file <private-directory>/history.json < <private-directory>/draft.json
```

Supply complete JSON with EOF in the same launch. Use a file-writing tool or
structured stdin for message text, never interpolate it into executable shell
syntax. Delete the draft after the write succeeds. The destination's parent
must be a dedicated private directory; `write` creates it if absent. On Windows
use cmd.exe or Git Bash redirection, as for the reply command.

## Publish and follow

After `aih talk start`, require `room.version == 2`, retain the room ID/socket,
and publish before handing out the invitation:

```sh
aih talk session publish <room.id> --file <private-directory>/history.json --socket <endpoint>
aih talk session follow <room.id> --file <private-directory>/history.json --socket <endpoint>
```

`publish` finishes after an atomic commit. Launch `follow` as a separate retained
background process through this host's managed tools. Retain its task/session
ID and initial output; it continues watching without invoking a model. Confirm
`aih talk status` reports a nonzero `history.revision` and `source_state` of
`following` before delivering the link. If starting or retaining the publisher
fails, stop the room and report the limitation. Keep it separate from the Talk
question receiver, which has its own retained handle.

## Keep publishing during normal work

While sharing remains active, update the export after every new visible owner
turn and completed assistant response, and before returning a final response.
Retain the earlier messages and stable IDs, append the new turns, and increment
`revision`. Use `session write` to replace the export atomically. The follower
publishes it and an open page updates without a refresh. A tool-only yield is
not a new visible conversation message. A healthy follower means the export
file is watched; it does not prove you have exported your latest turn.

For a watch-only share, ordinary work continues in this conversation. Do not
enter `aih talk next`. For Talk answering mode, keep the existing question loop
active; owner side requests update history and then return to that loop.

On owner stop, cancel the retained publisher, run `aih talk stop` on the same
endpoint, and remove the private export directory you created. Stop/expiry also
makes the follower exit; never stop the owner's existing herd. A source error
retains the last accepted history and is displayed on the page. Correct an
invalid export rather than claiming it was delivered.
