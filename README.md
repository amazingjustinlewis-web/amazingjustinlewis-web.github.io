# Zero to Phi

A free, static website for **Zero to Phi** (0 → φ), the indie game studio founded by
Justin Lewis. Live at https://amazingjustinlewis-web.github.io/

Plain HTML, CSS and a little vanilla JavaScript: no build step, no frameworks, no
server code. It's made for **GitHub Pages** and works unchanged on a custom `.com` later.

```
games-site/
├── index.html              Home: logo + the three layered section cards
├── soft-play.html          Front card: soft, bright kids section + the One-Button Series
├── family.html             Centre card (main section): soft to intense, all family-appropriate
├── deep-end.html           Back card: darker experiments, locked teaser page (no games yet)
├── about.html              Bio
├── 404.html                "Game Over" page GitHub Pages shows for missing URLs
├── favicon.ico   .nojekyll
├── assets/
│   ├── css/style.css       All styling (colours are CSS variables at the top; v2 section at the bottom)
│   ├── js/site-config.js   SITE NAME lives here (rename in one place)
│   ├── js/games.js         THE GAMES DATA: games, sections, series, versions
│   ├── js/site.js          Renders every list from games.js, applies the name, lightbox
│   ├── fonts/              Self-hosted Press Start 2P, Space Grotesk, Fredoka (OFL licences included)
│   └── img/
│       ├── logo.svg, logo-light.svg, favicon.svg    The logo in use (concept 1, "Unfurl")
│       ├── logo-concepts/  The three logo concepts (+ index.html preview sheet)
│       ├── charge-hop/     Screenshots, cover, share image
│       └── zombie-tiles/   Zombie Tiles cover, screenshots, share image
└── games/
    ├── charge-hop.html     Charge Hop details page
    ├── charge-hop/         The game itself, current build v3 "The Lava Run"
    ├── zombie-tiles.html   Zombie Tiles (working title) details page
    └── zombie-tiles/       TV/host page (index.html) + phone controller (controller.html), v0.2;
                            lights-helper/ = optional Philips Hue helper for a PC; v0.1/ = previous build. See its README
```

## The three sections

The home page is a deck of three overlapping cards. Each game says which
section(s) it belongs to in `games.js` (`sections: [...]`):

| Card | Page | Section id | What goes there |
|---|---|---|---|
| Front | `soft-play.html` | `soft-play` | Soft, bright, gentle games for kids. Home of the One-Button Series. |
| Centre (main) | `family.html` | `family` | Everything family-appropriate, from soft to intense (sorted by `intensity`, 1 Gentle to 5 Full throttle). |
| Back | `deep-end.html` | `deep-end` | Darker, deeper experiments. Locked for now: the page is a teaser and lists no games. |

## Preview locally

```bash
cd games-site
python3 -m http.server 8000
# open http://localhost:8000/
```

## Add a new game

1. **Copy the game** into its own folder: `games/<game-id>/` with its own
   `index.html`. Inside the game, use only relative paths (`js/main.js`, not `/js/main.js`).
2. **Add images** to `assets/img/<game-id>/`: a 16:9 cover (about 640x360 `.webp`),
   screenshots (about 1200px wide), optionally a 1200x630 `.jpg` for link previews.
3. **Add a details page**: copy `games/charge-hop.html` to `games/<game-id>.html`
   and change the text, controls, screenshots, `data-page-title`, the `og:` /
   `twitter:` tags and the `data-versions` / `data-good-to-know` / `data-play-current` ids.
4. **Add one entry to `GAMES` in `assets/js/games.js`** (the comment at the top
   of that file explains every field):

   ```js
   ,{
     id: 'my-next-game',
     title: 'My Next Game',
     pitch: 'One line that makes people want to click Play.',
     cover: 'assets/img/my-next-game/cover-card.webp',
     coverAlt: 'What the cover shows',
     details: 'games/my-next-game.html',
     status: 'New!',
     tags: ['1 player', 'One button'],
     sections: ['soft-play', 'family'],   // which section pages list it
     series: 'one-button',                // optional
     intensity: 1,                         // 1 Gentle ... 5 Full throttle
     goodToKnow: ['Has sound: press M to mute.'],
     versions: [
       { id: 'v1', name: 'First build', current: true, play: 'games/my-next-game/index.html' }
     ]
   }
   ```

   The section pages, the home-page cards and the details page all update from
   this list. Paths are relative to the site root (no leading `/`).

## Add a new version of a game

Put the new build in its own folder (e.g. `games/charge-hop/v4/index.html`), add it
to the top of that game's `versions` list with `current: true`, and set the
previous one to `current: false`. Keep old entries so people can still play them.
Only list builds that are really in the repo. (Right now only Charge Hop v3 is.)

## Logo

`assets/img/logo-concepts/` holds three hand-coded SVG concepts built from golden-ratio
geometry (the spiral grows by φ every quarter turn), each on dark and on light. Open
`assets/img/logo-concepts/index.html` to compare them. Concept 1 ("Unfurl") is in use:
`assets/img/logo.svg` (header, dark), `logo-light.svg` (light header), `favicon.svg`
(heavier strokes for small sizes).

## Rename the site

The current name is **Zero to Phi**. Change `name` in
`assets/js/site-config.js` and every visible header, hero, footer and browser-tab
title updates.

Link-preview crawlers (Facebook etc.) don't run JavaScript, so each page's
`<title>` and `og:` tags also hold the name as plain text. To rename those too
in one go (run from the `games-site` folder):

```bash
grep -rl "Zero to Phi" --include=*.html --include=*.js . | grep -v "^./games/.*/" | xargs sed -i 's/Zero to Phi/NEW NAME HERE/g'
```

The share image `assets/img/og-site.jpg` has the name drawn into it, so make a
new one (1200x630) if the name changes.

## Deploy to GitHub Pages

This site is published from the `main` branch root of the user-site repo
`amazingjustinlewis-web/amazingjustinlewis-web.github.io`, so it lives at
https://amazingjustinlewis-web.github.io/. To update it, commit and push to `main`;
GitHub rebuilds it in a minute or two.

Setting it up from scratch elsewhere:

1. Create a repo (for example `games`) and push the *contents* of this folder to
   its `main` branch.
2. On GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**,
   pick `main` and `/ (root)`, then Save.
3. After a minute it's live at `https://<username>.github.io/<repo>/`.
   (If the repo is named `<username>.github.io`, it's at `https://<username>.github.io/`.)

All links are relative, so it works at either address and at a custom domain.
The only exception is `404.html`, which GitHub can show at any depth; it works
out the site root itself (see the comment at the top of that file).

## Point a custom domain (.com) at it later

> **CNAME note:** there is intentionally **no `CNAME` file** in this repo yet.
> When you have a domain, either set it in **Settings → Pages → Custom domain**
> (GitHub then creates the `CNAME` file for you), or add a file named `CNAME`
> (no extension) to the repo root containing just the domain, e.g.:
>
> ```
> www.your-domain.com
> ```

1. **Buy the domain** from any registrar.
2. **Add DNS records** at the registrar:
   - `www` → **CNAME** → `<username>.github.io`
   - apex / root (`@`) → **A** records:
     `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
     (optional **AAAA**: `2606:50c0:8000::153`, `2606:50c0:8001::153`,
     `2606:50c0:8002::153`, `2606:50c0:8003::153`)
3. In the repo: **Settings → Pages → Custom domain** → enter the domain → Save.
   Once DNS has propagated, tick **Enforce HTTPS**.
4. Recommended: verify the domain in your GitHub account settings
   (**Settings → Pages → Add a domain**) so nobody else can claim it.
5. **Update link previews**: search the HTML files for `TODO(domain)` and replace
   `https://amazingjustinlewis-web.github.io/` with the new domain in the
   `og:url`, `og:image` and `twitter:image` tags. Facebook needs absolute image URLs to show the picture
   reliably; check with the Facebook Sharing Debugger
   (https://developers.facebook.com/tools/debug/).

The site moves from `/<repo>/` to the domain root automatically; nothing else
needs changing because every link is relative.

Check GitHub's current docs before doing this, as the IP addresses above can change:
https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site

## Other TODOs

- `TODO(contact)`: contact / social links are deliberately left out. Search
  `about.html` and `index.html` for `TODO(contact)` to add them.
- `TODO(domain)`: share URLs point at the github.io address; switch them to the .com later, see above.

## Credits & licences

- Fonts: [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) and
  [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk), self-hosted
  under the SIL Open Font License (see `assets/fonts/OFL-*.txt`).
- Games, art and screenshots © Justin Lewis.
