"use client"

import { LegalPage, Section, SubSection, LegalList, InfoBox } from "@/components/legal/legal-page"
import { GITHUB_DISPLAY } from "@/lib/external-links"

export default function LicensePage() {
  return (
    <LegalPage title="License" lastUpdated="March 27, 2026">
      <InfoBox>
        <strong className="text-foreground">Summary:</strong> hyperpush core is AGPL-3.0 — you can use,
        modify, and self-host it freely, but derivatives must also be open source. SDKs are MIT-licensed
        for maximum flexibility. Commercial licensing is available for proprietary use cases.
      </InfoBox>

      <Section number="1" title="Overview" id="overview">
        <p>
          hyperpush uses a dual-license model designed to keep the core platform open source while
          giving SDK users maximum freedom. This approach ensures the platform stays open and
          community-driven while allowing developers to integrate hyperpush into any project without
          license concerns.
        </p>

        <div className="mt-6 grid sm:grid-cols-2 gap-px bg-border rounded-xl overflow-hidden">
          <div className="bg-background p-6">
            <p className="text-xs font-mono text-accent uppercase tracking-wider mb-2">Core Platform</p>
            <p className="text-xl font-bold text-foreground mb-2">AGPL-3.0</p>
            <p className="text-sm text-muted-foreground">
              Server, dashboard, API, ingestion pipeline, bug board, and token economics engine.
            </p>
          </div>
          <div className="bg-background p-6">
            <p className="text-xs font-mono text-accent uppercase tracking-wider mb-2">Client SDKs</p>
            <p className="text-xl font-bold text-foreground mb-2">MIT</p>
            <p className="text-sm text-muted-foreground">
              JavaScript/TypeScript, Rust, Python, Node.js, and Mesh SDKs.
            </p>
          </div>
        </div>
      </Section>

      <Section number="2" title="AGPL-3.0 — Core Platform" id="agpl">
        <p>
          The hyperpush core platform is licensed under the{" "}
          <strong className="text-foreground">GNU Affero General Public License v3.0</strong> (AGPL-3.0).
          This means:
        </p>

        <SubSection title="You Can">
          <LegalList items={[
            "Use hyperpush for any purpose, including commercial use",
            "Self-host hyperpush on your own infrastructure",
            "Modify the source code to suit your needs",
            "Distribute copies of hyperpush",
            "Offer hyperpush as a hosted service to others",
          ]} />
        </SubSection>

        <SubSection title="You Must">
          <LegalList items={[
            "Disclose the source code of any modifications you make to hyperpush core",
            "License derivative works under AGPL-3.0",
            "Provide source code access to users who interact with your modified version over a network",
            "Preserve copyright and license notices in all copies",
            "Document changes you make to the original code",
          ]} />
        </SubSection>

        <SubSection title="Why AGPL-3.0?">
          <p>
            The AGPL ensures that improvements to the core platform benefit the entire community.
            If someone builds a competing hosted service on hyperpush, they must contribute their
            improvements back. This creates a level playing field and keeps the ecosystem healthy.
          </p>
        </SubSection>
      </Section>

      <Section number="3" title="MIT — Client SDKs" id="mit">
        <p>
          All hyperpush client SDKs are licensed under the <strong className="text-foreground">MIT License</strong>.
          This is intentionally permissive — we want zero friction for developers integrating
          hyperpush into their applications.
        </p>

        <SubSection title="What This Means">
          <LegalList items={[
            "Use the SDKs in any project — open source or proprietary",
            "No obligation to disclose your application's source code",
            "Modify the SDKs as needed with no copyleft requirements",
            "Bundle the SDKs in commercial software without restrictions",
            "The only requirement is preserving the MIT license notice in copies",
          ]} />
        </SubSection>

        <SubSection title="Covered Packages">
          <div className="mt-3 rounded-xl border border-border overflow-hidden">
            {[
              { pkg: "@hyperpush/sdk", language: "JavaScript / TypeScript", license: "MIT" },
              { pkg: "@hyperpush/node", language: "Node.js", license: "MIT" },
              { pkg: "hyperpush-rs", language: "Rust", license: "MIT" },
              { pkg: "hyperpush-python", language: "Python", license: "MIT" },
              { pkg: "hyperpush-mesh", language: "Mesh", license: "MIT" },
            ].map((row, i) => (
              <div
                key={row.pkg}
                className={`flex items-center gap-4 p-4 ${i < 4 ? "border-b border-border" : ""}`}
              >
                <code className="text-sm font-mono text-foreground flex-1">{row.pkg}</code>
                <span className="text-sm text-muted-foreground hidden sm:block flex-1">{row.language}</span>
                <span className="text-xs font-mono text-accent bg-accent/10 px-2 py-0.5 rounded">
                  {row.license}
                </span>
              </div>
            ))}
          </div>
        </SubSection>
      </Section>

      <Section number="4" title="Commercial Licensing" id="commercial">
        <p>
          If the AGPL-3.0 license doesn&apos;t work for your use case — for example, if you want
          to embed hyperpush core in a proprietary product without open-sourcing your changes — we
          offer commercial licenses.
        </p>

        <SubSection title="Commercial License Includes">
          <LegalList items={[
            "Right to modify and distribute hyperpush core without AGPL obligations",
            "No requirement to disclose source code of derivative works",
            "Priority support and SLA guarantees",
            "Custom feature development (case by case)",
          ]} />
        </SubSection>

        <p className="mt-4">
          Contact{" "}
          <span className="text-accent">licensing@hyperpush.dev</span>{" "}
          to discuss commercial licensing.
        </p>
      </Section>

      <Section number="5" title="Contributor License Agreement" id="cla">
        <p>
          Contributors to the hyperpush repository agree to the following:
        </p>
        <LegalList items={[
          "You grant hyperpush a perpetual, worldwide, non-exclusive license to use your contributions",
          "You certify that you have the right to submit the contribution",
          "You agree that your contribution may be relicensed under the current project licenses",
          "Your contribution remains attributed to you in the project history",
        ]} />
        <p>
          We use a lightweight CLA — no legal paperwork required. By opening a pull request,
          you agree to these terms. This is standard practice for dual-licensed open-source projects
          and ensures we can maintain the SDK under MIT while keeping the core under AGPL.
        </p>
      </Section>

      <Section number="6" title="Third-Party Components" id="third-party">
        <p>
          hyperpush includes third-party open-source components. Each component retains its original
          license. A complete list of dependencies and their licenses is available in the{" "}
          <code className="text-sm bg-muted px-1.5 py-0.5 rounded font-mono">THIRD_PARTY_LICENSES</code>{" "}
          file in the repository root.
        </p>
      </Section>

      <Section number="7" title="Trademark" id="trademark">
        <p>
          The hyperpush name, logo, and brand identity are trademarks of hyperpush. The open-source
          licenses do not grant permission to use these trademarks. Specifically:
        </p>
        <LegalList items={[
          "You may state that your product is \"powered by hyperpush\" or \"compatible with hyperpush\"",
          "You may not use the hyperpush name or logo to imply official endorsement",
          "Forks and derivatives must use a different name and brand",
          "The hyperpush logo may be used in documentation and blog posts referencing the project",
        ]} />
      </Section>

      <Section number="8" title="Full License Texts" id="full-texts">
        <p>
          The complete license texts are available in the repository:
        </p>
        <LegalList items={[
          `AGPL-3.0: /LICENSE in the main repository under ${GITHUB_DISPLAY}`,
          `MIT: /LICENSE in each SDK repository under ${GITHUB_DISPLAY}`,
        ]} />
        <p>
          For questions about licensing, contact{" "}
          <span className="text-accent">licensing@hyperpush.dev</span>.
        </p>
      </Section>
    </LegalPage>
  )
}
