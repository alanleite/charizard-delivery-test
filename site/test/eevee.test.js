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
assert(/px-6 md:px-12 py-20 md:py-28/.test(sec) && /grid gap-8/.test(sec) && sec.includes("break-words"));
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
  return { els, m: win.charizardMetrics };
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
r.els["link-eevee"].l.forEach(f => f({}));
assert.strictEqual(JSON.stringify(r.m.eevee_link_clicks_total), JSON.stringify({ nova: 1 }));
// real render failure counted with the variant
{
  const els = {};
  const win = { CHARIZARD_CONFIG: { flags: { "eevee-ficha-rapida": true } } };
  vm.runInNewContext(code, { window: win, document: { getElementById: id => els[id], addEventListener() {} } });
  assert.strictEqual(win.charizardMetrics.eevee_render_errors_total.nova, 1);
  assert.strictEqual(win.charizardMetrics.eevee_page_views_total.nova, 1);
}
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
