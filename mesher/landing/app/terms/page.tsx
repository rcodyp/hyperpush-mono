"use client"

import { LegalPage, Section, SubSection, LegalList, InfoBox } from "@/components/legal/legal-page"
import { GITHUB_DISPLAY } from "@/lib/external-links"

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="March 27, 2026">
      <InfoBox>
        <strong className="text-foreground">Summary:</strong> Use hyperpush in good faith. Don&apos;t abuse
        the platform, the bounty system, or other users. Free tiers are genuinely free — paid
        tiers give you more volume and AI features.
      </InfoBox>

      <Section number="1" title="Acceptance of Terms" id="acceptance">
        <p>
          By accessing or using the hyperpush platform, including the hosted service at hyperpush.dev,
          self-hosted installations, SDKs, APIs, documentation, and related services (collectively,
          the &quot;Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;).
        </p>
        <p>
          If you are using the Service on behalf of an organization, you represent that you have the
          authority to bind that organization to these Terms.
        </p>
      </Section>

      <Section number="2" title="Description of Service" id="description">
        <p>
          hyperpush provides an open-source error tracking platform with optional token economics
          for Solana-based projects. The Service includes:
        </p>
        <LegalList items={[
          "Error capture, aggregation, and alerting for web applications and Solana programs",
          "SDKs for JavaScript/TypeScript, Rust, Python, Node.js, and Mesh",
          "Public bug boards with bounty systems",
          "Project token launch and treasury management",
          "AI-powered error analysis (paid tiers)",
          "Self-hosting support and documentation",
        ]} />
      </Section>

      <Section number="3" title="Account Registration" id="account">
        <p>
          To use certain features of the Service, you must create an account. You agree to:
        </p>
        <LegalList items={[
          "Provide accurate and complete registration information",
          "Maintain the security of your account credentials",
          "Notify us immediately of any unauthorized access",
          "Accept responsibility for all activity under your account",
        ]} />
        <p>
          You must be at least 18 years old (or the legal age of majority in your jurisdiction)
          to create an account.
        </p>
      </Section>

      <Section number="4" title="Acceptable Use" id="acceptable-use">
        <p>
          You agree not to use the Service to:
        </p>
        <LegalList items={[
          "Violate any applicable law or regulation",
          "Infringe on the intellectual property rights of others",
          "Transmit malware, spam, or malicious content",
          "Abuse the bounty system through fraudulent bug reports or sham pull requests",
          "Manipulate token prices through artificial trading or wash trading",
          "Attempt to access other users' accounts or data without authorization",
          "Interfere with the operation of the Service or its infrastructure",
          "Scrape or harvest data from the Service for unauthorized purposes",
          "Use the Service to build a competing product without contributing upstream",
        ]} />
      </Section>

      <Section number="5" title="Plans & Billing" id="billing">
        <SubSection title="Free Tier">
          <p>
            The Open Source tier is free with a limit of 10,000 events per month. No credit card
            is required. Free tier access includes error tracking, project token launch, public bug
            board listing, and community bounties.
          </p>
        </SubSection>

        <SubSection title="Paid Tiers">
          <p>
            Pro ($29/month) and Pro+ ($100/month) tiers provide additional features including AI
            analysis, Solana program monitoring, higher event volumes, and extended data retention.
          </p>
          <LegalList items={[
            "Billing is monthly, charged at the beginning of each billing period",
            "You may cancel at any time — access continues through the end of the paid period",
            "Downgrades take effect at the next billing cycle",
            "We do not offer refunds for partial months",
            "Event overages are soft-capped — we notify you rather than cutting off ingestion",
          ]} />
        </SubSection>

        <SubSection title="OSS Launch Program">
          <p>
            Qualifying open-source projects may receive the Pro tier free for 6 months.
            Eligibility requires a public GitHub repository with active maintenance. hyperpush
            reserves the right to verify eligibility and revoke access if requirements are no
            longer met.
          </p>
        </SubSection>
      </Section>

      <Section number="6" title="Token Economics" id="token-economics">
        <SubSection title="Project Tokens">
          <p>
            Projects may launch a token through hyperpush at no cost. Token creation is facilitated
            on the Solana blockchain. You acknowledge that:
          </p>
          <LegalList items={[
            "hyperpush does not provide investment advice — tokens are utility instruments for the bounty system",
            "Token values may fluctuate — hyperpush makes no guarantees about token price or liquidity",
            "Trading fees fund the project treasury automatically — hyperpush takes a protocol fee",
            "On-chain transactions are irreversible",
          ]} />
        </SubSection>

        <SubSection title="Bounty Payouts">
          <p>
            Bounties are distributed in project tokens to the wallet address provided by the
            developer. hyperpush acts as an escrow during the verification period. Payouts are
            processed after your team verifies and merges the submitted pull request.
          </p>
        </SubSection>
      </Section>

      <Section number="7" title="Intellectual Property" id="ip">
        <SubSection title="Your Data">
          <p>
            You retain all ownership rights to your error data, application code, and content
            submitted to the Service. By using hyperpush, you grant us a limited license to process
            your data as needed to provide the Service.
          </p>
        </SubSection>

        <SubSection title="hyperpush Platform">
          <p>
            The hyperpush platform is open-source software licensed under the AGPL-3.0 license
            (see our <a href="/license" className="text-accent hover:underline">License page</a> for
            details). The hyperpush name, logo, and brand identity are trademarks of hyperpush and may
            not be used without permission.
          </p>
        </SubSection>
      </Section>

      <Section number="8" title="Bug Board & Contributions" id="bug-board">
        <p>
          If you participate in the public bug board as a contributor:
        </p>
        <LegalList items={[
          "Claimed bounties must be completed within a reasonable timeframe — unclaimed bounties may be reassigned after 7 days of inactivity",
          "Pull requests must meaningfully address the reported error",
          "The project maintainer has final authority on whether a fix is accepted",
          "Bounty payouts are final once the transaction is confirmed on-chain",
          "Gaming the system (e.g. creating bugs to claim your own bounties) is grounds for account termination",
        ]} />
      </Section>

      <Section number="9" title="Disclaimer of Warranties" id="warranties">
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND,
          EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
        </p>
        <p>
          We do not guarantee that the Service will be uninterrupted, error-free, or secure.
          We do not guarantee the accuracy of AI-generated error analysis or fix suggestions.
        </p>
      </Section>

      <Section number="10" title="Limitation of Liability" id="liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, HYPERPUSH SHALL NOT BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED
          TO LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES, ARISING FROM YOUR USE OF THE
          SERVICE.
        </p>
        <p>
          Our total liability for any claim arising from these Terms or the Service shall not
          exceed the greater of (a) the amount you paid us in the 12 months preceding the claim,
          or (b) $100.
        </p>
      </Section>

      <Section number="11" title="Termination" id="termination">
        <p>
          You may terminate your account at any time through the dashboard or by emailing
          support@hyperpush.dev. We may suspend or terminate your access if you violate these Terms,
          with notice when practicable.
        </p>
        <p>
          Upon termination, your right to use the Service ceases immediately. Error data is
          deleted according to the retention schedule in our Privacy Policy. On-chain transaction
          records cannot be deleted.
        </p>
      </Section>

      <Section number="12" title="Governing Law" id="governing-law">
        <p>
          These Terms are governed by the laws of the State of Delaware, United States, without
          regard to conflict of law provisions. Any disputes arising from these Terms shall be
          resolved in the state or federal courts located in Delaware.
        </p>
      </Section>

      <Section number="13" title="Changes to Terms" id="changes">
        <p>
          We may modify these Terms at any time. Material changes will be communicated via email
          and a notice on our website at least 30 days before taking effect. Continued use of the
          Service after changes take effect constitutes acceptance of the updated Terms.
        </p>
      </Section>

      <Section number="14" title="Contact" id="contact">
        <p>For questions about these Terms:</p>
        <LegalList items={[
          "Email: legal@hyperpush.dev",
          `GitHub: ${GITHUB_DISPLAY}`,
        ]} />
      </Section>
    </LegalPage>
  )
}
