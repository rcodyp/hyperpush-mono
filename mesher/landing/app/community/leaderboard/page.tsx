"use client"

import { CommunityLayout } from "@/components/community/community-layout"
import { ComingSoonCard } from "@/components/coming-soon-card"

export default function LeaderboardPage() {
  return (
    <CommunityLayout
      title="Leaderboard"
      subtitle="Top contributors ranked by bugs fixed and bounties earned. Fix more, climb higher."
    >
      <div className="flex min-h-[28rem] items-center justify-center">
        <ComingSoonCard
          emoji="🏆"
          titleTag="h2"
          title="Leaderboard is on the way"
          description="We're still wiring up public contributor rankings for hyperpush. Join the waitlist and we'll let you know when the first leaderboard goes live."
        />
      </div>
    </CommunityLayout>
  )
}
