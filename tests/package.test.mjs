import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Phile is een frameworkloze statische website", () => {
  const html = read("index.html");
  assert.match(html, /runtime-config\.js/);
  assert.match(html, /bootstrap\.js/);
  assert.equal(existsSync(new URL("../node_modules", import.meta.url)), false);
  assert.doesNotMatch(html, /(?:src|href)=["'][^"']*(?:astro|react|vue)/i);
});

test("het centrale thema en canonieke brein komen via LeerpretEngine", () => {
  const html = read("index.html");
  assert.match(html, /\/ui\/leerpret-theme\.css/);
  assert.match(html, /lp-brand-brain/);
  assert.equal(existsSync(new URL("../leerpret-theme.css", import.meta.url)), false);
});

test("speldata en Leerobject-klassen komen uitsluitend via de Engine-API", () => {
  const bootstrap = read("bootstrap.js");
  const game = read("script.js");
  assert.match(bootstrap, /\/sdk\/sdk-loader\/loader\.js/);
  assert.match(bootstrap, /loader\.js\?bootstrap=\$\{Date\.now\(\)\}/);
  assert.match(bootstrap, /loader\.load\(\["api-client", "auth-client", "leerobject"\]\)/);
  assert.match(bootstrap, /completeGoogleLogin/);
  assert.match(bootstrap, /mountLogin/);
  assert.match(game, /\/leerbox-runtime\/\$\{LEARNING_BOX_ID\}/);
  assert.match(game, /SelfStartingLeerobject/);
  assert.match(game, /SuccesLeerobject/);
  assert.match(game, /WeerstandLeerobject/);
  assert.match(game, /OverigLeerobject/);
  assert.equal(existsSync(new URL("../philosophers.json", import.meta.url)), false);
});

test("elk verzonden record bevat de vier minimale Actievelden", () => {
  const game = read("script.js");
  for (const field of ["timestamp", "person_id", "leerobject_id", "leerbox_id"]) {
    assert.match(game, new RegExp(`${field}:`));
  }
  assert.doesNotMatch(game, /postMessage|window\.parent/);
});
