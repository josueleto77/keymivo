import type * as React from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/brand/Logo'

const UPDATED = 'October 8, 2026'

function LegalLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background px-5 py-8">
      <div className="mx-auto max-w-3xl">
        <Link to="/"><Logo /></Link>
        <div className="mt-8 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <b>Draft — pending legal review.</b> This document is a working draft and has not yet been reviewed by an attorney.
        </div>
        <h1 className="mt-8 font-display text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">Last updated {UPDATED}</p>
        <div className="prose-legal mt-8 space-y-6 text-[15px] leading-relaxed text-slate-700 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
          {children}
        </div>
        <p className="mt-12 text-sm text-muted">
          <Link to="/terms" className="underline">Terms of Service</Link> · <Link to="/privacy" className="underline">Privacy Policy</Link>
        </p>
      </div>
    </div>
  )
}

export function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <p>These Terms govern your use of Keymivo (the “Service”), provided by Keymivo LLC (“Keymivo”, “we”). By creating an account you agree to these Terms.</p>

      <h2>1. Who can use Keymivo</h2>
      <p>The Realtor workspace is intended for licensed real estate professionals and their teams. The buyer portal is for buyers invited by their agent. You must be at least 18 and provide accurate account information.</p>

      <h2>2. Your responsibilities</h2>
      <ul>
        <li><b>Recording consent.</b> You must obtain every legally required consent before recording any conversation. Several states, including <b>Massachusetts (M.G.L. c. 272, § 99)</b>, require the consent of <b>all</b> parties. Keymivo asks you to confirm consent before each recording; you remain responsible for obtaining it.</li>
        <li><b>Fair housing.</b> You must comply with the Fair Housing Act and state anti-discrimination laws. Do not use the Service to steer buyers or to record, infer or act on protected characteristics.</li>
        <li><b>Data you enter.</b> You are responsible for having the right to enter client and property information, including MLS data under your MLS’s rules, and for keeping your login secure.</li>
        <li><b>Communications.</b> Keymivo drafts messages but never sends email or text on your behalf. You are responsible for messages you send, including compliance with the TCPA and CAN-SPAM.</li>
      </ul>

      <h2>3. AI features</h2>
      <p>AI-generated summaries, scores, preference suggestions, follow-ups and analyses are informational. They may be incomplete or wrong. They are not legal, tax, lending, appraisal, inspection or engineering advice, and they do not guarantee any outcome, including seller acceptance of an offer. Review AI output before relying on it.</p>

      <h2>4. Plans, trials and billing</h2>
      <ul>
        <li>New organizations receive a 14-day free trial of the Pro plan.</li>
        <li>Paid plans renew monthly until cancelled. You can cancel anytime from Settings → Billing; access continues until the end of the paid period.</li>
        <li>Payments are processed by Stripe. Prices may change with 30 days’ notice.</li>
        <li>When a trial or subscription ends, your data is kept and you can regain access by subscribing.</li>
      </ul>

      <h2>5. Your data</h2>
      <p>You own the data you put into Keymivo. You grant us the limited rights needed to host, process and display it to provide the Service. You can export or delete your data at any time from Settings. See our <Link to="/privacy" className="underline">Privacy Policy</Link>.</p>

      <h2>6. Acceptable use</h2>
      <p>Do not misuse the Service: no unlawful activity, no attempts to access other organizations’ data, no scraping of third-party sites through the Service, and no interference with its security or operation.</p>

      <h2>7. Termination</h2>
      <p>You may stop using the Service at any time. We may suspend accounts that violate these Terms, with notice where practical.</p>

      <h2>8. Disclaimers and limitation of liability</h2>
      <p>The Service is provided “as is”. To the maximum extent permitted by law, Keymivo is not liable for indirect, incidental or consequential damages, and our total liability is limited to the amounts you paid us in the 12 months before the claim.</p>

      <h2>9. Governing law</h2>
      <p>These Terms are governed by the laws of the Commonwealth of Massachusetts, without regard to conflict-of-law rules.</p>

      <h2>10. Contact</h2>
      <p>Keymivo LLC · [business address] · [support email]</p>
    </LegalLayout>
  )
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <p>This policy explains what Keymivo LLC collects, why, and the choices you have.</p>

      <h2>1. What we collect</h2>
      <ul>
        <li><b>Account data:</b> name, email, phone, brokerage, license state and number.</li>
        <li><b>Client and property data</b> entered by Realtors: buyer contact details, budget and financing preferences, property details, tours, showing notes, reactions, photos and, when consent is confirmed, audio recordings and transcripts.</li>
        <li><b>Buyer portal data:</b> ratings, comments and messages buyers choose to share with their agent.</li>
        <li><b>Billing data:</b> handled by Stripe; we store only customer and subscription identifiers, never full card numbers.</li>
        <li><b>Usage and security logs:</b> actions taken in the app (an audit trail) and technical logs.</li>
      </ul>

      <h2>2. How we use it</h2>
      <p>To provide the Service: organizing showings, generating AI summaries and Buyer Match scores, comparisons, follow-up drafts, the buyer portal and billing. We do not sell personal information and do not use it for advertising.</p>

      <h2>3. Service providers</h2>
      <ul>
        <li><b>Supabase</b> — database, authentication and file storage (United States).</li>
        <li><b>OpenAI</b> — AI analysis and transcription of showing content you choose to analyze.</li>
        <li><b>Stripe</b> — payments.</li>
        <li><b>Vercel</b> — web hosting.</li>
        <li><b>Google Maps Platform</b> — address search, maps and drive times for properties and tours.</li>
        <li><b>Resend</b> — account and invitation emails sent by Keymivo.</li>
        <li><b>Integrations you connect</b> (Google, Follow Up Boss) — only when you connect them; see below.</li>
      </ul>

      <h2>3a. Google user data (Gmail and Google Calendar)</h2>
      <p>If you connect your Google account, Keymivo requests only two permissions: <b>send email on your behalf</b> (gmail.send) and <b>create and edit calendar events</b> (calendar.events), plus your email address to show which account is connected.</p>
      <ul>
        <li>We use Gmail only to send messages you explicitly choose to send from Keymivo (for example a follow-up or a buyer invitation), to the recipient you see before sending. We cannot read your inbox.</li>
        <li>We use Google Calendar only to create or update the events for tours you choose to sync, and to remove events Keymivo created.</li>
        <li>Your Google access token is stored encrypted and used only by our servers for these actions. You can disconnect at any time in Integrations, which revokes Keymivo's access.</li>
        <li>Keymivo's use and transfer of information received from Google APIs adheres to the <a className="underline" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements. We do not use Google user data for advertising, do not sell it, do not transfer it to others except as needed to provide these features, and do not use it to train AI models.</li>
      </ul>

      <h2>4. Fair housing</h2>
      <p>Keymivo’s AI is instructed to use only objective property criteria and never to infer or use protected characteristics such as race, color, religion, national origin, sex, familial status or disability.</p>

      <h2>5. Who can see what</h2>
      <p>Each organization’s data is isolated from other organizations. Buyers see only what their agent shares with them and their own household’s ratings and messages — never the agent’s private notes or AI analysis. Photos, recordings and documents are stored privately and served through expiring links.</p>

      <h2>6. Retention, export and deletion</h2>
      <p>We keep your data while your account is active. You can export it or permanently delete your account at any time from Settings (Realtors) or the portal home (buyers). Recordings can be deleted individually from a showing. Backups are purged within 30 days. See <a className="underline" href="/delete-account">how to delete your account</a>, including if you can no longer sign in.</p>

      <h2>7. Security</h2>
      <p>Data is encrypted in transit; access is enforced with row-level security and role-based permissions; secrets are kept server-side.</p>

      <h2>8. Your rights</h2>
      <p>Depending on where you live, you may have rights to access, correct, delete or port your data. Contact us to exercise them.</p>

      <h2>9. Contact</h2>
      <p>Keymivo LLC · Massachusetts, USA · <a className="underline" href="mailto:privacy@keymivo.com">privacy@keymivo.com</a></p>
    </LegalLayout>
  )
}

/** Public account-deletion instructions (required by Google Play: reachable without installing the app). */
export function DeleteAccountPage() {
  return (
    <LegalLayout title="Delete your Keymivo account">
      <p>You can delete your Keymivo account and its data at any time.</p>

      <h2>Realtors and team leaders</h2>
      <ul>
        <li>Sign in at <a className="underline" href="https://app.keymivo.com/settings">app.keymivo.com</a> and open <b>Settings</b>.</li>
        <li>Under <b>Your data</b>, click <b>Delete account</b> and confirm. Optionally click <b>Export data</b> first to download a copy.</li>
        <li>If you own the organization, this permanently deletes the organization and everything in it: clients, properties, tours, showings, notes, photos, recordings, AI insights and offer analyses. Any subscription is cancelled.</li>
      </ul>

      <h2>Buyers (portal accounts)</h2>
      <ul>
        <li>Sign in to your portal, open <b>Home</b>, and use <b>Delete account</b> under your privacy settings; or ask your agent to remove you.</li>
        <li>This deletes your login and your ratings and messages in the portal. Your agent keeps their own records about your home search.</li>
      </ul>

      <h2>Can't sign in?</h2>
      <p>Email <a className="underline" href="mailto:privacy@keymivo.com?subject=Delete%20my%20Keymivo%20account">privacy@keymivo.com</a> from the address on your account with the subject “Delete my Keymivo account”. We confirm and complete the deletion within 30 days.</p>

      <h2>What we keep</h2>
      <p>Deleted data is removed from our active systems immediately and from backups within 30 days. We keep billing records (invoices and payment history held by our payment processor) as required by tax law, and minimal security logs for up to 90 days.</p>
    </LegalLayout>
  )
}
