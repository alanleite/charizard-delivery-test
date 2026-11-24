// Run: node site/test/blastoise.test.js
const fs = require("fs"), path = require("path"), assert = require("assert");
const h = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
assert(/<section id="blastoise-landing" hidden>/.test(h), "hidden by default");
assert(/<h1>Blastoise<\/h1>/.test(h));
assert(/nav \{ position: sticky; top: 0/.test(h));
for (const id of ["atributos","fraquezas","golpes","curiosidades"]) {
  assert(h.includes(`href="#${id}"`)); assert(new RegExp(`<h2 id="${id}">`).test(h));
}
assert(/#1f4e96/.test(h) && /#8a5a2b/.test(h));
assert(/@media \(max-width: 400px\)/.test(h));
assert(/href="charizard-deploy.json"/.test(h));
assert(h.indexOf('id="blastoise-landing"') < h.indexOf('id="ficha-dragonite"'));
for (const m of ["page_views_total","link_clicks_total","page_render_errors_total"]) assert(h.includes(m));
assert(h.includes('"blastoise-landing"') && h.includes('"nova"') && h.includes('"atual"'));
assert(/id="pagina-atual"/.test(h) && h.includes("Charizard delivery test"));
console.log("ok");
// widths are percentages
const ws = [...h.matchAll(/class="barra"><div style="width: (\d+)%"/g)].map(m => +m[1]);
assert(ws.length === 6 && ws.every(x => x > 0 && x <= 100), "proportional bar widths");
// execute the inline script with a minimal fake DOM
const vm = require("vm");
const code = [...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n");
function run(cfg, broken) {
  const els = { "blastoise-landing": { hidden: true }, "pagina-atual": { hidden: false }, "ficha-dragonite": { hidden: true } };
  const win = { CHARIZARD_CONFIG: cfg };
  const doc = { getElementById: id => { if (broken && id === "blastoise-landing") throw new Error("x"); return els[id]; }, addEventListener() {} };
  vm.runInNewContext(code, { window: win, document: doc });
  return { els, m: win.charizardMetrics };
}
let r = run(null);
assert(r.els["blastoise-landing"].hidden && !r.els["pagina-atual"].hidden && r.m.page_views_total.atual === 1);
r = run({ exposure: 100, userId: "staging", flags: {} });
assert(!r.els["blastoise-landing"].hidden && r.els["pagina-atual"].hidden && r.m.page_views_total.nova === 1);
r = run({ exposure: 500, userId: "staging" });
assert(r.els["blastoise-landing"].hidden && r.m.page_views_total.atual === 1);
r = run({ flags: { "blastoise-landing": true } }, true);
assert(r.m.page_render_errors_total.nova === 1);
console.log("behavior ok");
