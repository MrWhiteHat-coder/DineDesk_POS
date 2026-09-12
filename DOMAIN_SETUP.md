# DineDesk POS — Domain + Ranking Playbook

Goal: for searches **"dinedesk"**, **"dine desk"**, **"dinedesk pos"** (India), get DineDesk POS into the **top 3** results.

## Step 1 — Buy the domain (~₹800–1,000/year, 5 min)

1. Go to your registrar (GoDaddy / Namecheap / Cloudflare Registrar — Cloudflare is cheapest, at-cost pricing).
2. Search **`dinedeskpos.com`** → it was available as of Sep 2026. Buy it.
3. Optional but recommended: also grab `dinedesk.co.in` (~₹500/yr) so nobody else takes the India brand domain.

## Step 2 — Connect it to Vercel (5 min)

1. Vercel dashboard → your DineDesk project → **Settings → Domains → Add** → enter `dinedeskpos.com` and `www.dinedeskpos.com`.
2. Vercel shows DNS records to create. At your registrar set:
   - `A` record: `@` → `76.76.21.21`
   - `CNAME`: `www` → `cname.vercel-dns.com`
3. Wait for DNS propagation (minutes to a few hours). HTTPS is automatic.
4. The repo already contains `frontend/vercel.json` with 301 redirects: every visitor to `dinedeskpos.com/*` lands on `https://www.revontechnologies.in/$1`. Your main site keeps all SEO authority; the new domain protects the brand and forwards everything.
5. (Later, if you ever want dinedeskpos.com to BE the main domain: swap the redirect direction and update canonical/sitemap URLs — ask me, 10-min change.)

## Step 3 — Google Search Console (THE most important step, 10 min)

Without this Google can take weeks to even notice the site.

1. Open https://search.google.com/search-console → **Add property → URL prefix** → `https://www.revontechnologies.in`
2. Verify via **DNS TXT record** (Vercel: Settings → Domains → your domain → TXT records; or your registrar's DNS panel):
   - `google-site-verification=<the value GSC gives you>`
3. After verification:
   - **Sitemaps →** submit `sitemap.xml`
   - **URL Inspection →** inspect `https://www.revontechnologies.in/` → **Request Indexing**
   - Repeat for `/store`
4. Add the second property for `https://dinedeskpos.com` too once connected, submit its sitemap as well.

## Step 4 — Bing (often forgotten, 5 min)

https://www.bing.com/webmasters → "Import from Google Search Console" → done. Bing powers a surprising share of India Windows browsers.

## Step 5 — Google Business Profile (biggest India brand-SERP lever, 10 min)

1. https://business.google.com → Create profile → **Trident Ventures**, Chennai.
2. Category: **"Software company"** (add "Restaurant supply store" secondary if offered).
3. Website: `https://www.revontechnologies.in` · Phone: `+91 98403 93658`.
4. Once verified, Google often shows a brand knowledge panel for company-name searches — this is what pushes competitors down page 1.

## Step 6 — LinkedIn Company Page (10 min)

1. LinkedIn → Create **Company Page** → "DineDesk POS" (by Trident Ventures).
2. Tagline: "Restaurant POS & billing software · Start small. Grow without limits."
3. Website `https://www.revontechnologies.in`, Chennai, 2-10 employees.
4. Post once (launch announcement). LinkedIn pages rank on page 1 for brand searches almost immediately.
5. Send me the page URL → I'll wire it into the site's JSON-LD `sameAs` (done in 2 min).

## Step 7 — Free directory backlinks (30 min total, do over the week)

Each is a real backlink that builds domain authority:
- **Product Hunt** — post the launch (upvotes boost + dofollow-ish exposure)
- **GitHub** — pin the public repo, add the website URL to the repo About
- **F6S, Crunchbase (free profile), AlternativeTo** — list DineDesk POS as an alternative to Toast/Lightspeed/Petpooja
- **SaaSHub / SaaSworthy / StackShare** — free listings

## What I've already built into the code (live)

- Title/description/keywords targeting `dinedesk`, `dine desk`, `dinedesk pos` + India intent
- JSON-LD `SoftwareApplication` with `alternateName: "Dine Desk"` + real INR offers
- robots.txt blocking private routes, sitemap.xml, canonical, OG/Twitter cards, favicons
- `vercel.json` 301 redirects for the new domain
- Per-page titles + noindex on auth pages

## Ranking expectations (honest)

| Query | Current | After steps 1–6 | After ~3 months |
|---|---|---|---|
| "dinedesk pos" / "dinedesk pos india" | not ranked | **#1–3** | #1, with rich result |
| "dine desk" (India) | not ranked | top 3–5 | top 3 |
| "dinedesk" (India) | page 2+ | page 1 | **top 3 realistic** — #1 needs the directories + steady content |

The two incumbents (`dinedesk.com` Boston, `dinedesk.in` cafeteria) have age authority but no India POS presence. GSC + GBP + LinkedIn usually flips a brand-name SERP within weeks; #1 for the bare term is a 1–3 month climb driven by the backlinks in Step 7 and, ideally, one helpful content page per month ("restaurant billing automation", "POS for small restaurants India" — I can build the blog page when you're ready).
