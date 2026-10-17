# Dial In

A game for learning synthesis by ear: hear a target sound, recreate it on the built-in synth, and get a score with specific feedback. Runs in the browser on desktop and mobile and installs as an offline-capable app (PWA). See [SPEC.md](SPEC.md) for the full design.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run build      # production build in dist/
npm run preview    # serve the build at http://localhost:4173 (service worker included)
npm run icons      # redraw the app icons in public/
```

`#calibrate` (e.g. `http://localhost:5173/#calibrate`) opens the dev page for tuning the audio score.

## Deploy

It's a static site with hash routes, so any static host works; no rewrites are needed.

- **GitHub Pages**: push to a GitHub repo, then Settings → Pages → Source: GitHub Actions. [.github/workflows/deploy.yml](.github/workflows/deploy.yml) tests, builds and publishes on every push to `main`, under `/<repo-name>/`.
- **Netlify**: connect the repo ([netlify.toml](netlify.toml) has the settings), or run `npm run build` and drag `dist/` onto [app.netlify.com/drop](https://app.netlify.com/drop).

Building for a sub-path elsewhere: set `DIAL_IN_BASE=/path/` when running `npm run build`. In Git Bash on Windows, add `MSYS_NO_PATHCONV=1` so the path isn't turned into a Windows path.

After deploying, run the [iOS testing checklist](docs/ios-testing.md) on a real iPhone.
