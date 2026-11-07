// Types mirror the go json (qna.View, qna.QuestionView) exactly.
export type QuestionView = {
  id: string;
  text: string;
  name?: string;
  votes: number;
  createdAt: string;
  voted: boolean;
  mine: boolean;
  edited: boolean;
  answered: boolean;
  hidden?: boolean;
};

export type View = {
  questions: QuestionView[];
  highlighted?: string;
  title?: string;
  joinUrl?: string;
  connected?: number;
  public?: boolean;
  wifi?: string;
};

// code is the server's error code ("not_found", …) or "network".
export type ApiError = { status: number; code: string };

export async function call(method: string, path: string, body?: unknown): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw { status: 0, code: "network" } satisfies ApiError;
  }
  const data = res.status === 204 ? undefined : await res.json().catch(() => undefined);
  if (!res.ok) {
    const code = (data as { error?: string } | undefined)?.error ?? "internal";
    throw { status: res.status, code } satisfies ApiError;
  }
  return data;
}

export function isApiError(e: unknown): e is ApiError {
  return typeof e === "object" && e !== null && "code" in e && "status" in e;
}

const qpath = (id: string) => "/api/questions/" + encodeURIComponent(id);
const hpath = (id: string) => "/api/host/questions/" + encodeURIComponent(id);

export const api = {
  ask: (text: string, name: string) => call("POST", "/api/questions", { text, name }) as Promise<{ id: string }>,
  edit: (id: string, text: string) => call("PATCH", qpath(id), { text }),
  remove: (id: string) => call("DELETE", qpath(id)),
  vote: (id: string) => call("POST", qpath(id) + "/vote"),
  answered: (id: string, on: boolean) => call("POST", hpath(id) + "/answered", { on }),
  hidden: (id: string, on: boolean) => call("POST", hpath(id) + "/hidden", { on }),
  highlight: (id: string) => call("POST", "/api/host/highlight", { id }),
  title: (title: string) => call("POST", "/api/host/title", { title }),
  next: () => call("POST", "/api/host/next") as Promise<{ id: string }>,
};
