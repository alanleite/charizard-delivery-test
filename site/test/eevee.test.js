const fs = require("fs"), path = require("path"), assert = require("assert"), vm = require("vm");
const root = path.join(__dirname, "..");
const h = fs.readFileSync(path.join(root, "index.html"), "utf8");
const sec = h.match(/<section id="eevee-ficha-rapida"[\s\S]*?<\/section>/)[0];
// AC1: section after existing ones, h2, paragraph, link
assert(h.indexOf('id="eevee-ficha-rapida"') > h.indexOf('id="charmander-ficha-rapida"'));
assert(/<section id="eevee-ficha-rapida"[^>]* hidden>/.test(sec));
assert.strictEqual((sec.match(/<h2[^>]*>Eevee<\/h2>/g) || []).length, 1);
assert.strictEqual((sec.match(/<p>|<p /g) || []).length, 2);
assert(sec.includes("Eevee é um Pokémon do tipo Normal conhecido por suas diferentes evoluções."));
const a = sec.match(/<a [^>]*>/g);
assert.strictEqual(a.length, 1);
assert(a[0].includes('href="https://www.pokemon.com/br/pokedex/eevee"'));
// AC3/5: literal class, compiled selector, no inline style
assert(/class="[^"]*\bunderline-offset-4\b/.test(a[0]));
assert(!/style=|\[/.test(sec));
const css = fs.readFileSync(path.join(root, "assets", "landing.css"), "utf8");
assert(/\.underline-offset-4\{text-underline-offset:4px\}/.test(css));
// AC4: build record
const b = fs.readFileSync(path.join(root, "assets", "landing-build.txt"), "utf8");
assert(b.includes("npx --yes tailwindcss@3.4.17") && b.includes("underline-offset-4") && b.includes("text-underline-offset:4px"));
// AC6: layout tokens
assert(/px-6 md:px-12 py-20 md:py-28/.test(sec) && /grid gap-8/.test(sec) && sec.includes("break-words") && /<p class="min-w-0"><a id="link-eevee"[^>]* class="block /.test(sec));
// behavior
const code = [...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n");
const IDS = ["blastoise-landing", "pagina-atual", "ficha-dragonite", "charmander-ficha-rapida", "eevee-ficha-rapida", "link-pokedex", "link-eevee"];
function run(cfg) {
  const els = {};
  for (const id of IDS) els[id] = { hidden: id !== "pagina-atual", l: [], addEventListener(t, f) { this.l.push(f); } };
  const docL = [];
  const doc = { getElementById: id => els[id], addEventListener(t, f) { docL.push(f); } };
  const win = { CHARIZARD_CONFIG: cfg };
  vm.runInNewContext(code, { window: win, document: doc });
  return { els, docL, m: win.charizardMetrics };
}
const ON = { environment: "staging", userId: "staging", exposure: 100, flags: {} };
let r = run(null);
assert.strictEqual(r.els["eevee-ficha-rapida"].hidden, true);
assert.strictEqual(JSON.stringify(r.m.eevee_page_views_total), JSON.stringify({ atual: 1 }));
assert(!r.m.eevee_link_clicks_total && !r.m.eevee_render_errors_total);
r = run({ flags: { "eevee-ficha-rapida": false }, exposure: 100, userId: "s" });
assert.strictEqual(r.els["eevee-ficha-rapida"].hidden, true);
assert.strictEqual(JSON.stringify(r.m.eevee_page_views_total), JSON.stringify({ atual: 1 }));
assert.strictEqual(r.els["link-eevee"].l.length, 0);
r = run(ON);
assert.strictEqual(r.els["eevee-ficha-rapida"].hidden, false);
assert.strictEqual(JSON.stringify(r.m.eevee_page_views_total), JSON.stringify({ nova: 1 }));
assert(!r.m.eevee_render_errors_total);
const legacyBefore = JSON.stringify(r.m.link_clicks_total);
for (let n = 1; n <= 2; n++) {
  // real click: the legacy document listener runs only if propagation continues
  let stopped = false;
  const ev = { target: { closest: () => ({}) }, stopPropagation() { stopped = true; } };
  r.els["link-eevee"].l.forEach(f => f(ev));
  if (!stopped) r.docL.forEach(f => f(ev));
  assert.strictEqual(r.m.eevee_link_clicks_total.nova, n);
}
assert.strictEqual(JSON.stringify(r.m.link_clicks_total), legacyBefore);
// explicit exposure 0 default is off
r = run({ userId: "s", exposure: 0 });
assert.strictEqual(r.els["eevee-ficha-rapida"].hidden, true);
assert.strictEqual(JSON.stringify(r.m.eevee_page_views_total), JSON.stringify({ atual: 1 }));
// real failure in the off path is counted with variant=atual
{
  const els = {};
  for (const id of IDS) els[id] = { hidden: id !== "pagina-atual", addEventListener() {} };
  const win = { CHARIZARD_CONFIG: { get flags() { throw new Error("boom"); }, exposure: 0, userId: "s" } };
  vm.runInNewContext(code, { window: win, document: { getElementById: id => els[id], addEventListener() {} } });
  assert.strictEqual(win.charizardMetrics.eevee_render_errors_total.atual, 1);
  assert.strictEqual(win.charizardMetrics.eevee_page_views_total.atual, 1);
}
// real render failure counted with the variant
{
  const els = {};
  const win = { CHARIZARD_CONFIG: { flags: { "eevee-ficha-rapida": true } } };
  vm.runInNewContext(code, { window: win, document: { getElementById: id => els[id], addEventListener() {} } });
  assert.strictEqual(win.charizardMetrics.eevee_render_errors_total.nova, 1);
  assert.strictEqual(win.charizardMetrics.eevee_page_views_total.nova, 1);
}
// fail-closed: malformed config stays off
for (const cfg of [
  { userId: "s", exposure: 101 }, { userId: "s", exposure: 500 }, { userId: "s", exposure: -1 },
  { exposure: 100 }, { userId: "", exposure: 100 }, "on", 7,
  { userId: "s", exposure: 100, flags: { "eevee-ficha-rapida": "false" } },
  { userId: "s", exposure: 100, flags: { "eevee-ficha-rapida": 1 } },
]) {
  const x = run(cfg);
  assert.strictEqual(x.els["eevee-ficha-rapida"].hidden, true, JSON.stringify(cfg));
  assert.strictEqual(JSON.stringify(x.m.eevee_page_views_total), JSON.stringify({ atual: 1 }));
  assert.strictEqual(x.els["link-eevee"].l.length, 0);
  assert(!x.m.eevee_link_clicks_total);
}
// legacy series untouched by the Eevee script
{
  const off = run({ userId: "s", exposure: 0 }), on = run(ON);
  // legacy series are identical whether Eevee is on or off, all else equal
  const f = v => run({ userId: "s", exposure: 100, flags: { "blastoise-landing": false, "ficha-dragonite": false, "charmander-ficha-rapida": false, "eevee-ficha-rapida": v } });
  for (const k of ["page_views_total", "page_render_errors_total", "link_clicks_total"])
    assert.strictEqual(JSON.stringify(f(true).m[k]), JSON.stringify(f(false).m[k]), k);
  assert(!Object.keys(on.m).some(k => k.startsWith("eevee_") && !/^eevee_(page_views|link_clicks|render_errors)_total$/.test(k)));
}
// focus ring and labelling
assert(/focus-visible:ring-2/.test(a[0]) && sec.includes('aria-labelledby="titulo-eevee"'));
// coexistence: each section follows its own flag in every combination
const keys = ["blastoise-landing", "ficha-dragonite", "charmander-ficha-rapida", "eevee-ficha-rapida"];
for (let mask = 0; mask < 16; mask++) {
  const flags = {};
  keys.forEach((k, i) => (flags[k] = !!(mask & (1 << i))));
  const x = run({ flags });
  keys.forEach(k => assert.strictEqual(x.els[k].hidden, !flags[k], k + " mask " + mask));
  assert.strictEqual(x.els["pagina-atual"].hidden, flags["blastoise-landing"]);
  const v = flags["eevee-ficha-rapida"] ? "nova" : "atual";
  assert.strictEqual(x.m.eevee_page_views_total[v], 1);
  assert.strictEqual(Object.keys(x.m.eevee_page_views_total).length, 1);
}
console.log("eevee ok");
