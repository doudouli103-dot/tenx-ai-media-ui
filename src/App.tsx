import {
  Activity,
  AlertCircle,
  Check,
  ChevronRight,
  CircleStop,
  Clock3,
  Download,
  Film,
  Image as ImageIcon,
  KeyRound,
  LoaderCircle,
  Play,
  RefreshCw,
  Server,
  Settings2,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createImages, createVideo, getHealth, getVoices, listVideoJobs, loadProtectedMedia, previewSpeech } from "./api";
import type { ApiConfig, AudioRequest, DialogueLine, HealthStatus, ImageResult, JobStatus, MediaJob, VoiceOption } from "./types";
import DialogueEditor from "./DialogueEditor";
import { dialogueProblem } from "./dialogue";
import { DramaComposer, DramaProgress } from "./DramaStudio";

const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: sessionStorage.getItem("tenx.media.baseUrl") || "/media-api",
  apiKey: sessionStorage.getItem("tenx.media.apiKey") || "",
};

const statusLabels: Record<JobStatus, string> = {
  QUEUED: "排队中",
  GENERATING_FRAMES: "生成帧",
  DOWNLOADING_FRAMES: "下载帧",
  GENERATING_AUDIO: "生成配音",
  ENCODING: "合成视频",
  COMPLETED: "已完成",
  FAILED: "失败",
};

function useProtectedUrl(config: ApiConfig, source?: string) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!source) return setUrl("");
    let active = true;
    let objectUrl = "";
    loadProtectedMedia(config, source)
      .then((value) => {
        objectUrl = value;
        if (active) setUrl(value);
      })
      .catch(() => active && setUrl(""));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [config, source]);
  return url;
}

function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`status status-${status.toLowerCase()}`}>
      {status === "COMPLETED" ? <Check size={12} /> : status === "FAILED" ? <X size={12} /> : <span className="status-dot" />}
      {statusLabels[status]}
    </span>
  );
}

function App() {
  const [mode, setMode] = useState<"image" | "video" | "drama">("video");
  const [config, setConfig] = useState<ApiConfig>(DEFAULT_CONFIG);
  const [showSettings, setShowSettings] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [jobs, setJobs] = useState<MediaJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<MediaJob | null>(null);
  const [images, setImages] = useState<ImageResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [prompt, setPrompt] = useState("");
  const [videoModel, setVideoModel] = useState("Wan2.2-TI2V-5B");
  const [imageModel, setImageModel] = useState("qwen-image");
  const [size, setSize] = useState("640x352");
  const [duration, setDuration] = useState(5);
  const [projectId, setProjectId] = useState("drama-001");
  const [sceneId, setSceneId] = useState("scene-001");
  const [shotId, setShotId] = useState("shot-001");
  const [startImageResultId, setStartImageResultId] = useState("");
  const [seed, setSeed] = useState("");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [audioText, setAudioText] = useState("");
  const [audioVoice, setAudioVoice] = useState("demo");
  const [audioSpeed, setAudioSpeed] = useState(1);
  const [audioInstructions, setAudioInstructions] = useState("");
  const [audioMode, setAudioMode] = useState<"single" | "dialogue">("dialogue");
  const [dialogues, setDialogues] = useState<DialogueLine[]>([]);
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([]);
  const [voiceError, setVoiceError] = useState("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [audioPreview, setAudioPreview] = useState("");
  const previewVersion = useRef(0);
  const selectedVideoUrl = useProtectedUrl(config, selectedJob?.status === "COMPLETED" ? selectedJob.resultUrl : undefined);
  const dialogueIssue = dialogueProblem(dialogues, voiceOptions.map((voice) => voice.id));
  const audioIssue = !config.apiKey ? "先配置媒体服务连接" : !voiceOptions.length ? "先加载可用音色" : audioMode === "dialogue" ? dialogueIssue : !audioText.trim() ? "请填写旁白台词" : "";
  const submissionIssue = !config.apiKey ? "先配置媒体服务连接" : !prompt.trim() ? "请先填写画面描述" : mode === "video" && audioEnabled ? audioIssue : "";

  const activeCount = useMemo(
    () => jobs.filter((job) => !["COMPLETED", "FAILED"].includes(job.status)).length,
    [jobs],
  );

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const [nextHealth, nextJobs] = await Promise.all([
        getHealth(config),
        config.apiKey ? listVideoJobs(config) : Promise.resolve([]),
      ]);
      setHealth(nextHealth);
      setJobs(nextJobs.filter(job => !job.parentId));
      setSelectedJob((current) => current ? nextJobs.find((job) => job.id === current.id) || current : current);
      if (!quiet) setError("");
    } catch (cause) {
      if (!quiet) setError(cause instanceof Error ? cause.message : "无法连接媒体服务");
      setHealth(null);
    } finally {
      if (!quiet) setRefreshing(false);
    }
  }, [config]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const refreshVoices = useCallback(async () => {
    if (!config.apiKey) { setVoiceOptions([]); return; }
    try { setVoiceOptions(await getVoices(config)); setVoiceError(""); }
    catch (cause) { setVoiceOptions([]); setVoiceError(cause instanceof Error ? cause.message : "无法获取音色列表"); }
  }, [config]);
  useEffect(() => { void refreshVoices(); }, [refreshVoices]);
  useEffect(() => {
    previewVersion.current += 1;
    setAudioPreview("");
  }, [audioMode, audioText, audioVoice, audioSpeed, audioInstructions, dialogues, config]);
  useEffect(() => () => { if (audioPreview) URL.revokeObjectURL(audioPreview); }, [audioPreview]);
  useEffect(() => () => { previewVersion.current += 1; }, []);

  function buildAudio(): AudioRequest {
    if (!voiceOptions.length) throw new Error("请先连接 CosyVoice 并加载可用音色");
    if (audioMode === "dialogue") {
      if (dialogueIssue) throw new Error(dialogueIssue);
      return { dialogues: dialogues.map((line) => ({ ...line, text: line.text.trim(), speaker: line.speaker.trim() })) };
    }
    if (!audioText.trim()) throw new Error("请填写配音台词");
    if (!voiceOptions.some((voice) => voice.id === audioVoice)) throw new Error("请选择已安装的音色");
    return { text: audioText.trim(), voice: audioVoice, speed: audioSpeed, instructions: audioInstructions.trim() };
  }

  async function previewAudio() {
    if (!config.apiKey) { setShowSettings(true); return; }
    setError("");
    setPreviewBusy(true);
    const version = previewVersion.current;
    try {
      const url = await previewSpeech(config, buildAudio());
      if (version === previewVersion.current) setAudioPreview(url);
      else URL.revokeObjectURL(url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "试听失败"); }
    finally { setPreviewBusy(false); }
  }

  useEffect(() => {
    if (!config.apiKey || activeCount === 0) return;
    const timer = window.setInterval(() => void refresh(true), 3000);
    return () => window.clearInterval(timer);
  }, [activeCount, config.apiKey, refresh]);

  function saveConfig(next: ApiConfig) {
    const normalized = { ...next, baseUrl: next.baseUrl.trim().replace(/\/$/, "") || "/media-api" };
    sessionStorage.setItem("tenx.media.baseUrl", normalized.baseUrl);
    sessionStorage.setItem("tenx.media.apiKey", normalized.apiKey);
    setConfig(normalized);
    setShowSettings(false);
    setNotice("连接设置已保存到当前浏览器会话");
    window.setTimeout(() => setNotice(""), 2400);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!config.apiKey) {
      setShowSettings(true);
      setError("请先填写 Media Service API Key");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (mode === "video") {
        const job = await createVideo(config, {
          model: videoModel,
          prompt: prompt.trim(),
          duration,
          size,
          project_id: projectId.trim() || undefined,
          scene_id: sceneId.trim() || undefined,
          shot_id: shotId.trim() || undefined,
          start_image_result_id: videoModel === "Wan2.2-TI2V-5B" ? startImageResultId.trim() || undefined : undefined,
          seed: seed.trim() ? Number(seed) : undefined,
          steps: 14,
          audio: audioEnabled ? buildAudio() : undefined,
        });
        setJobs((current) => [job, ...current]);
        setSelectedJob(job);
        setNotice("视频任务已提交，Mac Studio 正在生成帧");
      } else {
        const result = await createImages(config, { model: imageModel, prompt: prompt.trim(), size, n: 1 });
        setImages(result.data);
        setNotice("图片生成完成");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "提交失败");
    } finally {
      setBusy(false);
      window.setTimeout(() => setNotice(""), 3000);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Sparkles size={21} /></div>
          <div><strong>TENX</strong><span>MEDIA STUDIO</span></div>
        </div>
        <nav>
          <button className={mode === "video" ? "active" : ""} onClick={() => setMode("video")}><Film size={19} />视频生成</button>
          <button className={mode === "drama" ? "active" : ""} onClick={() => setMode("drama")}><Film size={19} />多分镜短剧</button>
          <button className={mode === "image" ? "active" : ""} onClick={() => setMode("image")}><ImageIcon size={19} />图片生成</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="machine-card">
            <span className="eyebrow">COMPUTE ROUTE</span>
            <div><span className="machine-dot mac" />Mac Studio <small>生成帧</small></div>
            <div><span className="machine-dot win" />Windows <small>CosyVoice / FFmpeg</small></div>
          </div>
          <button className="settings-button" onClick={() => setShowSettings(true)}><Settings2 size={18} />连接设置</button>
        </div>
      </aside>

      <main>
        <header>
          <div><span className="eyebrow">CREATIVE OPERATIONS</span><h1>{mode === "drama" ? "多分镜短剧工作台" : mode === "video" ? "视频生成工作台" : "图片生成工作台"}</h1></div>
          <div className="header-actions">
            <div className={`service-pill ${health ? "online" : "offline"}`}><Activity size={15} />{health ? "服务在线" : "连接异常"}</div>
            <button className="icon-button" onClick={() => void refresh()} aria-label="刷新"><RefreshCw className={refreshing ? "spin" : ""} size={18} /></button>
          </div>
        </header>

        {!config.apiKey && <div className="connection-notice"><span>先连接媒体服务，即可加载音色、试听和生成。画面与剧本可先填写。</span><button type="button" onClick={() => setShowSettings(true)}>配置连接</button></div>}
        {mode === "video" && <ol className="creation-steps" aria-label="视频创作流程"><li><span>1</span>描述画面</li><li><span>2</span>导入剧本 / 编辑对白</li><li><span>3</span>试听后生成</li></ol>}

        {(error || notice) && <div className={`toast ${error ? "error" : "success"}`}>{error ? <AlertCircle size={17} /> : <Check size={17} />}{error || notice}<button onClick={() => { setError(""); setNotice(""); }}><X size={15} /></button></div>}

        <section className="workspace-grid">
          <div hidden={mode !== "drama"}><DramaComposer config={config} voices={voiceOptions} onSubmitted={job => { setJobs(current => [job, ...current]); setSelectedJob(job); setNotice("短剧任务已提交，将逐镜头生成并拼接"); }} /></div>
          {mode !== "drama" && <form className="composer card" onSubmit={submit}>
            <div className="section-title"><div><span className="step">01</span><h2>描述你的画面</h2></div><WandSparkles size={21} /></div>
            <p className="section-help">这里只描述人物外观、场景和镜头，不填角色对白。</p>
            <label className="prompt-field">
              <textarea aria-label="画面描述" value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} maxLength={2000} required placeholder="例如：暴雨中的未来城市，两台机甲隔着废墟对峙，蓝紫色光线映照金属装甲。镜头由低机位缓慢推进，无字幕。" />
              <span>{prompt.length} / 2000</span>
            </label>
            <div className="form-grid">
              <label><span>模型</span><select value={mode === "video" ? videoModel : imageModel} onChange={(event) => mode === "video" ? setVideoModel(event.target.value) : setImageModel(event.target.value)}>
                {mode === "video" ? <><option>Wan2.2-TI2V-5B</option><option>HunyuanVideo-1.5</option></> : <><option>qwen-image</option><option>flux-dev</option></>}
              </select></label>
              <label><span>分辨率</span><select value={size} onChange={(event) => setSize(event.target.value)}><option>640x352</option><option>832x480</option><option>1024x576</option><option>1024x1024</option></select></label>
              {mode === "video" && <label><span>动态画面时长</span><select value={duration} onChange={(event) => setDuration(Number(event.target.value))}><option value={3}>3 秒</option><option value={5}>5 秒</option></select></label>}
              {mode === "video" && <details className="wide-field advanced-options"><summary>镜头关联与复现参数（可选）</summary><div className="form-grid">
                <label><span>短剧项目 ID</span><input value={projectId} onChange={(event) => setProjectId(event.target.value)} maxLength={64} pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,63}" /></label>
                <label><span>场景 ID</span><input value={sceneId} onChange={(event) => setSceneId(event.target.value)} maxLength={64} pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,63}" /></label>
                <label><span>镜头 ID</span><input value={shotId} onChange={(event) => setShotId(event.target.value)} maxLength={64} pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,63}" /></label>
                <label><span>固定 Seed（可选）</span><input value={seed} onChange={(event) => setSeed(event.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="留空则随机" /></label>
              {videoModel === "Wan2.2-TI2V-5B" && <>
                <label className="wide-field"><span>首帧图片结果 ID（可选）</span><input value={startImageResultId} onChange={(event) => setStartImageResultId(event.target.value)} placeholder="tenx_..._00001_" /></label>
              </>}
              </div></details>}
            </div>
            {mode === "video" && <section className="audio-options">
              <div className="audio-section-title"><h2><span className="step">02</span> 角色对白与配音</h2><label className="audio-toggle"><input type="checkbox" checked={audioEnabled} onChange={(event) => setAudioEnabled(event.target.checked)} />启用配音</label></div>
              {!audioEnabled && <p className="audio-hint">当前将生成无声视频；开启配音后可导入角色对白或填写旁白。</p>}
              {audioEnabled && <>
                <div className="form-grid"><label><span>配音模式</span><select value={audioMode} onChange={(event) => setAudioMode(event.target.value as "single" | "dialogue")}><option value="dialogue">多角色逐句对白</option><option value="single">单段旁白</option></select></label>
                  <button className="audio-action" type="button" onClick={() => void refreshVoices()}>刷新可用音色</button></div>
                {voiceError && <p className="job-error">{voiceError}</p>}
                {voiceOptions.length === 1 && <div className="voice-notice"><strong>当前只有一个音色：{voiceOptions[0].id}</strong><span>不同角色仍会使用同一声音。新增角色音色需要授权参考录音，不是填写姓名即可变声。</span></div>}
                {audioMode === "dialogue" ? <DialogueEditor lines={dialogues} onChange={setDialogues} voices={voiceOptions} /> : <>
                <label className="prompt-field"><textarea aria-label="配音文本" value={audioText} onChange={(event) => setAudioText(event.target.value)} rows={3} maxLength={500} required placeholder="输入角色台词或旁白（与画面描述分开填写）" /><span>{audioText.length} / 500</span></label>
                <div className="form-grid">
                  <label><span>音色</span><select value={audioVoice} onChange={(event) => setAudioVoice(event.target.value)} required>{!voiceOptions.length && <option value="">等待音色列表</option>}{voiceOptions.map((voice) => <option key={voice.id} value={voice.id}>{voice.id} · {voice.name}</option>)}</select></label>
                  <label><span>语速</span><select value={audioSpeed} onChange={(event) => setAudioSpeed(Number(event.target.value))}><option value={0.8}>0.8 倍</option><option value={1}>1.0 倍</option><option value={1.2}>1.2 倍</option><option value={1.5}>1.5 倍</option></select></label>
                  <label className="wide-field"><span>情绪指令（不朗读）</span><input value={audioInstructions} onChange={(event) => setAudioInstructions(event.target.value)} maxLength={200} placeholder="轻声说，带着期待。" /></label>
                </div>
                <p className="audio-hint">单段旁白只填台词；带角色名的剧本请切换“多角色”后导入。</p></>}
                <div className="audition-section"><strong>先试听，再生成</strong><p>试听只生成声音，不消耗画面生成任务。</p>
                <button type="button" className="audio-action" title={audioIssue || undefined} disabled={previewBusy || busy || !!audioIssue} onClick={() => void previewAudio()}>{previewBusy ? "配音试听生成中…（CPU 兜底可能较慢）" : "试听配音（不生成画面）"}</button>
                {!previewBusy && audioIssue && <p className="audio-hint" role="status">{audioIssue}</p>}
                {audioPreview && <audio className="speech-preview" src={audioPreview} controls />}
                </div>
                <p className="duration-notice">画面仅生成所选的 {duration} 秒。对白更长时会延长最后一帧，不会自动生成等长动作，也不包含口型同步。</p>
              </>}
            </section>}
            <div className="generate-section"><button className="primary-button" title={submissionIssue || undefined} disabled={busy || previewBusy || !!submissionIssue}>{busy ? <LoaderCircle className="spin" size={19} /> : <Sparkles size={19} />}{busy ? "正在提交…" : mode === "video" ? audioEnabled ? "生成有声视频" : "生成无声视频" : "开始生成图片"}<ChevronRight size={18} /></button>
            {submissionIssue && <p className="audio-hint" role="status">{submissionIssue}</p>}</div>
            <p className="flow-note"><Server size={14} />{mode === "video" ? "Mac Studio 生成画面，Windows 使用 CosyVoice 配音并合成 MP4" : "生成结果由 Windows Media Service 保存到外接硬盘"}</p>
          </form>}

          <section className="preview card">
            <div className="section-title"><div><span className="step">03</span><h2>结果预览</h2></div>{selectedJob && <StatusBadge status={selectedJob.status} />}</div>
            {mode !== "image" ? (
              selectedJob ? <div className="result-view">
                <div className="media-stage">
                  {selectedVideoUrl ? <video src={selectedVideoUrl} controls loop /> : <div className="generation-state">{selectedJob.status === "FAILED" ? <CircleStop size={36} /> : <><div className="orbit"><Play size={26} /></div><span>{statusLabels[selectedJob.status]}</span><small>{selectedJob.status === "GENERATING_FRAMES" ? "模型正在输出连续画面" : selectedJob.status === "DOWNLOADING_FRAMES" ? "Windows 正在通过鉴权 HTTP 下载帧" : selectedJob.status === "GENERATING_AUDIO" ? "CosyVoice 正在生成台词配音" : selectedJob.status === "ENCODING" ? "Windows 正在合成画面与音轨" : "等待计算资源"}</small></>}</div>}
                </div>
                <div className="result-meta"><div><span>任务 ID</span><code>{selectedJob.id.slice(0, 12)}…</code></div><div><span>镜头</span><strong>{selectedJob.shotId || shotId}</strong></div><div><span>规格</span><strong>{selectedJob.frameCount ? `${selectedJob.frameCount} 帧 · ${selectedJob.fps} FPS` : size}</strong></div>{selectedVideoUrl && <a href={selectedVideoUrl} download={`${selectedJob.projectId || "video"}-${selectedJob.shotId || selectedJob.id}.mp4`}><Download size={16} />下载 MP4</a>}</div>
                {selectedJob.error && <p className="job-error"><AlertCircle size={15} />{selectedJob.error}</p>}
                {selectedJob.type === "drama" && <DramaProgress job={selectedJob} config={config} voices={voiceOptions} onUpdated={job => { setSelectedJob(job); setJobs(current => current.map(item => item.id === job.id ? job : item)); }} />}
                {selectedJob.audioEnabled && <p className="audio-hint">CosyVoice · {selectedJob.audioVoice}{selectedJob.audioDurationSeconds ? ` · ${selectedJob.audioDurationSeconds.toFixed(2)} 秒配音` : ""}{selectedJob.audioText ? `：${selectedJob.audioText}` : ""}</p>}
                {!!selectedJob.audioDialogues?.length && <div className="audio-hint">{selectedJob.audioDialogues.map((line, index) => <p key={index}>{line.speaker || "旁白"}（{line.voice}）：{line.text}</p>)}</div>}
              </div> : <EmptyPreview type="video" />
            ) : images.length ? <div className="image-grid">{images.map((image) => <ProtectedImage key={image.result_id} config={config} image={image} onUseAsStart={() => { setStartImageResultId(image.result_id); setVideoModel("Wan2.2-TI2V-5B"); setMode("video"); setNotice("已将图片设为短剧镜头首帧"); }} />)}</div> : <EmptyPreview type="image" />}
          </section>
        </section>

        <section className="jobs-section">
          <div className="jobs-heading"><div><span className="eyebrow">RECENT ACTIVITY</span><h2>视频任务</h2></div><span>{jobs.length} 个任务</span></div>
          <div className="jobs-table card">
            {jobs.length === 0 ? <div className="empty-jobs"><Clock3 size={22} />暂无视频任务</div> : jobs.map((job) => <button key={job.id} className={selectedJob?.id === job.id ? "selected" : ""} onClick={() => { setMode(job.type === "drama" ? "drama" : "video"); setSelectedJob(job); }}>
              <span className="job-icon"><Film size={17} /></span><span className="job-main"><strong>{job.type === "drama" ? "多分镜短剧 · " : ""}{job.model}</strong><small>{new Date(job.createdAt).toLocaleString("zh-CN")}</small></span><span className="job-spec">{job.type === "drama" ? `${job.dynamicDurationSeconds} 秒` : job.frameCount ? `${job.frameCount} 帧` : "准备中"}</span><StatusBadge status={job.status} /><ChevronRight size={17} />
            </button>)}
          </div>
        </section>
      </main>

      {showSettings && <SettingsModal config={config} onSave={saveConfig} onClose={() => setShowSettings(false)} />}
    </div>
  );
}

function EmptyPreview({ type }: { type: "video" | "image" }) {
  return <div className="empty-preview">{type === "video" ? <Film size={42} /> : <ImageIcon size={42} />}<h3>准备创造新内容</h3><p>填写左侧参数并提交，生成结果将在这里展示。</p></div>;
}

function ProtectedImage({ config, image, onUseAsStart }: { config: ApiConfig; image: ImageResult; onUseAsStart: () => void }) {
  const url = useProtectedUrl(config, image.url);
  return <div className="image-result">{url ? <img src={url} alt="AI 生成结果" /> : <LoaderCircle className="spin" />} {url && <><button type="button" onClick={onUseAsStart}><Film size={15} />设为首帧</button><a href={url} download={`${image.result_id}.png`}><Download size={16} />下载</a></>}</div>;
}

function SettingsModal({ config, onSave, onClose }: { config: ApiConfig; onSave: (value: ApiConfig) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(config);
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="settings-modal" onSubmit={(event) => { event.preventDefault(); onSave(draft); }}><div className="modal-header"><div><span className="eyebrow">CONNECTION</span><h2>媒体服务设置</h2></div><button type="button" onClick={onClose}><X /></button></div><label><span><Server size={15} />服务地址</span><input value={draft.baseUrl} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} placeholder="/media-api" required /></label><label><span><KeyRound size={15} />API Key</span><input type="password" value={draft.apiKey} onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })} placeholder="TENX_MEDIA_API_KEYS 中的一项" required /></label><p>凭据只保存在当前浏览器会话，关闭浏览器后自动清除。生产环境建议使用同源反向代理。</p><button className="primary-button" type="submit"><Check size={18} />保存并连接</button></form></div>;
}

export default App;

