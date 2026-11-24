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
