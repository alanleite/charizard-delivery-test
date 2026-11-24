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
assert(!/<script|<form|<img/.test(page));
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
  vm.runInNewContext(code, { window: win, document: { getElementById: id => els[id], addEventListener() {} } });
  return { els, m: win.charizardMetrics };
}
let r = run(null);
assert.strictEqual(r.els["pokemon-page-link"].hidden, true);
assert.strictEqual(r.m.page_views_total.atual, 1);
r = run({ environment: "staging", userId: "staging", exposure: 100, flags: {} });
assert.strictEqual(r.els["pokemon-page-link"].hidden, false);
assert.strictEqual(r.m.page_views_total.nova, 1);
assert(!r.m.page_views_total.atual);
let stopped = 0;
r.els["link-pokemon"].l.forEach(f => f({ stopPropagation() { stopped++; } }));
assert.strictEqual(r.m.link_clicks_total.nova, 1);
assert.strictEqual(stopped, 1);
// flag alone
r = run({ flags: { "pokemon-page": true } });
assert.strictEqual(r.els["pokemon-page-link"].hidden, false);
assert.strictEqual(r.m.page_views_total.nova, 1);
assert(!r.m.page_views_total.atual);
// off / invalid
r = run({ flags: { "pokemon-page": false }, exposure: 0, userId: "s" });
assert.strictEqual(r.els["pokemon-page-link"].hidden, true);
assert.strictEqual(r.m.page_views_total.atual, 1);
r = run({ exposure: 500, userId: "x" });
assert.strictEqual(r.els["pokemon-page-link"].hidden, true);
// render error labelled nova, link stays hidden
{
  const els = { "blastoise-landing": { hidden: true }, "pagina-atual": { hidden: false }, "ficha-dragonite": { hidden: true } };
  const win = { CHARIZARD_CONFIG: { flags: { "pokemon-page": true } } };
  vm.runInNewContext(code, { window: win, document: { getElementById: id => els[id], addEventListener() {} } });
  assert.strictEqual(win.charizardMetrics.page_render_errors_total.nova, 1);
}
console.log("pokemon ok");
