export type JobStatus =
  | "QUEUED"
  | "GENERATING_FRAMES"
  | "ENCODING"
  | "COMPLETED"
  | "FAILED";

export interface MediaJob {
  id: string;
  type: "video";
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  model: string;
  gatewayResultId?: string;
  framesRelativePath?: string;
  frameCount?: number;
  fps?: number;
  resultUrl?: string;
  error?: string;
}

export interface HealthStatus {
  status: string;
  frames_root_available: boolean;
  results_root_available: boolean;
}

export interface ImageResult {
  result_id: string;
  url: string;
}

export interface ImageResponse {
  created: number;
  data: ImageResult[];
}

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
}

