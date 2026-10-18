import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
const compiled = stripTypeScriptTypes(readFileSync(new URL("../src/drama.ts", import.meta.url), "utf8"));
const { continuationChain } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("regeneration invalidates only the consecutive tail-reference chain", () => {
  const shots = [false, true, true, false, true, false].map(continue_previous => ({ continue_previous }));
  assert.deepEqual(continuationChain(shots, 0), [0, 1, 2]);
  assert.deepEqual(continuationChain(shots, 1), [1, 2]);
  assert.deepEqual(continuationChain(shots, 3), [3, 4]);
  assert.deepEqual(continuationChain(shots, 5), [5]);
  assert.deepEqual(continuationChain(shots, -1), []);
  assert.deepEqual(continuationChain(shots, .5), []);
});
