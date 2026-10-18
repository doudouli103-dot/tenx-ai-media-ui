import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
const compiled = stripTypeScriptTypes(readFileSync(new URL("../src/dialogue.ts", import.meta.url), "utf8"));
const { parseScript, newDialogue, dialogueProblem } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("manual dialogue starts without a hardcoded character", () => {
  assert.equal(newDialogue().speaker, "");
  assert.equal(newDialogue().text, "");
  assert.match(dialogueProblem([], ["demo"]), /先导入剧本/);
  assert.match(dialogueProblem([newDialogue()], ["demo"]), /第 1 句/);
});
test("preview readiness validates text, voice, speed and pause", () => {
  const line = newDialogue("守护者", "准备出发。", "demo");
  assert.equal(dialogueProblem([line], ["demo"]), "");
  assert.match(dialogueProblem([{ ...line, voice: "missing" }], ["demo"]), /音色/);
  assert.match(dialogueProblem([{ ...line, speed: NaN }], ["demo"]), /语速/);
  assert.match(dialogueProblem([{ ...line, pause_ms: 0.5 }], ["demo"]), /停顿/);
  assert.match(dialogueProblem([{ ...line, text: "字".repeat(501) }], ["demo"]), /500/);
});
test("role binding does not inherit JavaScript object prototype properties", () => {
  assert.equal(parseScript("constructor：你好。")[0].voice, "demo");
});

test("imports script without speaking headings or speaker labels", () => {
  const lines = parseScript('角色对白（约 20 秒，实际时长取决于语速）：\n小雨：“地图说，最后一颗星就在这里。”\n阿零：“可这里……只有我们。”');
  assert.equal(lines.length, 2);
  assert.equal(lines[0].speaker, "小雨");
  assert.equal(lines[0].text, "地图说，最后一颗星就在这里。");
  assert.equal(lines[1].text, "可这里……只有我们。");
});
test("preserves spoken names and applies role bindings", () => {
  const [line] = parseScript("小雨：阿零，你胸口为什么在发光？", { 小雨: "xiaoyu" });
  assert.equal(line.voice, "xiaoyu");
  assert.ok(line.text.startsWith("阿零，"));
});
test("rejects unparsed instructions instead of silently speaking them", () => {
  assert.throws(() => parseScript("小雨：你好\n镜头缓慢推进。"), /第 2 行/);
});
test("enforces line and character limits", () => {
  assert.throws(() => parseScript(""));
  assert.throws(() => parseScript(Array(31).fill("小雨：你好").join("\n")));
  assert.throws(() => parseScript("小雨：" + "你".repeat(501)));
});
