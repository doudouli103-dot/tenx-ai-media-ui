import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createDrama, loadProtectedMedia, retryDrama } from "./api";
import { dialogueProblem } from "./dialogue";
import DialogueEditor from "./DialogueEditor";
import { continuationChain } from "./drama";
import type { ApiConfig, DialogueLine, DramaShot, MediaJob, VoiceOption } from "./types";

interface DraftShot { id: string; prompt: string; duration: number; continue_previous: boolean; image: string; audio: boolean; lines: DialogueLine[]; }
const blankShot = (): DraftShot => ({ id: crypto.randomUUID(), prompt: "", duration: 5, continue_previous: false, image: "", audio: false, lines: [] });

export function DramaComposer({ config, voices, onSubmitted }: { config: ApiConfig; voices: VoiceOption[]; onSubmitted: (job: MediaJob) => void }) {
  const [shots, setShots] = useState<DraftShot[]>(() => Array.from({ length: 6 }, blankShot));
  const [characters, setCharacters] = useState("");
  const [reference, setReference] = useState("");
  const [size, setSize] = useState("640x352");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [removeId, setRemoveId] = useState("");
  const total = shots.reduce((sum, shot) => sum + shot.duration, 0);
  const voiceIds = voices.map(voice => voice.id);
  const problem = !config.apiKey ? "请先配置媒体服务连接" : shots.map((shot, index) =>
    !shot.prompt.trim() ? `请填写分镜 ${index + 1} 的画面` : shot.audio ? !voiceIds.length ? "请先加载可用音色" : dialogueProblem(shot.lines, voiceIds) ? `分镜 ${index + 1}：${dialogueProblem(shot.lines, voiceIds)}` : "" : ""
  ).find(Boolean) || "";
  function update(id: string, patch: Partial<DraftShot>) { setShots(current => current.map(shot => shot.id === id ? { ...shot, ...patch } : shot)); }
  function move(index: number, direction: number) {
    setShots(current => { const next = [...current]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; return next.map((shot, i) => i === 0 ? { ...shot, continue_previous: false } : shot); });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (problem || busy) return;
    setBusy(true); setError("");
    try {
      const plan: DramaShot[] = shots.map(shot => ({ prompt: shot.prompt.trim(), duration: shot.duration,
        continue_previous: shot.continue_previous, start_image_result_id: !shot.continue_previous ? shot.image.trim() || undefined : undefined,
        audio: shot.audio ? { dialogues: shot.lines } : undefined }));
      onSubmitted(await createDrama(config, { model: "Wan2.2-TI2V-5B", size, character_prompt: characters.trim(), start_image_result_id: reference.trim() || undefined, shots: plan }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "短剧提交失败"); }
    finally { setBusy(false); }
  }
  return <form className="composer card drama-composer" onSubmit={submit}>
    <div className="section-title"><h2>多分镜短剧</h2><span>{shots.length} 镜 · {total} 秒动态画面</span></div>
    <p className="section-help">每镜最多5秒，串行生成后拼接。连续动作选择“接上一镜尾帧”，切换机位可独立生成。尾帧续接不保证动作无缝或角色完全一致。</p>
    <fieldset disabled={busy}>
      <label className="drama-label">统一角色与画风<textarea aria-label="统一角色与画风" value={characters} onChange={event => setCharacters(event.target.value)} maxLength={1000} rows={3} placeholder="固定角色的装甲颜色、体型、武器和画风；将附加到每个分镜，不会朗读。" /></label>
      <div className="form-grid"><label><span>模型</span><input value="Wan2.2-TI2V-5B" readOnly /></label><label><span>分辨率</span><select value={size} onChange={event => setSize(event.target.value)}><option>640x352</option><option>832x480</option></select></label>
        <label className="wide-field"><span>统一角色参考图 ID（可选，仅用于独立镜头）</span><input value={reference} onChange={event => setReference(event.target.value)} pattern="tenx_[0-9a-f]{32}_[0-9]{5}_" placeholder="已有图片的 tenx_…_00001_" /></label></div>
      {shots.map((shot, index) => <section className="drama-shot" key={shot.id}>
        <div className="drama-shot-heading"><h3>分镜 {index + 1}</h3><div><button type="button" aria-label={`上移分镜${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" aria-label={`下移分镜${index + 1}`} disabled={index === shots.length - 1} onClick={() => move(index, 1)}>↓</button><button type="button" disabled={shots.length <= 2} onClick={() => setRemoveId(shot.id)}>删除</button></div></div>
        {removeId === shot.id && <div className="duration-notice">删除此分镜后，后面的续接镜头将接到新的前一镜头。<button type="button" onClick={() => { setShots(current => current.filter(item => item.id !== shot.id).map((item, i) => i === 0 ? { ...item, continue_previous: false } : item)); setRemoveId(""); }}>确认删除</button><button type="button" onClick={() => setRemoveId("")}>取消</button></div>}
        <label className="drama-label">画面与动作<textarea aria-label={`分镜${index + 1}画面`} value={shot.prompt} onChange={event => update(shot.id, { prompt: event.target.value })} maxLength={2000} rows={3} required placeholder="只写本镜头的动作：进攻、格挡、受击反馈和镜头运动。不要填对白。" /></label>
        <div className="form-grid"><label><span>动态时长</span><select aria-label={`分镜${index + 1}时长`} value={shot.duration} onChange={event => update(shot.id, { duration: Number(event.target.value) })}><option value={3}>3 秒</option><option value={5}>5 秒</option></select></label>
          <label><span>画面衔接</span><select aria-label={`分镜${index + 1}衔接`} value={shot.continue_previous ? "tail" : "independent"} onChange={event => update(shot.id, { continue_previous: event.target.value === "tail" })}><option value="independent">独立生成 / 切换机位</option>{index > 0 && <option value="tail">接上一镜尾帧</option>}</select></label>
          {!shot.continue_previous && <label className="wide-field"><span>本镜头参考图 ID（可选，覆盖统一参考图）</span><input value={shot.image} onChange={event => update(shot.id, { image: event.target.value })} pattern="tenx_[0-9a-f]{32}_[0-9]{5}_" /></label>}</div>
        <label className="audio-toggle"><input type="checkbox" checked={shot.audio} onChange={event => update(shot.id, { audio: event.target.checked })} />本镜头配音</label>
        {shot.audio && <details open><summary>角色对白（尽量一句短台词）</summary><DialogueEditor lines={shot.lines} voices={voices} onChange={lines => update(shot.id, { lines })} />
          <p className="duration-notice">对白含停顿不得超过 {shot.duration} 秒。超时将停止本镜头，不定格补时；可以在任务中修改对白后重试。当前可用 {voices.length} 个音色，角色名不参与朗读。</p></details>}
      </section>)}
      <button type="button" className="audio-action" disabled={shots.length >= 12} onClick={() => setShots(current => [...current, blankShot()])}>＋添加分镜（最多12镜 / 60秒）</button>
    </fieldset>
    {error && <p role="alert" className="job-error">{error}</p>}
    <div className="generate-section"><button className="primary-button" disabled={busy || !!problem}>{busy ? "正在提交…" : `生成 ${total} 秒短剧`}</button>{problem && <p className="audio-hint">{problem}</p>}</div>
    <p className="audio-hint">每镜将先生成配音并检查时长，再生成画面。失败可从断点继续；已完成镜头可单独重新生成，并更新依赖它的连续续接镜头。</p>
  </form>;
}

export function DramaProgress({ job, config, voices, onUpdated }: { job: MediaJob; config: ApiConfig; voices: VoiceOption[]; onUpdated: (job: MediaJob) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  useEffect(() => { setConfirm(null); setEditing(null); setError(""); }, [job.id]);
  const terminal = job.status === "COMPLETED" || job.status === "FAILED";
  async function retry(index?: number, shot?: DramaShot) {
    setBusy(true); setError("");
    try { onUpdated(await retryDrama(config, job.id, index, shot)); setConfirm(null); setEditing(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "重试失败"); }
    finally { setBusy(false); }
  }
  return <section className="drama-progress"><h3>分镜进度 · {job.status === "COMPLETED" ? "已生成" : "目标"} {job.dynamicDurationSeconds} 秒动态画面</h3>
    {job.dramaRequest?.shots.map((shot, index) => { const result = job.dramaShots?.[index]; return <div className="drama-shot" key={index}>
      <strong>分镜 {index + 1} · {shot.duration}秒 · {shot.continue_previous ? "尾帧续接" : "独立镜头"}</strong>
      <p className="audio-hint">{shot.prompt}</p><p className="audio-hint">{result?.status || "待生成"}{job.currentShotIndex === index && !terminal ? " · 当前镜头" : ""}{result?.audioDurationSeconds ? ` · 配音 ${result.audioDurationSeconds.toFixed(2)} 秒` : ""}</p>
      {result?.error && <p className="job-error">{result.error}</p>}
      {result?.status === "COMPLETED" && result.resultUrl && <ShotPreview config={config} source={result.resultUrl} />}
      {terminal && result?.status === "COMPLETED" && <button className="audio-action" type="button" disabled={busy} onClick={() => setConfirm(index)}>重新生成此镜头</button>}
      {terminal && <button className="audio-action" type="button" disabled={busy} onClick={() => { setEditing(index); setConfirm(null); }}>修改此镜头</button>}
      {confirm === index && <div className="duration-notice">将重新生成分镜 {continuationChain(job.dramaRequest?.shots || [], index).map(i => i + 1).join("、")}，然后重新拼接；独立镜头保留。<button type="button" disabled={busy} onClick={() => void retry(index)}>确认重生成</button><button type="button" disabled={busy} onClick={() => setConfirm(null)}>取消</button></div>}
      {terminal && editing === index && <ShotCorrection key={`${job.id}-${index}`} shot={shot} index={index} voices={voices} busy={busy} onCancel={() => setEditing(null)} onSave={replacement => void retry(index, replacement)} />}
    </div>; })}
    {job.status === "FAILED" && <button className="audio-action" disabled={busy} onClick={() => void retry()}>{busy ? "正在恢复…" : "从断点继续（保留已完成镜头）"}</button>}
    {error && <p className="job-error" role="alert">{error}</p>}
  </section>;
}

function ShotCorrection({ shot, index, voices, busy, onSave, onCancel }: { shot: DramaShot; index: number; voices: VoiceOption[]; busy: boolean; onSave: (shot: DramaShot) => void; onCancel: () => void }) {
  const [prompt, setPrompt] = useState(shot.prompt);
  const [duration, setDuration] = useState(shot.duration);
  const [continuation, setContinuation] = useState(shot.continue_previous);
  const [audio, setAudio] = useState(!!shot.audio);
  const [lines, setLines] = useState<DialogueLine[]>(() => shot.audio && "dialogues" in shot.audio ? shot.audio.dialogues : shot.audio && "text" in shot.audio ? [{ speaker: "", text: shot.audio.text, voice: shot.audio.voice, speed: shot.audio.speed, instructions: shot.audio.instructions || "", pause_ms: 0 }] : []);
  const issue = !prompt.trim() ? "请填写画面" : audio ? dialogueProblem(lines, voices.map(voice => voice.id)) : "";
  return <form onSubmit={event => { event.preventDefault(); onSave({ ...shot, prompt: prompt.trim(), duration, continue_previous: continuation, start_image_result_id: continuation ? undefined : shot.start_image_result_id, audio: audio ? { dialogues: lines } : undefined }); }}>
    <fieldset disabled={busy}><label className="drama-label">修改画面<textarea value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={2000} required /></label>
      <div className="form-grid"><label><span>时长</span><select value={duration} onChange={event => setDuration(Number(event.target.value))}><option value={3}>3秒</option><option value={5}>5秒</option></select></label><label><span>衔接</span><select value={continuation ? "tail" : "independent"} onChange={event => setContinuation(event.target.value === "tail")}><option value="independent">独立生成</option>{index > 0 && <option value="tail">接上一镜尾帧</option>}</select></label></div>
      <label className="audio-toggle"><input type="checkbox" checked={audio} onChange={event => setAudio(event.target.checked)} />启用本镜头配音</label>
      {audio && <DialogueEditor lines={lines} voices={voices} onChange={setLines} />}
      <p className="duration-notice">保存将重新生成此镜头和其连续尾帧依赖镜头，再拼接成片；独立镜头保留。对白含停顿必须在 {duration} 秒以内。</p>
      <button className="audio-action" disabled={!!issue} type="submit">保存并重新生成</button><button className="audio-action" type="button" onClick={onCancel}>取消</button>{issue && <p className="audio-hint">{issue}</p>}
    </fieldset>
  </form>;
}

function ShotPreview({ config, source }: { config: ApiConfig; source: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    let active = true, objectUrl = "";
    loadProtectedMedia(config, source).then(value => { objectUrl = value; if (active) setUrl(value); else URL.revokeObjectURL(value); }).catch(cause => { if (active) setError(String(cause)); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); setUrl(""); };
  }, [open, config, source]);
  return <details onToggle={event => setOpen(event.currentTarget.open)}><summary>预览单镜头</summary>{url ? <video className="shot-video" src={url} controls /> : open && <p className="audio-hint">{error || "加载镜头中…"}</p>}</details>;
}
