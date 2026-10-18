import type { DialogueLine } from "./types";

export function newDialogue(speaker = "", text = "", voice = "demo"): DialogueLine {
  return { speaker, text, voice, instructions: "", speed: 1, pause_ms: 300 };
}

export function dialogueProblem(lines: DialogueLine[], voices: string[]): string {
  if (!lines.length) return "先导入剧本，或手动添加一句对白";
  if (lines.length > 30) return "对白最多 30 句";
  if (lines.reduce((sum, line) => sum + line.text.trim().length, 0) > 500) return "台词总长度不能超过 500 字";
  for (const [index, line] of lines.entries()) {
    if (!/[\p{L}\p{N}]/u.test(line.text.trim())) return `请填写第 ${index + 1} 句台词`;
    if (!voices.includes(line.voice)) return `请为第 ${index + 1} 句选择可用音色`;
    if (!Number.isFinite(line.speed) || line.speed < 0.5 || line.speed > 2) return `第 ${index + 1} 句语速须在 0.5–2 倍之间`;
    if (!Number.isInteger(line.pause_ms) || line.pause_ms < 0 || line.pause_ms > 5000) return `第 ${index + 1} 句停顿须为 0–5000 毫秒的整数`;
  }
  return "";
}

export function parseScript(source: string, bindings: Record<string, string> = {}): DialogueLine[] {
  const result: DialogueLine[] = [];
  for (const [index, raw] of source.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || /^角色对白(?:[（(].*?[）)])?\s*[:：]?$/.test(line)) continue;
    const match = /^([^:：]{1,20})[:：]\s*(.+)$/.exec(line);
    if (!match) throw new Error(`第 ${index + 1} 行无法识别，请使用“角色名：台词”格式；删除说明文字。`);
    const speaker = match[1].trim();
    const words = match[2].trim();
    const text = /^(“[\s\S]*”|"[\s\S]*")$/.test(words) ? words.slice(1, -1).trim() : words;
    if (!/[\p{L}\p{N}]/u.test(text)) throw new Error(`第 ${index + 1} 行没有有效台词`);
    result.push(newDialogue(speaker, text, Object.prototype.hasOwnProperty.call(bindings, speaker) ? bindings[speaker] : "demo"));
  }
  if (!result.length || result.length > 30) throw new Error("对白须包含 1–30 句");
  if (result.reduce((sum, line) => sum + line.text.length, 0) > 500) throw new Error("台词总长度不能超过 500 字");
  return result;
}
