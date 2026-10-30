import axios from "axios";
import { createHttpClient } from "./httpClient";
import { useSessionStore } from "@/shared/store/sessionStore";

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
  withCredentials?: boolean;
  skipAuth?: boolean;
};

const httpClient = createHttpClient({
  baseURL: getApiBaseUrl(),
  getToken: () => useSessionStore.getState().accessToken,
  setToken: (token) => useSessionStore.getState().setAccessToken(token),
  onUnauthorized: () => useSessionStore.getState().clearSession(),
});

export async function requestJson<T>({
  method,
  url,
  data,
  withCredentials,
  skipAuth,
}: RequestJsonArgs): Promise<T> {
  try {
    const config = { method, url, data, withCredentials, skipAuth };
    const res = await httpClient.request<T>(config);
    return res.data;
  } catch (err) {
    if (!axios.isAxiosError(err)) throw err;

    const status = err.response?.status ?? 0;
    const body = err.response?.data ?? null;
    throw new ApiError(`API error (${status || "network"})`, status, body);
  }
}
