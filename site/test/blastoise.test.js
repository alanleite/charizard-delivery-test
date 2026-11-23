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
