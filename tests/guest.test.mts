import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  capabilityLink,
  parseRequest,
  runGuest,
} from "../skills/join-talk-room/scripts/guest.mts";

const invitation = `https://talk.aiherd.dev/#v=1&i=${"1".repeat(32)}&k=${Buffer.alloc(32, 2).toString("base64url")}&p=https%3A%2F%2Frelay.example`;
const message =
  "# שלום / مرحبا\n\nLiteral $(false) and `false`.\n\n```mermaid\nflowchart RL\n A[שלום] --> B[مرحبا]\n```";

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "talk-guest-test-"));
  const record = join(directory, "connector.json");
  const aih = join(directory, "aih");
  const state = {
    posts: 0,
    reads: 0,
    session: "ready",
    version: 1,
    receipt: undefined as Record<string, unknown> | undefined,
    posted: undefined as Record<string, unknown> | undefined,
    postMode: "complete" as
      "complete" | "pending" | "lost-ack" | "unknown" | "reject",
  };
  const server = createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json");
    const send = (value: unknown) => response.end(JSON.stringify(value));
    if (request.url === "/session")
      return send({
        version: state.version,
        state: state.session,
        title: "Remote topic",
        limits: { question_bytes: 16384 },
      });
    if (request.url === "/conversation")
      return send({ cursor: 0, messages: [], state: state.session });
    if (request.method === "POST" && request.url === "/messages") {
      state.posts++;
      let body = "";
      for await (const part of request) body += part.toString();
      state.posted = JSON.parse(body);
      if (state.postMode === "reject") {
        response.statusCode = 409;
        return send({ error: "conflict" });
      }
      if (state.postMode === "unknown") {
        request.socket.destroy();
        return;
      }
      state.receipt = {
        id: state.posted!.id,
        state: state.postMode === "pending" ? "queued" : "completed",
        answer: state.postMode === "pending" ? null : message,
      };
      if (state.postMode === "lost-ack") {
        request.socket.destroy();
        return;
      }
      return send(state.receipt);
    }
    if (request.url?.startsWith("/messages/")) {
      state.reads++;
      if (state.receipt) return send(state.receipt);
      response.statusCode = 404;
      return send({ error: "not found" });
    }
    response.statusCode = 404;
    send({ error: "unexpected route" });
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  assert(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  await writeFile(
    aih,
    `#!${process.execPath}
import { writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(record)}, JSON.stringify({pid: process.pid, args: process.argv.slice(2)}));
console.error('Expose listening at ' + ${JSON.stringify(origin)});
setInterval(() => {}, 10000);
process.on('SIGINT', () => process.exit(0));
`,
    { mode: 0o700 },
  );
  return {
    state,
    aih,
    async stopped() {
      const value = JSON.parse(await readFile(record, "utf8"));
      assert.deepEqual(value.args, [
        "expose",
        "connect",
        capabilityLink(invitation),
        "--listen",
        "127.0.0.1:0",
      ]);
      assert.throws(() => process.kill(value.pid, 0), { code: "ESRCH" });
    },
    async close() {
      server.closeAllConnections();
      await new Promise<void>((done) => server.close(() => done()));
      await rm(directory, { recursive: true, force: true });
    },
  };
}

test("validates complete invitations and byte limits before connecting", () => {
  assert.equal(
    capabilityLink(invitation),
    `aih+expose://${"1".repeat(32)}#v=1&k=${Buffer.alloc(32, 2).toString("base64url")}&p=https%3A%2F%2Frelay.example`,
  );
  for (const bad of [
    invitation.split("#")[0],
    invitation + "&k=duplicate",
    invitation.replace("https://talk.aiherd.dev", "https://evil.example"),
    invitation.replace(
      "https%3A%2F%2Frelay.example",
      "http%3A%2F%2Frelay.example",
    ),
  ]) {
    assert.throws(() => capabilityLink(bad));
  }
  assert.throws(() =>
    parseRequest({
      action: "ask",
      url: invitation,
      text: "x",
      display_name: "א".repeat(41),
    }),
  );
  assert.throws(() => parseRequest({ action: "wait", url: invitation }));
});

test("inspection reads public room content and never posts or touches host controls", async () => {
  const rig = await fixture();
  try {
    const result = await runGuest(
      { action: "inspect", url: invitation },
      rig.aih,
      new AbortController().signal,
    );
    assert.equal(result.status, "ok");
    assert.equal(rig.state.posts, 0);
    await rig.stopped();
  } finally {
    await rig.close();
  }
});

test("asks once, preserves Markdown/RTL, and closes its own connector", async () => {
  const rig = await fixture();
  try {
    const ids: string[] = [];
    const result = await runGuest(
      {
        action: "ask",
        url: invitation,
        text: message,
        display_name: "Review agent",
      },
      rig.aih,
      new AbortController().signal,
      (id) => ids.push(id),
    );
    assert.equal(result.status, "completed");
    assert.deepEqual(result.remote_content, { answer: message });
    assert.equal(rig.state.posts, 1);
    assert.equal(rig.state.posted!.text, message);
    assert.deepEqual(ids, [result.id]);
    await rig.stopped();
  } finally {
    await rig.close();
  }
});

test("one retained helper wait receives a later answer without another submission", async () => {
  const rig = await fixture();
  rig.state.postMode = "pending";
  try {
    const result = await runGuest(
      {
        action: "ask",
        url: invitation,
        text: message,
        display_name: "Agent",
        wait_ms: 500,
      },
      rig.aih,
      new AbortController().signal,
      (id) =>
        setTimeout(() => {
          rig.state.receipt = { id, state: "completed", answer: message };
        }, 100),
    );
    assert.equal(result.status, "completed");
    assert.deepEqual(result.remote_content, { answer: message });
    assert.equal(rig.state.posts, 1);
    assert.equal(rig.state.reads, 1);
    await rig.stopped();
  } finally {
    await rig.close();
  }
});

test("timeout/resume waits on the same ID without another submission", async () => {
  const rig = await fixture();
  rig.state.postMode = "pending";
  try {
    const first = await runGuest(
      {
        action: "ask",
        url: invitation,
        text: message,
        display_name: "Agent",
        wait_ms: 0,
      },
      rig.aih,
      new AbortController().signal,
    );
    assert.equal(first.status, "waiting");
    rig.state.receipt = {
      ...rig.state.receipt,
      state: "completed",
      answer: "Answer",
    };
    const next = await runGuest(
      { action: "wait", url: invitation, id: first.id, wait_ms: 0 },
      rig.aih,
      new AbortController().signal,
    );
    assert.equal(next.id, first.id);
    assert.equal(next.status, "completed");
    assert.equal(rig.state.posts, 1);
    await rig.stopped();
  } finally {
    await rig.close();
  }
});

test("lost acknowledgements reconcile by receipt without replaying the write", async () => {
  const rig = await fixture();
  rig.state.postMode = "lost-ack";
  try {
    const result = await runGuest(
      { action: "ask", url: invitation, text: message, display_name: "Agent" },
      rig.aih,
      new AbortController().signal,
    );
    assert.equal(result.status, "completed");
    assert.equal(rig.state.posts, 1);
    assert.equal(rig.state.reads, 1);
    await rig.stopped();
  } finally {
    await rig.close();
  }
});

test("uncertain delivery and not-found never invent a new question or replay", async () => {
  const rig = await fixture();
  rig.state.postMode = "unknown";
  try {
    const first = await runGuest(
      { action: "ask", url: invitation, text: message, display_name: "Agent" },
      rig.aih,
      new AbortController().signal,
    );
    assert.equal(first.status, "delivery_unknown");
    const next = await runGuest(
      { action: "wait", url: invitation, id: first.id, wait_ms: 0 },
      rig.aih,
      new AbortController().signal,
    );
    assert.equal(next.status, "not_found");
    assert.equal(rig.state.posts, 1);
    await rig.stopped();
  } finally {
    await rig.close();
  }
});

test("a rejected message is reported without retry", async () => {
  const rig = await fixture();
  rig.state.postMode = "reject";
  try {
    const result = await runGuest(
      { action: "ask", url: invitation, text: message, display_name: "Agent" },
      rig.aih,
      new AbortController().signal,
    );
    assert.equal(result.status, "rejected");
    assert.equal(result.http_status, 409);
    assert.equal(rig.state.posts, 1);
    await rig.stopped();
  } finally {
    await rig.close();
  }
});

test("owner cancellation closes only the guest connector", async () => {
  const rig = await fixture();
  rig.state.postMode = "pending";
  const controller = new AbortController();
  try {
    await assert.rejects(
      runGuest(
        {
          action: "ask",
          url: invitation,
          text: message,
          display_name: "Agent",
        },
        rig.aih,
        controller.signal,
        () => setTimeout(() => controller.abort(), 100),
      ),
    );
    assert.equal(rig.state.posts, 1);
    await rig.stopped();
  } finally {
    await rig.close();
  }
});
