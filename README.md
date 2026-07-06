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

## Known open items (carried over from the design handoff)
- **About page portrait**: the image-slot in Claude Design had a photo dropped in, but it wasn't included in the export bundle. Add a real photo as `assets/portrait.jpg` and replace the dashed placeholder box in `about.html` with `<img class="portrait" src="assets/portrait.jpg" alt="Ryan Nance">`.
- **EDO hero image**: same situation, no screenshot was ever added. Add one as `assets/edo-hero.png` and replace the placeholder in `edo.html`.
- **EDO's embedded video** uses a Google Drive `/preview` link, which breaks for anonymous visitors. Re-host on Vimeo (like the other three case-study videos) and swap the iframe `src`.
- **Grailed case study**: one line still has a bracketed note asking whether you want to name the specific trust-signal feature you shipped — optional, not blocking.
