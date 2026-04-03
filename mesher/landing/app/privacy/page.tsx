"use client"

import { LegalPage, Section, SubSection, LegalList, InfoBox } from "@/components/legal/legal-page"
import { GITHUB_DISPLAY } from "@/lib/external-links"

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="March 27, 2026">
      <InfoBox>
        <strong className="text-foreground">Summary:</strong> We collect only what&apos;s needed to provide
        the service. We never sell your data. Error data you send us is yours — you can delete it
        anytime. We use no third-party ad trackers.
      </InfoBox>

      <Section number="1" title="Introduction" id="introduction">
        <p>
          hyperpush (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the hyperpush error tracking platform,
          including the hosted service at hyperpush.dev, self-hosted installations, SDKs, APIs, and related
          documentation (collectively, the &quot;Service&quot;).
        </p>
        <p>
          This Privacy Policy explains how we collect, use, share, and protect information when you
          use our Service. By using hyperpush, you agree to the collection and use of information in
          accordance with this policy.
        </p>
      </Section>

      <Section number="2" title="Information We Collect" id="information-collected">
        <SubSection title="Account Information">
          <p>When you create a hyperpush account, we collect:</p>
          <LegalList items={[
            "Email address",
            "Display name or username",
            "Organization or project name",
            "Solana wallet address (if you opt into token economics)",
            "Authentication credentials (hashed — we never store plaintext passwords)",
          ]} />
        </SubSection>

        <SubSection title="Error & Event Data">
          <p>When your application sends events to hyperpush, we may receive:</p>
          <LegalList items={[
            "Stack traces and exception details",
            "Browser or runtime metadata (user agent, OS, device info)",
            "Request URLs and HTTP headers",
            "Application environment tags (e.g. production, staging)",
            "Performance traces and timing data",
            "Solana transaction signatures and program log output",
            "Custom context and tags you attach to events",
          ]} />
        </SubSection>

        <SubSection title="Usage Data">
          <p>We automatically collect basic usage analytics:</p>
          <LegalList items={[
            "Pages viewed within the hyperpush dashboard",
            "Feature usage patterns (aggregated, not individual)",
            "API request volumes and error rates",
            "Session duration and frequency",
          ]} />
        </SubSection>
      </Section>

      <Section number="3" title="How We Use Your Information" id="how-we-use">
        <p>We use collected information to:</p>
        <LegalList items={[
          "Provide, maintain, and improve the Service",
          "Process and display error events in your dashboard",
          "Route bounty payments to developers via Solana",
          "Send transactional emails (alerts, account notifications)",
          "Detect abuse, fraud, and security incidents",
          "Generate aggregated, anonymized usage statistics",
          "Provide AI-powered error analysis on paid tiers",
        ]} />
      </Section>

      <Section number="4" title="Data Sharing" id="data-sharing">
        <p>
          <strong className="text-foreground">We never sell your personal data.</strong> We share information only in the following
          limited circumstances:
        </p>
        <LegalList items={[
          "Public Bug Board: If you opt in, error titles and metadata are visible publicly. Stack traces and sensitive details are redacted by default.",
          "Service providers: We use infrastructure providers (hosting, email delivery) who process data on our behalf under strict contractual obligations.",
          "Legal compliance: We may disclose information if required by law, subpoena, or valid legal process.",
          "Business transfer: In the event of a merger or acquisition, data may be transferred to the successor entity.",
        ]} />
      </Section>

      <Section number="5" title="Solana & Blockchain Data" id="blockchain-data">
        <p>
          If you use token economics features, certain information is recorded on the Solana
          blockchain. On-chain data (wallet addresses, transaction signatures, bounty payouts) is
          <strong className="text-foreground"> inherently public and immutable</strong>. We cannot delete
          or modify on-chain records.
        </p>
        <p>
          We never post personal information (email, name) on-chain. Only wallet addresses and
          payment amounts are recorded in smart contract transactions.
        </p>
      </Section>

      <Section number="6" title="Data Retention" id="data-retention">
        <p>
          Error event data is retained according to your plan tier:
        </p>
        <LegalList items={[
          "Open Source: 30-day retention",
          "Pro: 60-day retention",
          "Pro+: 90-day retention",
        ]} />
        <p>
          Account data is retained for the duration of your account. You may request deletion of
          your account and associated data at any time by emailing privacy@hyperpush.dev.
        </p>
      </Section>

      <Section number="7" title="Data Security" id="data-security">
        <p>We protect your data using industry-standard measures:</p>
        <LegalList items={[
          "TLS 1.3 encryption in transit for all connections",
          "AES-256 encryption at rest for stored data",
          "SOC 2 Type II compliant infrastructure providers",
          "Role-based access controls and audit logging",
          "Regular security assessments and penetration testing",
        ]} />
      </Section>

      <Section number="8" title="Your Rights" id="your-rights">
        <p>Depending on your jurisdiction, you may have the right to:</p>
        <LegalList items={[
          "Access the personal data we hold about you",
          "Correct inaccurate data",
          "Delete your data (\"right to be forgotten\")",
          "Export your data in a portable format",
          "Object to or restrict certain processing",
          "Withdraw consent at any time",
        ]} />
        <p>
          To exercise any of these rights, contact us at{" "}
          <span className="text-accent">privacy@hyperpush.dev</span>. We respond within 30 days.
        </p>
      </Section>

      <Section number="9" title="Cookies" id="cookies">
        <p>
          hyperpush uses only essential cookies required for authentication and session management.
          We do not use advertising cookies or third-party tracking pixels. Our analytics use
          privacy-respecting, cookie-free measurement via Vercel Analytics.
        </p>
      </Section>

      <Section number="10" title="Changes to This Policy" id="changes">
        <p>
          We may update this Privacy Policy from time to time. Material changes will be
          communicated via email to account holders and a notice on our website at least 30 days
          before taking effect.
        </p>
      </Section>

      <Section number="11" title="Contact" id="contact">
        <p>
          For questions about this Privacy Policy or our data practices:
        </p>
        <LegalList items={[
          "Email: privacy@hyperpush.dev",
          `GitHub: ${GITHUB_DISPLAY}`,
        ]} />
      </Section>
    </LegalPage>
  )
}
