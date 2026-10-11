import type { ApiConfig, HealthStatus, ImageResponse, MediaJob } from "./types";

function endpoint(config: ApiConfig, path: string): string {
  return `${config.baseUrl.replace(/\/$/, "")}${path}`;
}

function headers(config: ApiConfig, json = false): HeadersInit {
  const value: Record<string, string> = {};
  if (config.apiKey) value.Authorization = `Bearer ${config.apiKey}`;
  if (json) value["Content-Type"] = "application/json";
  return value;
}

async function responseError(response: Response): Promise<Error> {
  const fallback = `${response.status} ${response.statusText}`;
  try {
    const body = (await response.json()) as { error?: string };
    return new Error(body.error || fallback);
  } catch {
    return new Error(fallback);
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<T>;
}

export function getHealth(config: ApiConfig): Promise<HealthStatus> {
  return requestJson(endpoint(config, "/healthz"));
}

export function listVideoJobs(config: ApiConfig): Promise<MediaJob[]> {
  return requestJson(endpoint(config, "/api/v1/videos/jobs"), {
    headers: headers(config),
  });
}

export function createVideo(
  config: ApiConfig,
  payload: {
    model: string;
    prompt: string;
    duration: number;
    size: string;
    project_id?: string;
    scene_id?: string;
    shot_id?: string;
    start_image_result_id?: string;
    seed?: number;
    steps?: number;
  },
): Promise<MediaJob> {
  return requestJson(endpoint(config, "/api/v1/videos/generations"), {
    method: "POST",
    headers: headers(config, true),
    body: JSON.stringify(payload),
  });
}

export function createImages(
  config: ApiConfig,
  payload: { model: string; prompt: string; size: string; n: number },
): Promise<ImageResponse> {
  return requestJson(endpoint(config, "/api/v1/images/generations"), {
    method: "POST",
    headers: headers(config, true),
    body: JSON.stringify(payload),
  });
}

export async function loadProtectedMedia(config: ApiConfig, url: string): Promise<string> {
  let target = url;
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/api/")) target = endpoint(config, parsed.pathname);
  } catch {
    target = endpoint(config, url.startsWith("/") ? url : `/${url}`);
  }
  const response = await fetch(target, { headers: headers(config) });
  if (!response.ok) throw await responseError(response);
  return URL.createObjectURL(await response.blob());
}

