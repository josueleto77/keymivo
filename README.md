# Keymivo

The AI copilot for buyer agents. *From showing to offer in minutes.*
(Spec: HomeTour AI build playbook — product renamed to Keymivo.)

## Layout

```
supabase/migrations/   SQL migrations (already applied to Supabase project "keymivo")
web/                   React + TypeScript + Tailwind v4 + shadcn-style UI (Vite)
```

## Run locally

```bash
cd web
npm install
npm run dev
```

`web/.env.local` holds the public Supabase URL and publishable key. Never put the service-role,
OpenAI or Stripe keys in the frontend — those go in Supabase Edge Function secrets.

## Production

Live at **https://app.keymivo.com** (also keymivo.vercel.app; Vercel project `keymivo`, DNS at Namecheap: A app → 76.76.21.21). Code: github.com/josueleto77/keymivo (private). Redeploy from `web/`:

```bash
npx vercel deploy --prod --build-env VITE_SUPABASE_URL=https://ymilfkgnbrpmgmxghvqt.supabase.co --build-env VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_pX5yJOsbok7dCTRPHaOKdA_9XgLjY51
```

### One-time Supabase auth setting

Supabase dashboard → **Authentication → URL Configuration**:

- Site URL: `http://localhost:5173` (your production URL later)
- Redirect URLs: add `http://localhost:5173/**`

Without this, email-verification and password-reset links go to the default `localhost:3000`.

## Backend

- **Project:** `keymivo` (`ymilfkgnbrpmgmxghvqt`, us-east-1)
- **Tenancy:** Organization → Team → Realtor (profile) → Clients. Every tenant row has
  `organization_id`, defaulted from the caller's profile via `current_org_id()`.
- **RLS:** all tables. Staff of an org get CRUD on that org's rows (`can_access_org()`); buyers get
  nothing yet (buyer portal is step 12); super admins can read. Users can't change their own `role`,
  `organization_id` or subscription fields (column-level grants).
- **Storage:** private buckets `property-photos`, `showing-media`, `recordings`; paths start with
  `{organization_id}/`; access via signed URLs only.
- **RPCs:** `complete_onboarding(...)` (creates the org + 14-day Pro trial), `seed_demo_data()`,
  `remove_demo_data()`.
- **Audit trail:** triggers write `client_created`, `property_created`, `tour_created`,
  `showing_started`, `showing_completed`, `recording_consent_confirmed`, `preference_updated`, … to
  `activity_logs`.

## Build status (playbook implementation order)

| Step | Scope | Status |
|---|---|---|
| 1 | Schema, auth, organizations, profiles, RLS | ✅ |
| 2 | App shell, sidebar, mobile bottom nav, dashboard | ✅ |
| 3 | Clients, create client, client profile, buyer preferences | ✅ |
| 4 | Properties, create property, property profile, photos | ✅ |
| 5 | Tours, tour creation, scheduling/reordering stops | ✅ |
| 6 | Showing Mode: start, reactions, notes (+ dictation), photos, recording w/ consent, end | ✅ |
| 7 | `analyze-showing` Edge Function (OpenAI, structured JSON, Whisper transcription) | ✅ needs `OPENAI_API_KEY` secret |
| 8 | Property score, preference learning, AI tasks + Buyer Intelligence Engine (Prompt 3) | ✅ |
| 9 | Compare 2–6 homes (table / mobile swipe), highlights, saved comparisons | ✅ |
| 10 | Mortgage calculator (`web/src/lib/mortgage.ts`), saved scenarios | ✅ |
| 11 | AI follow-up generator (`generate-followup`), Messages page — drafts only, never auto-sent | ✅ |
| 12 | Buyer portal (`/portal`): invite links, shared homes, tours, ratings, household view, compare, messages | ✅ |
| 13 | Stripe architecture: `billing` (checkout/portal/status), `stripe-webhook`, 14-day trial gate, plans page | ✅ connected (test mode, Stripe account Keymivo LLC) |
| 14 | Super Admin dashboard (`/admin`, `admin_metrics()` RPC) | ✅ |

Pages for later steps (Offers, Reports, Integrations) are honest
"coming next" screens — no fake buttons or fake integrations.

## AI

`supabase/functions/analyze-showing` — called after END SHOWING. Uses the caller's JWT so all reads/writes
go through RLS. Secrets (Supabase → Edge Functions → Secrets): `OPENAI_API_KEY` (required),
`OPENAI_MODEL` (default `gpt-4.1-mini`), `OPENAI_TRANSCRIBE_MODEL` (default `whisper-1`).
Re-running is idempotent. Preference changes are stored as suggestions; the Realtor accepts/rejects/edits.
`supabase/functions/analyze-preferences` — Buyer Preference Agent: looks across all of a buyer's showings,
writes the "What We've Learned" narrative and cross-showing preference suggestions (client-level `ai_insights`).
Runs automatically when the client's Intelligence tab is opened and a newer analyzed showing exists.
The Buyer Confidence Profile and "consistently love/reject" lists are computed deterministically in
`web/src/lib/intelligence.ts` (stated weight blended with observed reactions; no AI).

Buyer Match = 30% must-haves, 20% price, 15% location, 10% size, 10% condition, 10% financial, 5% reaction.

## Buyer portal

- Realtor: Client → Household → **Invite** creates a private 30-day link (`/portal/join?token=…`). Nothing is emailed automatically.
- Buyers have **no direct table access**. They read via `portal_data()` and write via `portal_rate_property()` /
  `portal_send_message()` (SECURITY DEFINER, scoped to their own client). Visible homes = explicitly shared
  (`portal_shares`) ∪ on their tours ∪ showed. Realtor notes and AI analysis are never exposed.
- Ratings (1–5 stars × 7 categories + Love/Like/Maybe/Pass/Discuss Offer) are mirrored into `buyer_reactions`
  (source `buyer`) and update the Buyer Match "buyer reaction" component, so comparisons and learning update.
- Household view: per-member score, "Where you agree" (all ≥4★, spread ≤1), "Different opinions" (spread ≥2).

## Billing (Stripe)

Supabase → Edge Functions → Secrets: `STRIPE_SECRET_KEY` (sk_test_… in development), `STRIPE_PRICE_PRO`,
`STRIPE_PRICE_TEAM` (recurring monthly Price IDs), `STRIPE_WEBHOOK_SECRET`.
Stripe webhook endpoint: `https://ymilfkgnbrpmgmxghvqt.supabase.co/functions/v1/stripe-webhook` with events
`checkout.session.completed`, `customer.subscription.created|updated|deleted`.
Subscription columns are only writable by Edge Functions (service role). Trial expiry is derived in
`web/src/lib/billing.ts`; expired orgs see an upgrade screen, data is never deleted.

## Field-ready features

- **AI listing import** (`extract-listing`): upload an MLS printout/flyer/screenshot on *Add property*; fields are pre-filled
  for review. Tax/HOA period conversions are computed in code.
- **Calendar sync** (`calendar`, public, token-guarded): Settings → Calendar sync gives a private ICS link
  (Google/Apple/Outlook). Tokens live in `calendar_feeds` (RLS, no policies).
- **Notifications**: `notifications` table filled by DB triggers (buyer rating, offer interest, buyer message, portal join);
  bell in the app shell, polled every 60 s.
- **Offline Showing Mode**: captures queue in IndexedDB (`web/src/lib/offlineQueue.ts`) and sync via
  `web/src/features/offlineSync.ts`; `public/sw.js` caches the app shell.
- **Teams** (`/settings/team`), **tour summary**, **data export/delete** (`account`), legal drafts (`/terms`, `/privacy`).

## Demo data

Settings → **Load demo data** (or the onboarding screen) seeds Mike & Sarah Johnson, five
Massachusetts homes with playbook scores, and a Saturday tour. Everything is flagged `is_demo`,
badged **DEMO** in the UI, and removable from Settings.

## Android (Google Play)
`android/` is a Trusted Web Activity (package `com.keymivo.app`) that opens https://app.keymivo.com full screen.
- Build: `cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew :app:bundleRelease` → `app/build/outputs/bundle/release/app-release.aab`.
- Upload key: `~/Documents/keymivo-android-keys/` (keystore + key.properties, **not in git — back it up**). Bump `versionCode` in `app/build.gradle.kts` for every upload.
- Domain verification: `web/public/.well-known/assetlinks.json`. After the first upload, add Play Console's **App signing key** SHA-256 there too.
- Store assets: `android/store/` (512 icon, 1024×500 feature graphic).
