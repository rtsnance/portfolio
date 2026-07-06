# ryantnance.com — portfolio site

Static site, no build step. Converted from the Claude Design handoff export into plain HTML/CSS/JS so it can be hosted directly on Cloudflare Pages.

## Structure
- `index.html`, `about.html`, `sigmasight.html`, `grailed.html`, `atom-tickets.html`, `edo.html`, `the-black-tux.html` — the seven pages
- `css/desert-ds.css` — design system tokens (colors, type, the four themes)
- `js/site.js` — theme switcher (day/sunrise/sunset/night), replaces the React-based prototype logic with plain JS + localStorage
- `assets/` — images and the Grailed logo video, renamed to remove spaces/commas for clean URLs
- `Ryan_Nance_Lead_Product_Designer_CV.pdf` — linked from the footer

## Deploy (Cloudflare Pages)
1. Push this folder to the GitHub repo already connected to Cloudflare Pages.
2. Pages build settings: no build command, output directory = `/` (root).
3. Custom domain `ryantnance.com` should already be attached from the earlier setup.

## Resolved (from the design handoff)
- **About page portrait** — added as `assets/portrait.jpg`; `about.html` now uses `<img class="portrait">` with `object-fit: cover`.
- **The Black Tux video** — was a Google Drive `/preview` link (broke for anonymous visitors); re-hosted on Vimeo and swapped to a `player.vimeo.com` embed. *Note: confirm the Vimeo video's privacy allows embedding on `ryantnance.com`.*
- **Grailed case study** — the trust-signal feature is now named explicitly: the Trust Banner, Badge & Details.
- **EDO hero image** — placeholder removed; the page runs header → Context with no hero image.
- Unused `.imgplaceholder` CSS rule removed from all pages.
