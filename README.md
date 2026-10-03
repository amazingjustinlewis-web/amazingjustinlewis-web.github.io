# Cohesion Games (working name)

A free, static website for **Cohesion Games**, the indie game studio founded by
Justin Lewis. Live at https://amazingjustinlewis-web.github.io/ Plain HTML, CSS and a
little vanilla JavaScript: no build step, no frameworks, no server code. It's
made for **GitHub Pages** and works unchanged on a custom `.com` later.

```
games-site/
├── index.html              Home: hero, games grid (rendered from games.js), short intro
├── about.html              Bio
├── 404.html                "Game Over" page GitHub Pages shows for missing URLs
├── favicon.ico             Fallback icon for browsers that ask for /favicon.ico
├── .nojekyll               Tells GitHub Pages to serve files as-is (no Jekyll)
├── assets/
│   ├── css/style.css       All the styling (colours are CSS variables at the top)
│   ├── js/site-config.js   SITE NAME lives here (rename in one place)
│   ├── js/games.js         THE GAMES LIST: one entry per game
│   ├── js/site.js          Renders the grid, applies the name, screenshot lightbox
│   ├── fonts/              Self-hosted Press Start 2P + Space Grotesk (OFL licences included)
│   └── img/                Favicons, social-share image, per-game screenshots
└── games/
    ├── charge-hop.html     Charge Hop details page
    └── charge-hop/         The game itself (open games/charge-hop/index.html)
```

## Preview locally

```bash
cd games-site
python3 -m http.server 8000
# open http://localhost:8000/
```

(Double-clicking `index.html` mostly works too, but serving over http is closest
to what GitHub Pages does.)

## Add a new game

1. **Copy the game** into its own folder: `games/<game-id>/` with its own
   `index.html` (so it plays at `games/<game-id>/index.html`). Inside the game,
   use only relative paths (`js/main.js`, not `/js/main.js`).
2. **Add images**: put a 16:9 cover (about 640x360, `.webp`) and some
   screenshots (about 1200px wide) in `assets/img/<game-id>/`.
   A 1200x630 `.jpg` for link previews is a nice extra.
3. **Add a details page**: copy `games/charge-hop.html` to
   `games/<game-id>.html` and change the text, controls, screenshots, the
   `data-page-title` on the `<html>` tag, and the `og:` / `twitter:` tags.
4. **Add one entry to `assets/js/games.js`**:

   ```js
   ,{
     id: 'my-next-game',
     title: 'My Next Game',
     pitch: 'One line that makes people want to click Play.',
     cover: 'assets/img/my-next-game/cover-card.webp',
     coverAlt: 'What the cover shows',
     play: 'games/my-next-game/index.html',
     details: 'games/my-next-game.html',
     status: 'New!',
     tags: ['1 player', 'Mouse'],
     accent: '#00F0FF'
   }
   ```

   Paths in `games.js` are relative to the site root (no leading `/`). The home
   page grid picks the new card up automatically, in list order (so put your
   newest game first if you want it top-left). The dashed "More games coming
   soon" tile is added after the list automatically.

## Rename the site

The current (working) name is **Cohesion Games**. Change `name` in
`assets/js/site-config.js` and every visible header, hero, footer and browser-tab
title updates.

Link-preview crawlers (Facebook etc.) don't run JavaScript, so each page's
`<title>` and `og:` tags also hold the name as plain text. To rename those too
in one go (run from the `games-site` folder):

```bash
grep -rl "Cohesion Games" --include=*.html --include=*.js . | grep -v "^./games/.*/" | xargs sed -i 's/Cohesion Games/NEW NAME HERE/g'
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
