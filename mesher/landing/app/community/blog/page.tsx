"use client"

import { CommunityLayout } from "@/components/community/community-layout"
import { ComingSoonCard } from "@/components/coming-soon-card"

export default function BlogPage() {
  return (
    <CommunityLayout
      title="Blog"
      subtitle="Engineering deep dives, product updates, and the thinking behind hyperpush."
    >
      <div className="flex min-h-[28rem] items-center justify-center">
        <ComingSoonCard
          emoji="✍️"
          titleTag="h2"
          title="Blog is on the way"
          description="We're still writing the first round of engineering notes and product updates. Join the waitlist and we'll let you know when the blog launches."
        />
      </div>
    </CommunityLayout>
  )
}
