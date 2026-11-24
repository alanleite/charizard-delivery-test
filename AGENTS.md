# Engineering premises of the delivery test site

- The site is static: `site/` is published as is to GitHub Pages (staging) by `.github/workflows/`.
  There is no server, no login and no user data.
- **Feature flags.** A page reads its flag configuration from the global `window.CHARIZARD_CONFIG`,
  defined by the script `charizard-config.js`, which the page loads **before** its own flag code:
  `<script src="charizard-config.js"></script>`.
  - The change ships `site/charizard-config.js` as the local default, flags off:
    `window.CHARIZARD_CONFIG = window.CHARIZARD_CONFIG || null;`
  - The deploy replaces that file per environment. In **staging** every flag of the page is on:
    `{ "environment": "staging", "userId": "staging", "exposure": 100, "flags": {} }`
    (`flags` holds per-flag booleans that win over `exposure`; `exposure` is a percentage over a
    hash of `userId`). A missing or invalid configuration means off.
- **Metrics.** The site has no backend: counters live in the page (for example
  `window.charizardMetrics`) with the labels the contract names; the metrics are simulated for the
  Engine.
- `.github/` and `README.md` are protected: never change them.
- For pages and landing pages, load the workspace skill `landing-minimal` and use its `tokens.json` design tokens.
