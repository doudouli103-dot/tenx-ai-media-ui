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
  type: "video" | "drama";
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
  audioDialogues?: DialogueLine[];
  parentId?: string;
  dramaRequest?: DramaRequest;
  dramaShots?: (MediaJob | null)[];
  currentShotIndex?: number;
  dynamicDurationSeconds?: number;
}

export interface DramaShot {
  prompt: string;
  duration: number;
  continue_previous: boolean;
  start_image_result_id?: string;
  audio?: AudioRequest;
}

export interface DramaRequest {
  model: string;
  size: string;
  character_prompt: string;
  start_image_result_id?: string;
  shots: DramaShot[];
}

export interface DialogueLine {
  speaker: string;
  text: string;
  voice: string;
  instructions: string;
  pause_ms: number;
  speed: number;
}

export type AudioRequest = { text: string; voice: string; speed: number; instructions?: string }
  | { dialogues: DialogueLine[] };
export interface VoiceOption { id: string; name: string; }

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

