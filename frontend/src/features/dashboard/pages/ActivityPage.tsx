import { useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useKindeAuth } from '@/lib/auth/cognito-auth'
import { tenantAPI } from '@/lib/api'
import { TimelineTab } from '@/features/billing/components/TimelineTab'
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader'

const TIMELINE_PAGE_SIZE = 20

export function ActivityPage() {
  const { isAuthenticated } = useKindeAuth()

  const {
    data: timelinePages,
    isLoading: timelineLoading,
    isFetchingNextPage: isLoadingMore,
    hasNextPage: hasMore,
    fetchNextPage: loadMore,
  } = useInfiniteQuery({
    queryKey: ['tenant', 'timeline'],
    queryFn: async ({ pageParam = 0 }) => {
      try {
        const response = await tenantAPI.getTimeline({
          includeActivity: true,
          limit: TIMELINE_PAGE_SIZE,
          offset: pageParam,
        })
        return (
          response.data.data ?? {
            events: [],
            pagination: { offset: pageParam, limit: TIMELINE_PAGE_SIZE, activityTotal: 0, hasMore: false },
          }
        )
      } catch {
        return {
          events: [],
          pagination: { offset: pageParam, limit: TIMELINE_PAGE_SIZE, activityTotal: 0, hasMore: false },
        }
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const pagination = lastPage?.pagination
      if (pagination?.hasMore) {
        return (pagination.offset ?? 0) + (pagination.limit ?? TIMELINE_PAGE_SIZE)
      }
      return undefined
    },
    enabled: isAuthenticated,
    retry: 1,
  })

  const timelineData = useMemo(() => {
    if (!timelinePages?.pages?.length) return { events: [] }

    const fixedEvents: Array<{ type: string; label: string; date: string; metadata?: Record<string, unknown> }> = []
    const activityEvents: Array<{ type: string; label: string; date: string; metadata?: Record<string, unknown> }> = []
    const seenActivityKeys = new Set<string>()

    for (const page of timelinePages.pages) {
      for (const event of page.events ?? []) {
        if (event.type === 'today') continue
        if (event.type === 'activity') {
          const key = `${event.date}|${event.label}`
          if (!seenActivityKeys.has(key)) {
            seenActivityKeys.add(key)
            activityEvents.push(event)
          }
        } else if (fixedEvents.every((e) => e.type !== event.type || e.date !== event.date)) {
          fixedEvents.push(event)
        }
      }
    }

    const allEvents = [...fixedEvents, ...activityEvents]
    allEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    allEvents.unshift({ type: 'today', label: 'Today', date: new Date().toISOString(), metadata: {} })

    return { events: allEvents }
  }, [timelinePages])

  return (
    <div style={{ maxWidth: 1480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <DashboardPageHeader
        title="Activity"
        description="A chronological view of your workspace events, subscriptions, and usage."
      />
      <TimelineTab
        timelineData={timelineData}
        timelineLoading={timelineLoading}
        hasMore={hasMore ?? false}
        isLoadingMore={isLoadingMore}
        onLoadMore={() => loadMore()}
      />
    </div>

  )
}

export default ActivityPage
