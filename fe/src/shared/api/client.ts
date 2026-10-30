import axios from "axios";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (!raw) return "";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

export type RequestJsonArgs = {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  url: string;
  data?: unknown;
};

let httpClient: ReturnType<
  typeof import("./httpClient").createHttpClient
> | null = null;

async function getHttpClient() {
  if (httpClient) return httpClient;
  const { createHttpClient } = await import("./httpClient");
  const { useSessionStore } = await import("@/shared/store/sessionStore");

  httpClient = createHttpClient({
    baseURL: getApiBaseUrl(),
    getToken: () => useSessionStore.getState().accessToken,
  });

  return httpClient;
}

export async function requestJson<T>({
  method,
  url,
  data,
}: RequestJsonArgs): Promise<T> {
  const client = await getHttpClient();

  try {
    const res = await client.request<T>({ method, url, data });
    return res.data;
  } catch (err) {
    if (!axios.isAxiosError(err)) throw err;

    const status = err.response?.status ?? 0;
    const body = err.response?.data ?? null;
    throw new ApiError(`API error (${status || "network"})`, status, body);
  }
}
