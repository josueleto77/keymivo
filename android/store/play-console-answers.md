# Play Console — answers for Keymivo (com.keymivo.app)

Use these when Play Console asks. Section names match **Policy → App content** in Play Console.

## Store settings
- **App name:** Keymivo: AI for Buyer Agents · **Default language:** English (United States)
- **App or game:** App · **Free or paid:** Free (subscriptions are sold on the web, not in the app)
- **Category:** Business · **Tags:** Real estate, Productivity
- **Contact email:** support@keymivo.com (or jgalindo@keymivo.com) · **Website:** https://keymivo.com
- **Privacy policy:** https://app.keymivo.com/privacy

## Privacy policy
https://app.keymivo.com/privacy

## App access → "All or some functionality is restricted"
Instructions for reviewers:
> Keymivo is a workspace for licensed real estate agents; all features require sign-in. Use the demo account below — it is pre-loaded with a sample buyer, 5 sample homes, a tour, analyzed showings and an offer analysis (marked DEMO).
> Email: reviewer@keymivo.com · Password: (set when the reviewer account is created)

## Ads
**No**, the app does not contain ads.

## Content rating (IARC questionnaire)
- Category: **All other app types** (Utility, Productivity, Communication or Other)
- Violence, sexuality, language, controlled substances, gambling: **No** to all
- Does the app let users interact or exchange content? **Yes** — agents and their invited buyers exchange messages and ratings inside a private portal (not public, not anonymous).
- Shares user location with other users? **No** · Digital purchases? **No**
- Expected rating: Everyone / PEGI 3 (with "Users Interact")

## Target audience and content
- Target age group: **18 and over** only. Not designed for children.
- Appeals to children? **No**

## News app: **No** · COVID-19 contact tracing: **No** · Government app: **No**
## Financial features: **None** of the listed (it shows mortgage *estimates* only; no loans, banking, payments or crypto)
## Health apps: **No**

## Data safety
**Does the app collect or share required user data types?** Yes
**Is all user data encrypted in transit?** Yes
**Do you provide a way for users to request that their data is deleted?** Yes — in-app (Settings → Delete account) and https://app.keymivo.com/delete-account

Sharing: **No data is "shared"** in Play's sense — the providers we use (Supabase, OpenAI, Google Maps, Stripe, Resend, Vercel) act as service providers on our behalf, which Play does not count as sharing. Follow Up Boss / Google only receive data when the user connects them and asks to sync (user-initiated transfer).

| Data type | Collected | Optional? | Purposes |
|---|---|---|---|
| Personal info → Name | Yes | Required | App functionality, Account management |
| Personal info → Email address | Yes | Required | App functionality, Account management, Developer communications |
| Personal info → Phone number | Yes | Optional | App functionality |
| Personal info → Other info (license number, brokerage) | Yes | Optional | App functionality |
| Financial info → Other financial info (buyer budget, preapproval, down payment entered by the agent) | Yes | Optional | App functionality |
| Financial info → Purchase history (subscription status) | Yes | Required for paid plans | Account management |
| Messages → Other in-app messages (agent ↔ buyer portal messages, follow-up drafts) | Yes | Optional | App functionality |
| Photos and videos → Photos | Yes | Optional | App functionality |
| Audio → Voice or sound recordings (showing recordings, only after consent is confirmed) | Yes | Optional | App functionality |
| Files and docs (listing sheets uploaded for import) | Yes | Optional | App functionality |
| Calendar → Calendar events (tours synced to the user's Google Calendar) | Yes | Optional | App functionality |
| App activity → Other user-generated content (notes, ratings, preferences) | Yes | Optional | App functionality, Personalization |
| App info and performance → Crash/diagnostic logs | Yes | Required | App functionality (security/troubleshooting) |

Not collected: precise or approximate **device location** (property addresses are typed by the user), contacts, web browsing, health, SMS/call logs, device IDs, advertising IDs.

For every row: **Processed ephemerally?** No · **Collected, not shared**.

## Closed testing (required for personal developer accounts)
Before applying for production, Google requires a **closed test with at least 12 testers opted in for 14 continuous days**.
1. Testing → Closed testing → Create track "Beta" → upload the same .aab (bump versionCode if needed).
2. Testers: create an email list with ≥ 12 Google accounts (Android users). Share the opt-in link.
3. Keep them opted in for 14 days; ask them to open the app a few times.
4. Then: Dashboard → **Apply for production access** and answer the short questionnaire about the test.
