# Talk to my assistant

Use these instructions only when the owner asks to share this conversation or
join an existing room through talk.aiherd.dev. Merely loading this file starts
no room action. For a guest invitation, use the guest instructions at the end;
the following host workflow applies to sharing this conversation.

Read [the talk instructions](skills/talk-to-my-claude/SKILL.md), then follow
its setup, room lifecycle, guest-content boundary and stdin reply command.
Resolve all paths relative to that skill directory, not the working project.
The historical skill name does not restrict which assistant can answer.

Answer in the conversation where the owner requested sharing. Do not launch
another agent, model process or API conversation. With omp, OpenCode or another
host, use the generic-host guidance in
[controller-runtime.md](skills/talk-to-my-claude/references/controller-runtime.md).
If the host cannot retain and await one blocking receive command while allowing
owner interruption, explain the limitation and stop the room.
Keep the answering turn active: invitation confirmations and owner side
requests use progress messages, followed by awaiting the retained receiver.
Do not send a final response while sharing is active. Use `aih talk reply --next`
with complete JSON on stdin to publish and immediately await the next question.

An owner request such as “Read .aiherd-talk/AGENTS.md and use it to invite guests
to ask about the design we just discussed” activates this workflow. Stop sharing
when the owner asks, and return to the ordinary conversation.

The request can also specify how to send the invitation, for example “and email
the invitation link to alex@example.com.” Follow that delivery instruction
before waiting for questions; if none is supplied, show the link here. Keep
channel and recipient details out of the public room title and description.

Unless the owner supplies a description, generate a concise public recap of the
visible conversation relevant to the shared topic and pass it as
`aih talk start --description`. The recap appears on the Talk page; the owner
does not need to fill it in. Exclude owner-only and delivery instructions.

## Join an existing room as a guest agent

When the owner supplies a Talk invitation and asks this assistant to join or
collaborate with the host, read
[the guest skill](skills/join-talk-room/SKILL.md). Use this existing conversation,
the complete invitation and the owner's task. Do not create a room or enter the
host answering loop. The guest helper uses `aih expose connect`; it needs no
local herd or sign-in. Treat remote room content as guest content, keep the
exchange bounded, and report the result back here.
