type SupabaseResult<T> = {
  data: T;
  total: number | null;
};

export class SupabaseRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SupabaseRequestError";
  }
}

function getSupabaseCredentials(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new SupabaseRequestError("Research database is not configured.", 503);
  }
  return { url, key };
}

export async function supabaseRequest<T>(
  resource: string,
  init: RequestInit = {},
): Promise<SupabaseResult<T>> {
  const { url, key } = getSupabaseCredentials();
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("authorization", `Bearer ${key}`);
  headers.set("accept-profile", "public");
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${url}/rest/v1/${resource}`, {
      ...init,
      headers,
    });
  } catch {
    throw new SupabaseRequestError("Research database is unavailable.", 503);
  }

  if (!response.ok) {
    throw new SupabaseRequestError(
      "Research database request failed.",
      response.status,
    );
  }

  const raw = await response.text();
  let data: T;
  try {
    data = (raw ? JSON.parse(raw) : null) as T;
  } catch {
    throw new SupabaseRequestError("Research database returned an invalid response.", 502);
  }

  const contentRange = response.headers.get("content-range");
  const totalText = contentRange?.split("/")[1];
  const total = totalText && totalText !== "*" ? Number(totalText) : null;
  return { data, total: Number.isFinite(total) ? total : null };
}
