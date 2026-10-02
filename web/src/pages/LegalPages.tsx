import type * as React from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/brand/Logo'

const UPDATED = 'October 2, 2026'

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
      </ul>

      <h2>4. Fair housing</h2>
      <p>Keymivo’s AI is instructed to use only objective property criteria and never to infer or use protected characteristics such as race, color, religion, national origin, sex, familial status or disability.</p>

      <h2>5. Who can see what</h2>
      <p>Each organization’s data is isolated from other organizations. Buyers see only what their agent shares with them and their own household’s ratings and messages — never the agent’s private notes or AI analysis. Photos, recordings and documents are stored privately and served through expiring links.</p>

      <h2>6. Retention, export and deletion</h2>
      <p>We keep your data while your account is active. You can export it or permanently delete your account at any time from Settings (Realtors) or the portal home (buyers). Recordings can be deleted individually from a showing. Backups are purged on our provider’s backup cycle.</p>

      <h2>7. Security</h2>
      <p>Data is encrypted in transit; access is enforced with row-level security and role-based permissions; secrets are kept server-side.</p>

      <h2>8. Your rights</h2>
      <p>Depending on where you live, you may have rights to access, correct, delete or port your data. Contact us to exercise them.</p>

      <h2>9. Contact</h2>
      <p>Keymivo LLC · [business address] · [privacy email]</p>
    </LegalLayout>
  )
}
