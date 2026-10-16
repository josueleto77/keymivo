# Google OAuth verification — Keymivo

Google Cloud project: `tidy-simplicity-510715-r1` (account jgalindo@keymivo.com) · OAuth client "Keymivo Web".

## Already configured
| Item | Value |
|---|---|
| App name | Keymivo |
| User support / developer contact | jgalindo@keymivo.com |
| Home page | https://keymivo.com |
| Privacy policy | https://app.keymivo.com/privacy (includes the Google API Limited Use disclosure, section 3a) |
| Terms of service | https://app.keymivo.com/terms |
| Authorized domain | keymivo.com (verified in Search Console) |
| Redirect URI | https://app.keymivo.com/oauth/google/callback |
| Logo | none (a logo adds a separate brand review; not needed) |
| Scopes | `openid`, `userinfo.email` (non-sensitive) · `gmail.send`, `calendar.events` (**sensitive**, no restricted scopes → no CASA assessment) |

## Scope justifications (paste into the verification form)

**https://www.googleapis.com/auth/gmail.send**
> Keymivo is a workspace for real estate buyer's agents. After a home showing, Keymivo drafts a follow-up email to the agent's client. The agent reviews and edits the draft, then clicks "Send from Gmail" so the email is sent from the agent's own Gmail address and replies go to them. Keymivo also lets the agent email a private portal invitation to their client the same way. We only send messages the agent explicitly chooses to send, to the recipient shown before sending. We never read, list or modify the agent's mailbox, so gmail.send is the narrowest scope that supports this feature.

**https://www.googleapis.com/auth/calendar.events**
> Agents plan home tours in Keymivo (a list of homes with showing times). When the agent clicks "Sync to Google Calendar" on a tour, Keymivo creates one event per showing (address, time, client name and a link back to the tour) in the agent's primary calendar, updates those same events when the tour changes and deletes them if the tour is cancelled. We only touch events Keymivo created; we do not read or modify other events. calendar.events is the narrowest scope that allows creating and updating events.

## Demo video (unlisted YouTube link, 2–4 minutes, English UI)
Record the screen at https://app.keymivo.com while signed in as an agent. Google checks that the OAuth consent screen and each scope's use are shown.
1. **(0:00)** Show the browser address bar on https://keymivo.com, then go to app.keymivo.com and sign in. Say: "Keymivo is an assistant for real estate buyer's agents."
2. **Settings → Integrations.** Click **Connect Google**.
3. On Google's consent screen, **show the full screen**: the app name "Keymivo", the account, and both permissions ("Send email on your behalf", "View and edit events on all your calendars"). Make sure the **URL bar shows the OAuth client ID** (`client_id=448192989793-...`). Click Continue.
4. Back in Keymivo, show the Gmail and Google Calendar tiles marked **Connected**.
5. **gmail.send:** open **Messages**, open a follow-up draft for a client whose email is yours, edit one line, click **Send from Gmail**, confirm. Then open your Gmail **Sent** folder and show the email.
6. **calendar.events:** open **Tours**, open a tour with timed stops, click **Sync to Google Calendar**. Then open Google Calendar and show the created events (address, time, link to Keymivo).
7. Change a stop time, click **Update Google Calendar**, and show the event moved.
8. **Integrations → Disconnect** Google, to show users can revoke access.

## Submit
1. Google Cloud → **Google Auth Platform → Audience → Publish app** (moves from Testing to In production).
2. **Verification Center → Prepare for verification**: confirm branding, paste the justifications above, add the video link, submit.
3. Google usually replies by email within 3–5 business days with questions, and completes verification in 2–6 weeks. Answer from jgalindo@keymivo.com.

While unverified (after publishing), users see an "unverified app" warning and the app is limited to 100 users; existing test users keep working.
