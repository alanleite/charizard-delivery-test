const fs = require("fs"), path = require("path"), assert = require("assert"), vm = require("vm");
const root = path.join(__dirname, "..");
const h = fs.readFileSync(path.join(root, "index.html"), "utf8");
const sec = h.match(/<section id="jigglypuff-ficha-rapida"[\s\S]*?<\/section>/)[0];
// AC1
assert(/<section id="jigglypuff-ficha-rapida"[^>]* hidden>/.test(sec));
assert.strictEqual((sec.match(/<h2[^>]*>Jigglypuff<\/h2>/g) || []).length, 1);
assert(sec.includes("Tipo: Normal/Fada") && sec.includes("Seu canto suave embala quem está por perto."));
const a = sec.match(/<a [^>]*>/g);
assert.strictEqual(a.length, 1);
assert(a[0].includes('href="https://www.pokemon.com/br/pokedex/jigglypuff"'));
assert(sec.includes(">Ver Jigglypuff no Pokédex</a>"));
assert(h.indexOf('id="jigglypuff-ficha-rapida"') > h.indexOf('id="snorlax-ficha-rapida"'));
// layout, tokens, no inline style, no images
assert(/px-6 md:px-12/.test(sec) && /max-w-content/.test(sec) && /max-w-reading/.test(sec) && /min-h-control/.test(sec));
assert(/focus-visible:ring-2/.test(a[0]) && !/tabindex/.test(a[0]));
assert(!/style=|<img|<svg|<form|<input|fetch|XMLHttp/.test(sec));
const css = fs.readFileSync(path.join(root, "assets", "landing.css"), "utf8");
for (const c of ["min-h-control{min-height:2.75rem}", "max-w-reading{max-width:42rem}", "focus-visible\\:ring-2:focus-visible"]) assert(css.includes(c), c);
// behavior
const code = [...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n");
assert(code.includes('"jigglypuff-ficha-rapida"'));
const IDS = ["blastoise-landing", "pagina-atual", "ficha-dragonite", "charmander-ficha-rapida", "eevee-ficha-rapida", "snorlax-ficha-rapida", "jigglypuff-ficha-rapida", "link-pokedex", "link-eevee", "link-snorlax", "link-jigglypuff"];
function run(cfg) {
  const els = {};
  for (const id of IDS) els[id] = { hidden: id !== "pagina-atual", l: [], addEventListener(t, f) { this.l.push(f); } };
  const docL = [];
  const win = { CHARIZARD_CONFIG: cfg };
  vm.runInNewContext(code, { window: win, document: { getElementById: id => els[id], addEventListener(t, f) { docL.push(f); } } });
  return { els, docL, m: win.charizardMetrics };
}
const J = JSON.stringify;
let r = run(null);
assert.strictEqual(r.els["jigglypuff-ficha-rapida"].hidden, true);
assert.strictEqual(J(r.m.jigglypuff_page_views_total), J({ atual: 1 }));
assert(!r.m.jigglypuff_link_clicks_total);
assert.strictEqual(J(r.m.jigglypuff_render_errors_total), J({ atual: 0 }));
assert.strictEqual(r.els["link-jigglypuff"].l.length, 0);
r = run({ flags: { "jigglypuff-ficha-rapida": false }, exposure: 100, userId: "s" });
assert.strictEqual(r.els["jigglypuff-ficha-rapida"].hidden, true);
assert.strictEqual(J(r.m.jigglypuff_page_views_total), J({ atual: 1 }));
r = run({ environment: "staging", userId: "staging", exposure: 100, flags: {} });
assert.strictEqual(r.els["jigglypuff-ficha-rapida"].hidden, false);
assert.strictEqual(J(r.m.jigglypuff_page_views_total), J({ nova: 1 }));
assert.strictEqual(J(r.m.jigglypuff_render_errors_total), J({ nova: 0 }));
const legacy = J(r.m.link_clicks_total);
for (let n = 1; n <= 2; n++) {
  let stopped = false;
  const ev = { target: { closest: () => ({}) }, stopPropagation() { stopped = true; } };
  r.els["link-jigglypuff"].l.forEach(f => f(ev));
  if (!stopped) r.docL.forEach(f => f(ev));
  assert.strictEqual(r.m.jigglypuff_link_clicks_total.nova, n);
}
assert.strictEqual(J(r.m.link_clicks_total), legacy);
// render failure counted with variant, rest continues
{
  const els = {};
  const win = { CHARIZARD_CONFIG: { flags: { "jigglypuff-ficha-rapida": true } } };
  vm.runInNewContext(code, { window: win, document: { getElementById: id => els[id], addEventListener() {} } });
  assert.strictEqual(win.charizardMetrics.jigglypuff_render_errors_total.nova, 1);
  assert.strictEqual(win.charizardMetrics.jigglypuff_page_views_total.nova, 1);
}
// render failure in the atual path
{
  const els = {};
  const cfg = { get flags() { throw new Error("x"); } };
  const win = { CHARIZARD_CONFIG: cfg };
  vm.runInNewContext(code, { window: win, document: { getElementById: id => els[id], addEventListener() {} } });
  assert.strictEqual(J(win.charizardMetrics.jigglypuff_render_errors_total), J({ atual: 1 }));
}
// fail closed and precedence
for (const c of [{ exposure: 101, userId: "s" }, { exposure: 500, userId: "s" }, { exposure: -1, userId: "s" }, { exposure: 100 }, { exposure: 100, userId: "" }, "x", 5,
  { flags: { "jigglypuff-ficha-rapida": "false" }, exposure: 100, userId: "s" }, { flags: { "jigglypuff-ficha-rapida": 1 }, exposure: 100, userId: "s" }, { flags: { "jigglypuff-ficha-rapida": false }, exposure: 100, userId: "s" }])
  assert.strictEqual(run(c).els["jigglypuff-ficha-rapida"].hidden, true, J(c));
assert.strictEqual(run({ flags: { "jigglypuff-ficha-rapida": true }, exposure: 0, userId: "s" }).els["jigglypuff-ficha-rapida"].hidden, false);
assert.strictEqual(run({ flags: "x", exposure: 100, userId: "s" }).els["jigglypuff-ficha-rapida"].hidden, false);
// legacy counters identical with jigglypuff on/off; legacy click listener is bubble-phase
{
  const L = f => { const x = run({ flags: { "jigglypuff-ficha-rapida": f, "eevee-ficha-rapida": true } }).m; return J([x.page_views_total, x.page_render_errors_total, x.link_clicks_total]); };
  assert.strictEqual(L(true), L(false));
  assert(/document\.addEventListener\("click", function \(ev\) \{\s*var t = ev\.target;[\s\S]*?\}\);/.test(h) && !/document\.addEventListener\("click"[\s\S]{0,300}?\},\s*true\)/.test(h));
}
// focus ring tokens and rounded link
assert(/rounded-control/.test(a[0]) && /focus-visible:ring-focus/.test(a[0]) && /ring-offset-2/.test(a[0]) && /ring-offset-paper/.test(a[0]) && sec.includes('aria-labelledby="titulo-jigglypuff"'));
// legacy series not renamed
assert(h.includes("page_views_total: {}") && h.includes("link_clicks_total: {}"));
// series shape: one label per series; clicks only nova
{
  const x = run({ flags: { "jigglypuff-ficha-rapida": true } });
  assert.deepStrictEqual(Object.keys(x.m.jigglypuff_page_views_total), ["nova"]);
  assert.deepStrictEqual(Object.keys(x.m.jigglypuff_render_errors_total), ["nova"]);
  x.els["link-jigglypuff"].l.forEach(f => f({ stopPropagation() {} }));
  assert.deepStrictEqual(Object.keys(x.m.jigglypuff_link_clicks_total), ["nova"]);
  const y = run(null);
  assert.deepStrictEqual(Object.keys(y.m.jigglypuff_page_views_total), ["atual"]);
  assert.deepStrictEqual(Object.keys(y.m.jigglypuff_render_errors_total), ["atual"]);
}
// stopPropagation is scoped to the Jigglypuff link: other links still reach the legacy listener
{
  const x = run({ flags: { "jigglypuff-ficha-rapida": true } });
  assert.strictEqual(x.els["link-pokedex"].l.length, 0);
  const before = (x.m.link_clicks_total && Object.values(x.m.link_clicks_total).reduce((s, n) => s + n, 0)) || 0;
  x.docL.forEach(f => f({ target: { closest: () => ({}) }, stopPropagation() {} }));
  const after = (x.m.link_clicks_total && Object.values(x.m.link_clicks_total).reduce((s, n) => s + n, 0)) || 0;
  assert.strictEqual(after, before + 1);
}
// wider negative-content guard
assert(!/<picture|<iframe|<object|sendBeacon/.test(sec));
// atomic render: section present but link missing -> stays hidden, error counted, view still counted
{
  const els = { "jigglypuff-ficha-rapida": { hidden: true } };
  const win = { CHARIZARD_CONFIG: { flags: { "jigglypuff-ficha-rapida": true } } };
  vm.runInNewContext(code, { window: win, document: { getElementById: id => els[id], addEventListener() {} } });
  assert.strictEqual(els["jigglypuff-ficha-rapida"].hidden, true);
  assert.strictEqual(win.charizardMetrics.jigglypuff_render_errors_total.nova, 1);
  assert.strictEqual(win.charizardMetrics.jigglypuff_page_views_total.nova, 1);
}
// exact layout token values in the existing CSS
for (const c of [".px-6{padding-left:1.5rem;padding-right:1.5rem}", ".py-20{padding-top:5rem;padding-bottom:5rem}", ".gap-8{gap:2rem}", ".max-w-content{max-width:72rem}", ".max-w-reading{max-width:42rem}", ".min-h-control{min-height:2.75rem}"]) assert(css.includes(c), c);
assert(/\.text-section\{[^}]*font-size:2\.25rem/.test(css), "text-section");
assert(/\.md\\:px-12[^}]*3rem/.test(css) && /\.md\\:py-28[^}]*7rem/.test(css));
// one H2 total, content order
assert.strictEqual((sec.match(/<h2/g) || []).length, 1);
{
  const idx = ["<h2", "Tipo: Normal/Fada", "Seu canto suave", 'id="link-jigglypuff"'].map(s => sec.indexOf(s));
  assert(idx.every((n, i) => n >= 0 && (i === 0 || n > idx[i - 1])), J(idx));
}
assert(sec.includes('id="titulo-jigglypuff"'));
// no backend calls in page scripts, no lab operational words in visible text
assert(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/.test(code));
assert(!/\b(pause|resume|revisor|rodada|tentativa)\b/i.test(sec.replace(/<[^>]*>/g, " ")));
// explicit-false and more fail-closed cases
r = run({ flags: { "jigglypuff-ficha-rapida": false }, exposure: 100, userId: "s" });
assert.strictEqual(r.els["link-jigglypuff"].l.length, 0);
assert.strictEqual(J(r.m.jigglypuff_render_errors_total), J({ atual: 0 }));
for (const c of [{}, { exposure: 0, userId: "s" }, { exposure: "100", userId: "s" }, { exposure: 100, userId: 0 }])
  assert.strictEqual(run(c).els["jigglypuff-ficha-rapida"].hidden, true, J(c));
assert(!run({ environment: "staging", userId: "staging", exposure: 100, flags: {} }).m.jigglypuff_link_clicks_total);
// class usage on wrapper, H2 and link (not only definitions)
{
  const cls = re => ((sec.match(re) || [])[1] || "").split(/\s+/);
  const has = (list, want) => want.every(w => list.includes(w));
  assert(has(cls(/<div class="([^"]*)">\s*<div class="mx-auto/), ["px-6", "md:px-12", "py-20", "md:py-28"]));
  assert(has(cls(/<div class="(mx-auto[^"]*)"/), ["mx-auto", "max-w-content"]));
  assert(has(cls(/<div class="(grid gap-8[^"]*)"/), ["grid", "gap-8", "max-w-reading"]));
  assert(has(cls(/<h2[^>]*class="([^"]*)"/), ["text-section"]));
  assert(has(cls(/<a [^>]*class="([^"]*)"/), ["min-h-control", "inline-flex", "items-center"]));
}
// every class used by the section exists in the landing-minimal class list; no Luma
{
  const known = new Set(fs.readFileSync(path.join(root, "assets", "landing-minimal.classes.txt"), "utf8").split(/\s+/).filter(Boolean));
  const used = new Set([...sec.matchAll(/class="([^"]*)"/g)].flatMap(m => m[1].split(/\s+/).filter(Boolean)));
  for (const c of used) assert(known.has(c), "unknown class " + c);
  assert(!/luma/i.test(sec));
}
// shipped default config is off
assert(/CHARIZARD_CONFIG\s*\|\|\s*null/.test(fs.readFileSync(path.join(root, "charizard-config.js"), "utf8")));
// evaluationKey userId at mid exposure: both sides occur
{
  const on = id => !run({ exposure: 50, userId: id }).els["jigglypuff-ficha-rapida"].hidden;
  const res = ["alice", "bob", "carol", "dave", "erin", "frank", "grace", "heidi"].map(on);
  assert(res.includes(true) && res.includes(false), J(res));
  assert.strictEqual(on("alice"), on("alice"));
}
// atual failure path also counts the view
{
  const win = { CHARIZARD_CONFIG: { get flags() { throw new Error("x"); } } };
  vm.runInNewContext(code, { window: win, document: { getElementById: () => undefined, addEventListener() {} } });
  assert.strictEqual(J(win.charizardMetrics.jigglypuff_page_views_total), J({ atual: 1 }));
}
