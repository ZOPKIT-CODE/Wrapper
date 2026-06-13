/**
 * Timeline tab: user journey and activity events.
 */

import React from 'react'
import {
  ListOrdered,
  Clock,
  UserCheck,
  CheckCircle,
  Crown,
  Coins,
  Activity,
  Sparkles,
  ArrowRight
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn, formatDate } from '@/lib/utils'
import {
  DASHBOARD_PAGE_DESCRIPTION_CLASS,
  DASHBOARD_SECTION_TITLE_CLASS,
} from '@/components/dashboard/DashboardPageHeader'
import { ZopkitRoundLoader } from '@/components/common/feedback/ZopkitRoundLoader'

export interface TimelineEvent {
  type: string
  label: string
  date: string
  metadata?: {
    planDisplayName?: string
    credits?: number
    amount?: string
    appName?: string
    action?: string
  }
}

export interface TimelineData {
  events: TimelineEvent[]
}

export interface TimelineTabProps {
  timelineData: TimelineData | null | undefined
  timelineLoading: boolean
  hasMore?: boolean
  isLoadingMore?: boolean
  onLoadMore?: () => void
}

function getEventIcon(type: string) {
  switch (type) {
    case 'account_created':
      return <UserCheck className="w-5 h-5" />
    case 'onboarding_started':
    case 'onboarding_completed':
      return <CheckCircle className="w-5 h-5" />
    case 'trial_started':
    case 'trial_ended':
      return <Clock className="w-5 h-5" />
    case 'plan_started':
      return <Crown className="w-5 h-5" />
    case 'credit_purchase':
      return <Coins className="w-5 h-5" />
    case 'activity':
      return <Activity className="w-5 h-5" />
    case 'today':
      return <Sparkles className="w-5 h-5" />
    default:
      return <CheckCircle className="w-5 h-5" />
  }
}

// Styling helper for the icon container
function getEventStyles(type: string, isToday: boolean, isActivity: boolean) {
  if (isToday) return {
      container: 'ring-4 ring-secondary text-white shadow-sm',
      containerStyle: { backgroundColor: 'var(--zk-navy)' } as React.CSSProperties,
      line: ''
  }
  if (isActivity) return {
      container: 'border-2 border-slate-200 text-slate-400',
      containerStyle: { backgroundColor: 'var(--zk-paper)' } as React.CSSProperties,
      line: ''
  }

  switch (type) {
    case 'account_created':
      return { container: 'ring-4 ring-secondary text-white', containerStyle: { backgroundColor: 'var(--zk-navy)' } as React.CSSProperties, line: '' }
    case 'onboarding_completed':
      return { container: 'bg-emerald-500 ring-4 ring-emerald-50 text-white', containerStyle: {} as React.CSSProperties, line: '' }
    case 'plan_started':
      return { container: 'bg-primary ring-4 ring-secondary text-white', containerStyle: {} as React.CSSProperties, line: '' }
    case 'credit_purchase':
      return { container: 'bg-amber-500 ring-4 ring-amber-50 text-white', containerStyle: {} as React.CSSProperties, line: '' }
    default:
      return { container: 'bg-slate-200 text-slate-500', containerStyle: {} as React.CSSProperties, line: '' }
  }
}

export function TimelineTab({ timelineData, timelineLoading, hasMore, isLoadingMore, onLoadMore }: TimelineTabProps) {
  const events = timelineData?.events ?? []

  return (
    <div style={{ fontFamily: 'var(--zk-font)', color: 'var(--zk-ink)' }}>
      <Card className="rounded-3xl overflow-hidden shadow-sm" style={{ border: '1px solid color-mix(in srgb, var(--zk-navy) 15%, transparent)', backgroundColor: 'var(--zk-paper)' }}>
        <CardHeader className="pb-8" style={{ borderBottom: '1px solid var(--zk-line)', backgroundColor: 'var(--zk-bg-2)' }}>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--zk-paper)', border: '1px solid color-mix(in srgb, var(--zk-navy) 15%, transparent)', color: 'var(--zk-navy)' }}>
              <ListOrdered className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className={DASHBOARD_SECTION_TITLE_CLASS}>Complete Timeline</CardTitle>
              <CardDescription className={cn(DASHBOARD_PAGE_DESCRIPTION_CLASS, 'mt-1')}>
                Your entire history of activities and transactions
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {timelineLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
                <ZopkitRoundLoader size="lg" className="mb-4" />
                <p style={{ fontFamily: 'var(--zk-font)', fontSize: 13, fontWeight: 500, color: 'var(--zk-muted)' }}>Loading your history...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                <Clock className="h-10 w-10 text-slate-300" />
              </div>
              <h4 className="mb-1" style={{ fontFamily: 'var(--zk-display)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--zk-ink)' }}>
                No events recorded
              </h4>
              <p className="max-w-xs mx-auto" style={{ fontFamily: 'var(--zk-font)', fontSize: 13, color: 'var(--zk-muted)' }}>
                Activities will appear here once you start using the platform.
              </p>
            </div>
          ) : (
            <div className="relative p-6 sm:p-10">
              {/* Continuous vertical line connecting everything */}
              <div className="absolute left-[2.85rem] sm:left-[3.85rem] top-10 bottom-10 w-px" style={{ backgroundColor: 'var(--zk-line)' }} />

              <div className="space-y-8">
                {events.map((event, index) => {
                  const isToday = event.type === 'today'
                  const isActivity = event.type === 'activity'
                  const styles = getEventStyles(event.type, isToday, isActivity)
                  
                  return (
                    <div key={index} className="relative flex gap-6 sm:gap-8 group">
                      {/* Icon Bubble */}
                      <div className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-all duration-300 group-hover:scale-110 ${styles.container}`} style={styles.containerStyle}>
                        {getEventIcon(event.type)}
                      </div>

                      {/* Content Card */}
                      <div className="flex-1 min-w-0 pt-1">
                         <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2">
                            <h4 style={{ fontFamily: 'var(--zk-font)', fontSize: 13, fontWeight: 500, color: 'var(--zk-ink)' }}>
                                {event.label}
                            </h4>
                            <span className="whitespace-nowrap" style={{ fontFamily: 'var(--zk-mono)', fontSize: 11, color: 'var(--zk-muted-2)' }}>
                                {formatDate(event.date)}
                            </span>
                         </div>
                         
                         <div className="rounded-lg p-4" style={isToday ? { backgroundColor: 'color-mix(in srgb, var(--zk-navy) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--zk-navy) 10%, transparent)' } : { backgroundColor: 'var(--zk-paper)', border: '1px solid var(--zk-line)' }}>
                             {/* Metadata rendering logic */}
                             {(!event.metadata || Object.keys(event.metadata).length === 0) ? (
                                <p className="italic" style={{ fontFamily: 'var(--zk-font)', fontSize: 12, color: 'var(--zk-muted)' }}>No additional details</p>
                             ) : (
                                <div className="space-y-2">
                                   {/* Plan Badge */}
                                   {event.metadata.planDisplayName && (
                                     <div className="flex items-center gap-2">
                                       <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200 border-0">
                                         {event.metadata.planDisplayName}
                                       </Badge>
                                     </div>
                                   )}
                                   
                                   {/* Credits / Financials */}
                                   {event.metadata.credits != null && (
                                     <div className="flex items-center gap-2">
                                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-0 px-2 py-0.5 h-6">
                                            <Coins className="w-3 h-3 mr-1" />
                                            {event.metadata.credits.toLocaleString()} credits
                                        </Badge>
                                        {event.metadata.amount != null && (
                                           <span className="text-xs font-medium text-slate-500">
                                             for ${parseFloat(String(event.metadata.amount)).toFixed(2)}
                                           </span>
                                        )}
                                     </div>
                                   )}
                                   
                                   {/* Activity Details */}
                                   {isActivity && event.metadata.appName && (
                                      <div className="flex flex-wrap items-center gap-2">
                                         <span style={{ fontFamily: 'var(--zk-font)', fontSize: 13, fontWeight: 500, color: 'var(--zk-ink)' }}>{event.metadata.appName}</span>
                                         {event.metadata.action && (
                                            <>
                                                <ArrowRight className="w-3 h-3" style={{ color: 'var(--zk-line)' }} />
                                                <span style={{ fontFamily: 'var(--zk-font)', fontSize: 12, color: 'var(--zk-muted)' }}>{event.metadata.action}</span>
                                            </>
                                         )}
                                      </div>
                                   )}
                                </div>
                             )}
                         </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {hasMore && (
                <div className="flex justify-center pt-6">
                  <button
                    type="button"
                    onClick={onLoadMore}
                    disabled={isLoadingMore}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" style={{ fontFamily: 'var(--zk-font)', fontSize: 13, backgroundColor: 'var(--zk-bg-2)', color: 'var(--zk-muted)', border: '1px solid var(--zk-line)' }}
                  >
                    {isLoadingMore ? (
                      <>
                        <ZopkitRoundLoader size="sm" />
                        Loading...
                      </>
                    ) : (
                      'Load more activity'
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
