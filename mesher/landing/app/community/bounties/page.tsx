"use client"

import { CommunityLayout } from "@/components/community/community-layout"
import { ComingSoonCard } from "@/components/coming-soon-card"

export default function BountiesPage() {
  return (
    <CommunityLayout
      title="Bounties"
      subtitle="Open issues with rewards attached. Pick a bug, submit a fix, get paid when it's verified."
    >
      <div className="flex min-h-[28rem] items-center justify-center">
        <ComingSoonCard
          emoji="🎯"
          titleTag="h2"
          title="Bounties are on the way"
          description="We're still getting the public bounty board ready for launch. Join the waitlist and we'll let you know when live bounties open up."
        />
      </div>
    </CommunityLayout>
  )
}
