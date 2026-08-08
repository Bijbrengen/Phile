import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../runtime-config.js", import.meta.url), "utf8");

function configFor(hostname) {
  const context = { window: { location: { hostname } } };
  vm.runInNewContext(source, context);
  return context.window.PHILE_CONFIG;
}

test("Phile kiest per host de lokale of productie-API", () => {
  assert.equal(configFor("localhost").apiBase, "http://127.0.0.1:47111/api");
  assert.equal(configFor("bijbrengen.github.io").apiBase, "https://api.leerpretpark.nl/api");
  assert.equal(configFor("bijbrengen.github.io").clientId, "phile");
  assert.doesNotMatch(source, /trycloudflare/i);
});
