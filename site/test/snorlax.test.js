const fs = require("fs"), path = require("path"), assert = require("assert"), vm = require("vm");
const root = path.join(__dirname, "..");
const h = fs.readFileSync(path.join(root, "index.html"), "utf8");
const sec = h.match(/<section id="snorlax-ficha-rapida"[\s\S]*?<\/section>/)[0];
// AC1
assert(/<section id="snorlax-ficha-rapida"[^>]* hidden>/.test(sec));
assert.strictEqual((sec.match(/<h2[^>]*>Snorlax<\/h2>/g) || []).length, 1);
assert(sec.includes("Snorlax valoriza o descanso e recupera energia sem pressa."));
const a = sec.match(/<a [^>]*>/g);
assert.strictEqual(a.length, 1);
assert(a[0].includes('href="https://www.pokemon.com/br/pokedex/snorlax"'));
assert(sec.includes(">Conheça Snorlax na Pokédex</a>"));
assert(h.indexOf('id="snorlax-ficha-rapida"') > h.indexOf('id="eevee-ficha-rapida"'));
// layout, tokens, no inline style, no images
assert(/px-6 md:px-12/.test(sec) && /max-w-content/.test(sec) && /max-w-reading/.test(sec) && /min-h-control/.test(sec));
assert(/focus-visible:ring-2/.test(a[0]) && !/tabindex/.test(a[0]));
assert(!/style=|<img/.test(sec));
const css = fs.readFileSync(path.join(root, "assets", "landing.css"), "utf8");
for (const c of ["min-h-control{min-height:2.75rem}", "max-w-reading{max-width:42rem}", "focus-visible\\:ring-2:focus-visible"]) assert(css.includes(c), c);
// behavior
const code = [...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n");
assert(code.includes('"snorlax-ficha-rapida"'));
const IDS = ["blastoise-landing", "pagina-atual", "ficha-dragonite", "charmander-ficha-rapida", "eevee-ficha-rapida", "snorlax-ficha-rapida", "link-pokedex", "link-eevee", "link-snorlax"];
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
assert.strictEqual(r.els["snorlax-ficha-rapida"].hidden, true);
assert.strictEqual(J(r.m.snorlax_page_views_total), J({ atual: 1 }));
assert(!r.m.snorlax_link_clicks_total && !r.m.snorlax_render_errors_total);
assert.strictEqual(r.els["link-snorlax"].l.length, 0);
r = run({ flags: { "snorlax-ficha-rapida": false }, exposure: 100, userId: "s" });
assert.strictEqual(r.els["snorlax-ficha-rapida"].hidden, true);
assert.strictEqual(J(r.m.snorlax_page_views_total), J({ atual: 1 }));
r = run({ environment: "staging", userId: "staging", exposure: 100, flags: {} });
assert.strictEqual(r.els["snorlax-ficha-rapida"].hidden, false);
assert.strictEqual(J(r.m.snorlax_page_views_total), J({ nova: 1 }));
assert(!r.m.snorlax_render_errors_total);
const legacy = J(r.m.link_clicks_total);
for (let n = 1; n <= 2; n++) {
  let stopped = false;
  const ev = { target: { closest: () => ({}) }, stopPropagation() { stopped = true; } };
  r.els["link-snorlax"].l.forEach(f => f(ev));
  if (!stopped) r.docL.forEach(f => f(ev));
  assert.strictEqual(r.m.snorlax_link_clicks_total.nova, n);
}
assert.strictEqual(J(r.m.link_clicks_total), legacy);
// render failure counted with variant, rest continues
{
  const els = {};
  const win = { CHARIZARD_CONFIG: { flags: { "snorlax-ficha-rapida": true } } };
  vm.runInNewContext(code, { window: win, document: { getElementById: id => els[id], addEventListener() {} } });
  assert.strictEqual(win.charizardMetrics.snorlax_render_errors_total.nova, 1);
  assert.strictEqual(win.charizardMetrics.snorlax_page_views_total.nova, 1);
}
// legacy series not renamed
assert(h.includes("page_views_total: {}") && h.includes("link_clicks_total: {}"));
