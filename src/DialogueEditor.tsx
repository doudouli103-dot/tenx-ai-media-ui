import { useState } from "react";
import type { DialogueLine, VoiceOption } from "./types";
import { newDialogue, parseScript } from "./dialogue";

export default function DialogueEditor({ lines, onChange, voices }: {
  lines: DialogueLine[]; onChange: (lines: DialogueLine[]) => void; voices: VoiceOption[];
}) {
  const [script, setScript] = useState("");
  const [importError, setImportError] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [candidate, setCandidate] = useState<DialogueLine[] | null>(null);
  const [undo, setUndo] = useState<DialogueLine[] | null>(null);
  const speakers = [...new Set(lines.map((line) => line.speaker.trim()).filter(Boolean))];
  function update(index: number, patch: Partial<DialogueLine>) {
    onChange(lines.map((line, position) => position === index ? { ...line, ...patch } : line));
  }
  function move(index: number, direction: number) {
    const next = [...lines];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    onChange(next);
  }
  function applyImport(next: DialogueLine[]) {
    setUndo(lines);
    onChange(next);
    setCandidate(null);
    setImportError("");
    setImportMessage(`已导入 ${next.length} 句对白、${new Set(next.map((line) => line.speaker)).size} 个角色。检查音色后即可试听。`);
  }
  return <div className="dialogue-editor">
    <details className="script-import" open={!lines.length || undefined}><summary>粘贴剧本，自动拆分角色对白</summary>
      <p className="audio-hint">每行填写“角色名：台词”。角色名只用于分组，不会被朗读。</p>
      <textarea aria-label="待导入剧本" value={script} onChange={(event) => { setScript(event.target.value); setCandidate(null); setImportError(""); }} maxLength={2500} rows={5} placeholder={'角色甲：这里填写第一句台词。\n角色乙：这里填写第二句台词。'} />
      <button type="button" disabled={!script.trim()} onClick={() => {
        try {
          const next = parseScript(script, Object.fromEntries(lines.map((line) => [line.speaker.trim(), line.voice])));
          setImportError("");
          if (lines.length) setCandidate(next); else applyImport(next);
        } catch (error) { setCandidate(null); setImportError(error instanceof Error ? error.message : "导入失败"); }
      }}>解析剧本</button><small>不会修改画面描述。已编辑的对白只有在确认后才会替换。</small>
      {importError && <p className="import-error" role="alert">{importError}</p>}
      {candidate && <div className="import-confirm"><p>将用 {candidate.length} 句新对白替换当前 {lines.length} 句，是否继续？</p><button type="button" onClick={() => applyImport(candidate)}>确认替换对白</button><button type="button" onClick={() => setCandidate(null)}>保留当前对白</button></div>}
    </details>
    {importMessage && lines.length > 0 && <p className="import-success" role="status">{importMessage}</p>}
    {lines.length === 0 && <div className="dialogue-empty"><strong>尚未添加对白</strong><p>可以从上方导入剧本，也可以从空白台词开始。角色名称由你填写。</p></div>}
    {speakers.length > 0 && <div className="role-bindings"><h3>角色与音色 <small>{speakers.length} 个角色 · {lines.length} 句对白</small></h3><p>在这里为同一角色的所有台词统一选择音色。</p><div className="form-grid">{speakers.map((speaker) => <label key={speaker}><span>{speaker}</span>
      <select aria-label={`${speaker}批量音色`} value={lines.find((line) => line.speaker.trim() === speaker)?.voice || "demo"} onChange={(event) => onChange(lines.map((line) => line.speaker.trim() === speaker ? { ...line, voice: event.target.value } : line))}>
        {voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.id} · {voice.name}</option>)}
      </select></label>)}</div></div>}
    {lines.map((line, index) => <section className="dialogue-line" key={index} aria-label={`第${index + 1}句对白`}>
      <div className="dialogue-heading"><strong>对白 {index + 1} · {line.speaker || "未命名角色"}</strong><div>
        <button type="button" aria-label={`上移第${index + 1}句`} title="上移" disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
        <button type="button" aria-label={`下移第${index + 1}句`} title="下移" disabled={index === lines.length - 1} onClick={() => move(index, 1)}>↓</button>
        <button type="button" aria-label={`删除第${index + 1}句`} onClick={() => { setUndo(lines); setImportMessage(""); onChange(lines.filter((_, position) => position !== index)); }}>删除</button>
      </div></div>
      <div className="form-grid">
        <label><span>角色名（不朗读）</span><input aria-label={`角色${index + 1}`} value={line.speaker} onChange={(event) => update(index, { speaker: event.target.value })} maxLength={20} placeholder="填写你的角色名，或留空作旁白" /></label>
        <label><span>音色</span><select aria-label={`音色${index + 1}`} value={line.voice} onChange={(event) => update(index, { voice: event.target.value })} required>
          {!voices.length && <option value="">等待音色列表</option>}{voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.id} · {voice.name}</option>)}
        </select></label>
      </div>
      <label className="prompt-field"><textarea aria-label={`台词${index + 1}`} value={line.text} onChange={(event) => update(index, { text: event.target.value })} rows={2} maxLength={500} required placeholder="只填台词，不填角色名或舞台说明" /></label>
      <details className="performance-options"><summary>表演设置 <span>{line.instructions ? "已设情绪" : "默认语气"} · {line.speed} 倍 · 停顿 {line.pause_ms} ms</span></summary><div className="form-grid">
        <label className="wide-field"><span>情绪 / 表演指令（不朗读）</span><input aria-label={`情绪${index + 1}`} value={line.instructions} onChange={(event) => update(index, { instructions: event.target.value })} maxLength={200} placeholder="轻声说，带着期待。" /></label>
        <label><span>语速</span><select value={line.speed} onChange={(event) => update(index, { speed: Number(event.target.value) })}><option value={0.8}>0.8 倍</option><option value={1}>1.0 倍</option><option value={1.2}>1.2 倍</option><option value={1.5}>1.5 倍</option></select></label>
        <label><span>句后停顿（毫秒）</span><input aria-label={`停顿${index + 1}`} type="number" min={0} max={5000} step={100} value={line.pause_ms} onChange={(event) => update(index, { pause_ms: Number(event.target.value) })} required /></label>
      </div></details>
    </section>)}
    <div className="dialogue-heading dialogue-toolbar"><button type="button" disabled={lines.length >= 30} onClick={() => { setImportMessage(""); onChange([...lines, newDialogue()]); }}>＋ 手动添加一句</button>
      <span className={lines.reduce((sum, line) => sum + line.text.length, 0) > 500 ? "over-limit" : ""}>{lines.length} / 30 句 · {lines.reduce((sum, line) => sum + line.text.length, 0)} / 500 字</span></div>
    {undo && <button type="button" className="undo-dialogue" onClick={() => { onChange(undo); setUndo(null); setCandidate(null); setImportMessage(""); }}>撤销上一次删除或替换</button>}
    <p className="audio-hint">这里只朗读台词。称呼对方的姓名属于台词内容，不会自动删掉；情绪指令请放入“表演设置”。</p>
  </div>;
}
