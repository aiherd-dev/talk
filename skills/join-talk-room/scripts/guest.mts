import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

type ObjectValue = Record<string, unknown>;
type GuestRequest = {
  action: "inspect" | "ask" | "wait";
  url: string;
  wait_ms: number;
  id?: string;
  text?: string;
  display_name?: string;
};
export type GuestResult = {
  status: string;
  id?: string;
  http_status?: number;
  remote_content?: unknown;
};
function object(value: unknown): ObjectValue {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected a JSON object");
  return value as ObjectValue;
}

export function capabilityLink(raw: string): string {
  const url = new URL(raw);
  if (
    url.origin !== "https://talk.aiherd.dev" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search
  )
    throw new Error("Expected a Talk invitation URL");
  const fields = new URLSearchParams(url.hash.slice(1));
  if (
    [...fields.keys()].some((key) => !["v", "i", "k", "p"].includes(key)) ||
    ["v", "i", "k", "p"].some((key) => fields.getAll(key).length !== 1) ||
    fields.get("v") !== "1"
  )
    throw new Error("Incomplete or unsupported invitation");
  const id = fields.get("i")!;
  const key = fields.get("k")!;
  if (
    !/^[a-f0-9]{32}$/.test(id) ||
    !/^[A-Za-z0-9_-]{43}$/.test(key) ||
    Buffer.from(key, "base64url").toString("base64url") !== key
  )
    throw new Error("Invalid invitation credentials");
  const relay = new URL(fields.get("p")!);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(relay.hostname);
  if (
    (relay.protocol !== "https:" &&
      !(relay.protocol === "http:" && loopback)) ||
    relay.username ||
    relay.password ||
    relay.pathname !== "/" ||
    relay.search ||
    relay.hash
  )
    throw new Error("Invalid invitation relay");
  return `aih+expose://${id}#v=1&k=${key}&p=${encodeURIComponent(relay.origin)}`;
}

export function parseRequest(raw: unknown): GuestRequest {
  const value = object(raw);
  if (typeof value.url !== "string") throw new Error("Missing invitation URL");
  capabilityLink(value.url);
  if (!["inspect", "ask", "wait"].includes(String(value.action)))
    throw new Error("Invalid action");
  const wait_ms = value.wait_ms ?? 120_000;
  if (
    typeof wait_ms !== "number" ||
    !Number.isInteger(wait_ms) ||
    wait_ms < 0 ||
    wait_ms > 600_000
  )
    throw new Error("wait_ms must be between 0 and 600000");
  if (
    value.id !== undefined &&
    (typeof value.id !== "string" || !/^[a-f0-9]{32}$/.test(value.id))
  )
    throw new Error("Invalid question ID");
  if (value.action === "wait" && value.id === undefined)
    throw new Error("wait requires the original question ID");
  if (value.action === "ask") {
    if (
      typeof value.text !== "string" ||
      !value.text.trim() ||
      Buffer.byteLength(value.text) > 16_384
    )
      throw new Error("Message must contain 1–16384 UTF-8 bytes");
    if (
      typeof value.display_name !== "string" ||
      !value.display_name.trim() ||
      Buffer.byteLength(value.display_name) > 80 ||
      /\p{Cc}/u.test(value.display_name)
    )
      throw new Error(
        "Name must contain 1–80 UTF-8 bytes without control characters",
      );
  }
  return { ...value, wait_ms } as GuestRequest;
}

class HttpError extends Error {
  status: number;
  constructor(status: number) {
    super(`Room request failed (HTTP ${status})`);
    this.status = status;
  }
}
async function request(
  base: string,
  path: string,
  signal: AbortSignal,
  body?: unknown,
): Promise<ObjectValue> {
  const response = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new HttpError(response.status);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing room response");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.length;
      if (bytes > 8 * 1024 * 1024) throw new Error("Room response too large");
      chunks.push(next.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return object(JSON.parse(Buffer.concat(chunks).toString("utf8")));
}

async function withBridge<T>(
  url: string,
  aih: string,
  signal: AbortSignal,
  use: (base: string) => Promise<T>,
): Promise<T> {
  signal.throwIfAborted();
  const child = spawn(
    aih,
    ["expose", "connect", capabilityLink(url), "--listen", "127.0.0.1:0"],
    {
      stdio: ["ignore", "ignore", "pipe"],
    },
  );
  try {
    const base = await new Promise<string>((resolveReady, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Connector startup timed out")),
        30_000,
      );
      let output = "";
      const aborted = () => reject(new Error("Guest operation cancelled"));
      const clear = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", aborted);
      };
      child.once("error", () => {
        clear();
        reject(new Error("Could not start the selected AIHerd CLI"));
      });
      child.once("exit", () => {
        clear();
        reject(
          new Error(
            "Connector exited; check CLI support and invitation availability",
          ),
        );
      });
      signal.addEventListener("abort", aborted, { once: true });
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk: string) => {
        output = (output + chunk).slice(-8192);
        const match = output.match(
          /Expose listening at (http:\/\/127\.0\.0\.1:\d+)\r?\n/,
        );
        if (match) {
          clear();
          resolveReady(match[1]);
        }
      });
    });
    return await use(base);
  } finally {
    if (child.exitCode === null) {
      child.kill("SIGINT");
      await Promise.race([
        new Promise<void>((done) => child.once("exit", () => done())),
        delay(1000),
      ]);
      if (child.exitCode === null) child.kill("SIGKILL");
    }
  }
}

export async function runGuest(
  raw: unknown,
  aih: string,
  signal: AbortSignal,
  pending: (id: string) => void = () => {},
): Promise<GuestResult> {
  const input = parseRequest(raw);
  return withBridge(input.url, aih, signal, async (base) => {
    const session = await request(base, "/session", signal);
    if (session.version !== 1 && session.version !== 2) throw new Error("Unsupported room version");
    if (input.action === "inspect")
      return {
        status: "ok",
        remote_content: {
          session,
          conversation: await request(base, "/conversation", signal),
        },
      };
    const id = input.id ?? randomBytes(16).toString("hex");
    let receipt: ObjectValue | undefined;
    if (input.action === "ask") {
      if (session.mode === "watch") throw new Error("This session is watch only; inspect its shared history instead of asking a question");
      if (!["ready", "answering"].includes(String(session.state)))
        return { status: String(session.state), id };
      const limits = object(session.limits);
      if (
        typeof limits.question_bytes !== "number" ||
        Buffer.byteLength(input.text!) > limits.question_bytes
      )
        throw new Error("Message exceeds this room's limit");
      pending(id);
      try {
        receipt = await request(base, "/messages", signal, {
          id,
          text: input.text,
          display_name: input.display_name,
        });
      } catch (error) {
        signal.throwIfAborted();
        if (error instanceof HttpError && error.status < 500)
          return { status: "rejected", id, http_status: error.status };
        try {
          receipt = await request(base, `/messages/${id}`, signal);
        } catch {
          signal.throwIfAborted();
          return { status: "delivery_unknown", id };
        }
      }
    }
    const end = Date.now() + input.wait_ms;
    for (;;) {
      if (!receipt) {
        try {
          receipt = await request(base, `/messages/${id}`, signal);
        } catch (error) {
          signal.throwIfAborted();
          if (error instanceof HttpError && error.status === 404)
            return { status: "not_found", id };
          if (Date.now() >= end) return { status: "waiting", id };
        }
      }
      if (receipt) {
        if (receipt.id !== id)
          throw new Error("Room returned a different question ID");
        if (receipt.state === "completed" && typeof receipt.answer === "string")
          return {
            status: "completed",
            id,
            remote_content: { answer: receipt.answer },
          };
        if (["interrupted", "failed", "closed"].includes(String(receipt.state)))
          return { status: String(receipt.state), id };
      }
      if (Date.now() >= end) return { status: "waiting", id };
      await delay(Math.min(2000, end - Date.now()), undefined, { signal });
      receipt = undefined;
    }
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--aih" || process.stdin.isTTY)
    throw new Error(
      "Pipe one JSON request to: node guest.mts --aih <actual-aih-path>",
    );
  let input = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) {
    input += chunk.toString();
    if (Buffer.byteLength(input) > 128 * 1024)
      throw new Error("Input is too large");
  }
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  try {
    const result = await runGuest(
      JSON.parse(input),
      args[1],
      controller.signal,
      (id) => console.log(JSON.stringify({ kind: "question", id })),
    );
    console.log(JSON.stringify(result));
    process.exitCode = ["ok", "completed"].includes(result.status)
      ? 0
      : result.status === "waiting"
        ? 124
        : result.status === "delivery_unknown"
          ? 75
          : 1;
  } finally {
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main().catch(() => {
    console.error(
      JSON.stringify({
        status: "error",
        error:
          "Guest operation failed. Check the invitation, request, CLI support and network; preserve any printed question ID.",
      }),
    );
    process.exitCode = 1;
  });
}
