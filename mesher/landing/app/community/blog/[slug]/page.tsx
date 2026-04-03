"use client"

import { use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { CommunityLayout } from "@/components/community/community-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { WaitlistButton } from "@/components/landing/waitlist-dialog"
import { ArrowLeft, Clock, Share2 } from "lucide-react"
import { DISCORD_URL } from "@/lib/external-links"

const postsContent: Record<string, {
  title: string
  excerpt: string
  author: string
  authorAvatar: string
  date: string
  readTime: string
  category: string
  content: { type: "p" | "h2" | "h3" | "code" | "list"; text: string; items?: string[] }[]
}> = {
  "introducing-mesher": {
    title: "Introducing hyperpush: Open-Source Error Tracking That Funds Itself",
    excerpt: "We're building the error tracking platform we always wanted — open source, self-hostable, with built-in economics that fund projects and pay the developers who fix bugs.",
    author: "Core Team",
    authorAvatar: "CT",
    date: "March 24, 2026",
    readTime: "8 min read",
    category: "Announcement",
    content: [
      { type: "p", text: "Error tracking shouldn't be a cost center. Every open-source project needs it, but most can't afford the $29/month SaaS tools — and self-hosted alternatives require significant ops effort. We built hyperpush to solve both problems." },
      { type: "h2", text: "The Problem" },
      { type: "p", text: "Open-source software powers the internet, but maintaining it is thankless. Projects accumulate bugs faster than maintainers can fix them. Contributors want to help but have no incentive beyond goodwill. Error tracking tools that could surface and prioritize these bugs cost money that projects don't have." },
      { type: "p", text: "The result is a vicious cycle: bugs pile up, users lose trust, contributors move on, and projects stagnate." },
      { type: "h2", text: "Our Approach" },
      { type: "p", text: "hyperpush breaks this cycle by aligning incentives. Every project gets full error tracking for free. Projects that opt in can launch a token that funds their treasury through trading activity. That treasury funds bounties on bugs. Developers fix bugs and earn bounties. The project gets healthier, the developer gets paid, and the token gains value as the software improves." },
      { type: "h3", text: "What You Get on Day One" },
      { type: "list", text: "", items: [
        "Full error tracking — stack traces, session replays, performance monitoring, and alerts",
        "Solana program error tracking — transaction failures, CPI errors, RPC timeouts",
        "Public bug board — opt-in dashboard showing live errors with bounties",
        "Token economics — launch a project token that funds development",
        "GitHub PR verification — automated bounty distribution on merged fixes",
      ]},
      { type: "h2", text: "Built on Mesh" },
      { type: "p", text: "hyperpush runs on Mesh, a systems language with Elixir's fault-tolerant actor model and the raw speed of compiled code. Every error event is handled by its own lightweight process — millions of concurrent events, sub-millisecond spawn times, and supervision trees that self-heal on failure." },
      { type: "p", text: "We didn't choose Mesh because it's trendy. We chose it because error tracking at scale is fundamentally a concurrency problem, and Mesh's actor model is the best tool for that job." },
      { type: "h2", text: "What's Next" },
      { type: "p", text: "We're opening the waitlist today. The first 10 qualifying open-source projects get the full Pro tier free for 6 months. If you maintain an open-source project on Solana — or anywhere else — we'd love to have you." },
      { type: "p", text: "Star us on GitHub, join the Discord, or just sign up for the waitlist. We'll be shipping fast." },
    ],
  },
  "why-token-economics": {
    title: "Why We Chose Token Economics Over SaaS Pricing",
    excerpt: "Most open-source projects die from lack of funding. We explored every model — sponsorships, SaaS, foundations — before landing on token economics. Here's why.",
    author: "Core Team",
    authorAvatar: "CT",
    date: "March 20, 2026",
    readTime: "12 min read",
    category: "Deep Dive",
    content: [
      { type: "p", text: "Every open-source project faces the same question: how do you sustain development without compromising the open-source promise? We spent months evaluating every funding model before choosing token economics. This post explains our reasoning." },
      { type: "h2", text: "The Funding Graveyard" },
      { type: "p", text: "GitHub Sponsors averages $50/month for most projects. Foundations require years of governance overhead. Dual licensing creates perverse incentives. Open-core models inevitably move the best features behind paywalls. We needed something that scales with usage and aligns contributor incentives." },
      { type: "h2", text: "Why Tokens Work Here" },
      { type: "p", text: "Token economics aren't right for every project. But error tracking has a unique property: the more bugs that get fixed, the more valuable the tool becomes. A project token that gains value as software quality improves creates a flywheel where everyone — projects, developers, and users — benefits from the same outcome." },
      { type: "h3", text: "The Mechanics" },
      { type: "list", text: "", items: [
        "Each project can launch a token at no cost through hyperpush",
        "A portion of trading activity flows into the project treasury",
        "The treasury funds bounties on bugs surfaced by hyperpush",
        "Developers fix bugs, submit PRs, and earn bounties automatically",
        "The project gets healthier, increasing the token's utility and value",
      ]},
      { type: "h2", text: "Addressing the Skepticism" },
      { type: "p", text: "We know \"crypto\" raises eyebrows. But we're not building a speculative instrument — we're building a funding mechanism. The token's value is directly tied to software quality: more bugs fixed → healthier project → more adoption → more treasury funding. No speculation required." },
      { type: "p", text: "And if a project doesn't want token economics? That's fine. hyperpush works perfectly as a free, open-source error tracker without any blockchain component. The economics are opt-in." },
    ],
  },
  "solana-error-tracking": {
    title: "First-Class Solana Error Tracking: What It Actually Means",
    excerpt: "Every error tracker can capture console.error. But tracking Solana program failures — CPI errors, transaction simulation failures, RPC timeouts — requires purpose-built tooling.",
    author: "Core Team",
    authorAvatar: "CT",
    date: "March 16, 2026",
    readTime: "10 min read",
    category: "Technical",
    content: [
      { type: "p", text: "If you've built on Solana, you know the pain. A user reports that a transaction failed, and all you have is a vague error message and a transaction signature. You dig through explorer, decode the logs, realize it was a CPI failure three calls deep, and spend an hour recreating the state to understand what went wrong." },
      { type: "h2", text: "What Existing Tools Miss" },
      { type: "p", text: "General-purpose error trackers treat blockchain interactions like any other HTTP call. They'll capture the fetch error when your RPC call fails, but they won't tell you why the transaction failed at the program level. The error context that actually matters — instruction data, account states, CPI call chains — is invisible." },
      { type: "h2", text: "hyperpush's Approach" },
      { type: "p", text: "We instrument at the SDK level, capturing the full transaction context before it's submitted. When a transaction fails — whether during simulation or on-chain — we capture the program logs, decode the error, trace the CPI chain, and surface the root cause in a human-readable format." },
      { type: "h3", text: "What Gets Captured" },
      { type: "list", text: "", items: [
        "Transaction simulation failures with decoded program errors",
        "On-chain transaction failures with full instruction trace",
        "CPI call chain visualization showing exactly where the error originated",
        "Account state snapshots at the time of failure",
        "RPC timeout and rate-limit tracking across providers",
        "Priority fee spike correlation with error rates",
      ]},
      { type: "p", text: "This isn't a wrapper around explorer APIs. It's purpose-built instrumentation that gives Solana developers the same debugging experience that web developers take for granted." },
    ],
  },
}

const categoryColors: Record<string, string> = {
  Announcement: "bg-accent/20 text-accent border-accent/30",
  Technical: "bg-chart-2/20 text-chart-2 border-chart-2/30",
  "Deep Dive": "bg-chart-4/20 text-chart-4 border-chart-4/30",
}

export default function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const post = postsContent[slug]

  if (!post) {
    return (
      <CommunityLayout title="Post Not Found">
        <div className="text-center py-16">
          <p className="text-muted-foreground mb-4">This blog post doesn&apos;t exist yet.</p>
          <Button variant="outline" onClick={() => router.push("/community/blog")}>
            Back to Blog
          </Button>
        </div>
      </CommunityLayout>
    )
  }

  return (
    <CommunityLayout title="Blog">
      <article className="max-w-3xl">
        {/* Back link */}
        <Link
          href="/community/blog"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          All posts
        </Link>

        {/* Post header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-2.5 mb-4">
            <Badge className={`text-xs ${categoryColors[post.category]}`}>
              {post.category}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {post.readTime}
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-balance">
            {post.title}
          </h1>

          <p className="text-lg text-muted-foreground mb-6 text-pretty leading-relaxed">
            {post.excerpt}
          </p>

          <div className="flex items-center justify-between pb-8 border-b border-border mb-10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground">
                {post.authorAvatar}
              </div>
              <div className="text-sm">
                <p className="font-medium">{post.author}</p>
                <p className="text-muted-foreground">{post.date}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <Share2 className="w-4 h-4" />
              Share
            </Button>
          </div>
        </motion.div>

        {/* Post content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-6"
        >
          {post.content.map((block, i) => {
            if (block.type === "h2") {
              return (
                <h2 key={i} className="text-2xl font-bold tracking-tight mt-10 mb-4 first:mt-0">
                  {block.text}
                </h2>
              )
            }
            if (block.type === "h3") {
              return (
                <h3 key={i} className="text-lg font-semibold mt-6 mb-3">
                  {block.text}
                </h3>
              )
            }
            if (block.type === "list" && block.items) {
              return (
                <ul key={i} className="space-y-2 pl-1">
                  {block.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-3 text-muted-foreground leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent/60 mt-2.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )
            }
            return (
              <p key={i} className="text-muted-foreground leading-relaxed">
                {block.text}
              </p>
            )
          })}
        </motion.div>

        {/* Post footer */}
        <div className="mt-16 pt-8 border-t border-border">
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-6 text-center">
            <p className="font-semibold mb-2">Join the hyperpush community</p>
            <p className="text-sm text-muted-foreground mb-4">
              Get updates on new features, engineering deep-dives, and community events.
            </p>
            <div className="flex items-center justify-center gap-3">
              <WaitlistButton size="sm">Join Waitlist</WaitlistButton>
              <Button size="sm" variant="outline" asChild>
                <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">Discord</a>
              </Button>
            </div>
          </div>
        </div>
      </article>
    </CommunityLayout>
  )
}
