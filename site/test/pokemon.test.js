const fs = require("fs"), path = require("path"), assert = require("assert"), vm = require("vm");
const dir = path.join(__dirname, "..");
const h = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const page = fs.readFileSync(path.join(dir, "pokemon.html"), "utf8");
// new page: title, opening sentence, ul with >= 4 items, back link
assert(/<title>Curiosidades sobre Pokémon<\/title>/.test(page) && /<h1>Curiosidades sobre Pokémon<\/h1>/.test(page));
assert(/<h1>[\s\S]*?<\/h1>\s*<p>[^<]+<\/p>/.test(page));
const ul = page.match(/<ul>([\s\S]*?)<\/ul>/)[1];
assert((ul.match(/<li>/g) || []).length >= 4);
assert(/<a href="index\.html">Voltar à página principal<\/a>/.test(page));
assert(!/<form|<img/.test(page));
// index: hidden link to the page, key spelled exactly
assert(/<p id="pokemon-page-link" hidden><a id="link-pokemon" href="pokemon\.html">Curiosidades sobre Pokémon<\/a><\/p>/.test(h));
assert(h.includes('K = "pokemon-page"'));
for (const id of ["blastoise-landing", "ficha-dragonite", "charmander-ficha-rapida", "eevee-ficha-rapida", "snorlax-ficha-rapida", "jigglypuff-ficha-rapida"]) assert(h.includes('id="' + id + '"'));
// behavior
const code = [...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n");
function run(cfg) {
  const mk = () => ({ hidden: true, l: [], addEventListener(t, f) { this.l.push(f); } });
  const els = {};
  for (const id of ["blastoise-landing", "pagina-atual", "ficha-dragonite", "charmander-ficha-rapida", "eevee-ficha-rapida", "snorlax-ficha-rapida", "jigglypuff-ficha-rapida", "link-pokedex", "link-eevee", "link-snorlax", "link-jigglypuff", "pokemon-page-link", "link-pokemon"]) els[id] = mk();
  els["pagina-atual"].hidden = false;
  const win = { CHARIZARD_CONFIG: cfg };
  const docL = [];
  vm.runInNewContext(code, { window: win, document: { getElementById: id => els[id], addEventListener(t, f) { docL.push(f); } } });
  return { els, docL, m: win.charizardMetrics };
}
let r = run(null);
assert.strictEqual(r.els["pokemon-page-link"].hidden, true);
assert.strictEqual(r.m.page_views_total.atual, 1);
r = run({ environment: "staging", userId: "staging", exposure: 100, flags: {} });
assert.strictEqual(r.els["pokemon-page-link"].hidden, false);
assert.strictEqual(r.m.page_views_total.nova, 1);
assert(!r.m.page_views_total.atual);
for (let n = 1; n <= 2; n++) {
  let stopped = false;
  const ev = { target: { closest: () => ({}) }, stopPropagation() { stopped = true; } };
  r.els["link-pokemon"].l.forEach(f => f(ev));
  if (!stopped) r.docL.forEach(f => f(ev));
  assert.strictEqual(r.m.link_clicks_total.nova, n);
}
assert(!("atual" in r.m.link_clicks_total));
// flag alone
r = run({ flags: { "pokemon-page": true } });
assert.strictEqual(r.els["pokemon-page-link"].hidden, false);
assert.strictEqual(r.m.page_views_total.nova, 1);
assert(!r.m.page_views_total.atual);
// off / invalid
r = run({ flags: { "pokemon-page": false }, exposure: 0, userId: "s" });
assert.strictEqual(r.els["pokemon-page-link"].hidden, true);
assert.strictEqual(r.m.page_views_total.atual, 1);
const K = "pokemon-page";
for (const c of [{ exposure: 500, userId: "x" }, { exposure: -1, userId: "x" }, { exposure: 0, userId: "x" }, { exposure: 100 }, { exposure: 100, userId: "" }, "x", 5,
  { flags: { [K]: false }, exposure: 100, userId: "s" }, { flags: { [K]: "true" }, exposure: 100, userId: "s" }, { flags: { [K]: 1 }, exposure: 100, userId: "s" }, { flags: { [K]: null }, exposure: 100, userId: "s" }])
  assert.strictEqual(run(c).els["pokemon-page-link"].hidden, true, JSON.stringify(c));
assert.strictEqual(run({ flags: "x", exposure: 100, userId: "s" }).els["pokemon-page-link"].hidden, false);
assert.strictEqual(run({ flags: { [K]: true }, exposure: 0, userId: "s" }).els["pokemon-page-link"].hidden, false);
// render error labelled nova, link stays hidden
{
  const els = { "blastoise-landing": { hidden: true }, "pagina-atual": { hidden: false }, "ficha-dragonite": { hidden: true } };
  const win = { CHARIZARD_CONFIG: { flags: { "pokemon-page": true } } };
  vm.runInNewContext(code, { window: win, document: { getElementById: id => els[id], addEventListener() {} } });
  assert.strictEqual(win.charizardMetrics.page_render_errors_total.nova, 1);
}
// the new page is gated too: hidden until the flag is on, else back to index.html
const gate = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n");
assert(/<script src="charizard-config\.js"><\/script>/.test(page) && /<body hidden>/.test(page));
function runPage(cfg) {
  const body = { hidden: true }, loc = { to: null, replace(u) { this.to = u; } };
  vm.runInNewContext(gate, { window: { CHARIZARD_CONFIG: cfg, location: loc }, document: { body } });
  return { body, loc };
}
let g = runPage({ flags: { [K]: true } });
assert.strictEqual(g.body.hidden, false); assert.strictEqual(g.loc.to, null);
g = runPage({ environment: "staging", userId: "staging", exposure: 100, flags: {} });
assert.strictEqual(g.body.hidden, false);
for (const c of [null, { flags: { [K]: false }, exposure: 100, userId: "s" }, { exposure: 0, userId: "s" }, { exposure: 100 }]) {
  g = runPage(c);
  assert.strictEqual(g.body.hidden, true); assert.strictEqual(g.loc.to, "index.html");
}
console.log("pokemon ok");
