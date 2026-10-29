---
name: share-session
description: Share this conversation's visible history and live updates at talk.aiherd.dev while continuing normal work, with watch-only access for visitors.
disable-model-invocation: true
---

Share this existing conversation in watch-only mode. Interpret the owner's
argument as the topic and optional invitation delivery method/destination.
Use `/share-session` in Claude Code, `$share-session` in Codex, or an ordinary
request to read these instructions. Do not create another agent/model session.

1. Read [setup](references/setup.md) and
   [session history](references/session-history.md).
   Run `aih status --json` on the owner's selected socket and reuse a connected
   herd. Follow setup recovery without replacing or stopping an existing herd.
2. Follow the history reference to prepare all available visible messages,
   preserving actual wording and stable IDs. Mark missing earlier history
   explicitly. Generate a concise public recap for `--description` unless the
   owner supplied one. Keep owner-only instructions and delivery details private.
3. Create `aih talk start --mode watch --history all --title <title>
   --description <recap> --expires 1h --socket <endpoint>`. Require room version 2.
   Retain its room ID and endpoint. Publish the export, launch and retain its
   file follower, and confirm history revision and following status before
   delivering the complete invitation URL. Explain that invitation holders can
   read the shared history. Deliver by the owner's requested channel/destination,
   or show it here by default; report failed delivery accurately.
4. Continue normal work in this same conversation. **Do not enter an answering
   loop or call `aih talk next`.** Before each final response while sharing is
   active, update the export with the new visible owner message and completed
   assistant response using the history reference's atomic write command.
   Keep the sharing instructions and publisher handle available for later turns.
   This is agent-published history; a file watcher cannot recover turns you have
   not exported. Do not claim token streaming or an automatic native-log reader.
5. On owner stop, cancel the retained follower, stop only this room, and remove
   this workflow's private export files. Report that access was revoked and
   return to ordinary conversation. Leave the pre-existing herd running.
