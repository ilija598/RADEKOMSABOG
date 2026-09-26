# RADE KOMŠA — BOG MIDLEJNA

A deliberately absurd, bilingual Egyptian Dota 2 challenger temple. The frontend is vanilla HTML/CSS/JavaScript built with Vite; the home page drives users toward a dedicated `#challenge` screen with the prize explanation and a five-step, Typeform-style application saved to Netlify Forms.

## Challenger protocol

The primary CTA is **IZAZOVI FARAONA I OSVOJI 50E**. It opens the challenge page: left side explains how to win the 50 euro joke prize, right side contains the application form.

The flow contains four answer steps and a final review/submit step:

1. Immortality and worthiness, YES/NO.
2. Belief that Rade is not immortal. YES shrinks and NO grows for 30 attempts; YES unlocks on click 31.
3. Whether the challenger is better than Rade. YES always evades the first three approaches, then has a 1-in-20 chance to stay still for a click.
4. Name or nick, Dota 2 MMR, and a short reason.
5. Review every answer, go back if needed, or submit the final application.

The current step, answers, fields, and interaction counters are written to `localStorage` under `radekomsa-challenger-draft:v1` on every change. Reloading the page restores the draft. A confirmed Netlify submission removes the local draft.

## Develop locally

Requirements: Node.js 22.12+ and npm.

```sh
npm install
npm run dev
```

Vite normally serves the site at [http://127.0.0.1:5173](http://127.0.0.1:5173). Local Vite development intentionally does not fake a successful save: the final button shows that persistence is active only on the Netlify deployment. All form behavior before submission works locally.

## Deploy to Netlify

The repository includes `netlify.toml`, so Git-based deployment needs no custom build settings:

- Build command: `npm run build`
- Publish directory: `dist`
- Node: `22.12.0`
- Submission backend: `netlify`

In Netlify, choose **Add new project**, import this Git repository, and deploy. The Vite build prerenders the form into `dist/index.html`, allowing Netlify to detect the `radekomsa-challenger` form during deployment. After the first production deploy, send one test application and confirm it appears in the project's Forms area.

Saved submission fields:

```text
immortalWorthy
believesRadeMortal
betterThanRade
challengerName
mmr
description
lieYesAttempts
superiorityEvades
submissionLanguage
submittedAt
```

The form includes Netlify's honeypot field. For this joke site's expected low traffic, the free-tier form inbox is the simplest review surface and avoids operating a database or admin app.

## Checks

```sh
npm test
npm run build
```

Tests cover both translation dictionaries, static Netlify form detection, the new challenger payload, the retained API validation, request protections, and the existing mythology/quote behavior.

## Existing Cloudflare endpoint

`functions/api/signup.js`, `wrangler.toml`, and the D1 migration are retained for backward compatibility with the previous Steam-based signup API. The new five-step frontend does not call that endpoint. It can be removed in a later cleanup after any existing Cloudflare deployment is retired.

## Structure

```text
index.html                         Vite entry and prerender target
netlify.toml                       Netlify build and submission configuration
src/layout.js                      Semantic bilingual page and static form contract
src/challenger-form.js             Step state, local draft, interactions, submission
src/challenger-form.css            Responsive Typeform-style protocol UI
src/main.js                        Global page behavior and form initialization
src/content/sr.js                  Serbian copy
src/content/en.js                  English copy
src/validation.js                  Shared pure validation
tests/                             Node built-in tests
functions/api/signup.js            Retained legacy Cloudflare Pages Function
```
