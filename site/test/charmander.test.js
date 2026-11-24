const fs = require("fs"), path = require("path"), assert = require("assert"), vm = require("vm");
const h = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const sec = h.match(/<section id="charmander-ficha-rapida"[\s\S]*?<\/section>/)[0];
// hidden by default, last section, after Blastoise and Dragonite
assert(/<section id="charmander-ficha-rapida"[^>]* hidden>/.test(sec));
assert(h.indexOf("charmander-ficha-rapida") > h.indexOf('id="ficha-dragonite"') && h.indexOf('id="ficha-dragonite"') > h.indexOf('id="blastoise-landing"'));
assert(h.lastIndexOf("<section") === h.indexOf('<section id="charmander-ficha-rapida"'));
// content
assert.strictEqual((sec.match(/<h2/g) || []).length, 1);
assert(sec.includes("Charmander — ficha rápida</h2>"));
assert.strictEqual((sec.match(/<li>/g) || []).length, 3);
for (const t of ["Tipo: Fogo", "Cauda com chama", "Evolui para Charmeleon"]) assert(sec.includes(t));
const links = sec.match(/<a /g) || [];
assert.strictEqual(links.length, 1);
assert(sec.includes('href="https://www.pokemon.com/br/pokedex/charmander"') && sec.includes(">Saiba mais na Pokédex</a>"));
assert(!/<img|<button/.test(sec));
// style assets
for (const f of ["landing.css", "landing-minimal.tokens.json", "landing-minimal.classes.txt"]) assert(fs.statSync(path.join(__dirname, "..", "assets", f)).size > 0);
assert(h.includes('href="assets/landing.css"'));
assert(!fs.existsSync(path.join(__dirname, "..", "..", "package.json")));
// behavior
const code = [...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n");
function run(cfg) {
  const els = { "blastoise-landing": { hidden: true }, "pagina-atual": { hidden: false }, "ficha-dragonite": { hidden: true }, "charmander-ficha-rapida": { hidden: true }, "link-pokedex": { l: [], addEventListener(t, f) { this.l.push(f); } } };
  const doc = { getElementById: id => els[id], addEventListener() {} };
  const win = { CHARIZARD_CONFIG: cfg };
  vm.runInNewContext(code, { window: win, document: doc });
  return { els, m: win.charizardMetrics };
}
let r = run(null);
assert(r.els["charmander-ficha-rapida"].hidden === true);
r = run({ environment: "staging", userId: "staging", exposure: 100, flags: {} });
assert(r.els["charmander-ficha-rapida"].hidden === false);
assert.strictEqual(r.m.page_views_total.nova, 1);
let stopped = 0;
r.els["link-pokedex"].l.forEach(f => f({ stopPropagation() { stopped++; } }));
assert.strictEqual(r.m.link_clicks_total.nova, 1);
r = run({ exposure: 500, userId: "x" });
assert(r.els["charmander-ficha-rapida"].hidden === true);
r = run({ flags: { "charmander-ficha-rapida": false }, exposure: 100, userId: "s" });
assert(r.els["charmander-ficha-rapida"].hidden === true);
console.log("charmander ok");
