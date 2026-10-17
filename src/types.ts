export type JobStatus =
  | "QUEUED"
  | "GENERATING_FRAMES"
  | "DOWNLOADING_FRAMES"
  | "GENERATING_AUDIO"
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
  projectId?: string;
  sceneId?: string;
  shotId?: string;
  startImageResultId?: string;
  seed?: number;
  steps?: number;
  workflowVersion?: string;
  referenceMode?: string;
  resultUrl?: string;
  error?: string;
  audioEnabled?: boolean;
  audioText?: string;
  audioVoice?: string;
  audioId?: string;
  audioDurationSeconds?: number;
}

export interface HealthStatus {
  status: string;
  frame_transport: string;
  frame_cache_available: boolean;
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

