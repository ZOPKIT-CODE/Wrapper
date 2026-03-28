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
import { formatDate } from '@/lib/utils'
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
      container: 'bg-[#1B2E5A] ring-4 ring-indigo-50 text-white shadow-md shadow-indigo-200',
      line: 'bg-[#1B2E5A]/30'
  }
  if (isActivity) return {
      container: 'bg-white border-2 border-slate-200 text-slate-400',
      line: 'bg-slate-100'
  }
  
  switch (type) {
    case 'account_created':
      return { container: 'bg-[#1B2E5A] ring-4 ring-[#1B2E5A]/10 text-white', line: 'bg-[#1B2E5A]/15' }
    case 'onboarding_completed':
      return { container: 'bg-emerald-500 ring-4 ring-emerald-50 text-white', line: 'bg-emerald-100' }
    case 'plan_started':
      return { container: 'bg-violet-500 ring-4 ring-violet-50 text-white', line: 'bg-violet-100' }
    case 'credit_purchase':
      return { container: 'bg-amber-500 ring-4 ring-amber-50 text-white', line: 'bg-amber-100' }
    default:
      return { container: 'bg-slate-200 text-slate-500', line: 'bg-slate-100' }
  }
}

export function TimelineTab({ timelineData, timelineLoading, hasMore, isLoadingMore, onLoadMore }: TimelineTabProps) {
  const events = timelineData?.events ?? []

  return (
    <div className="font-sans text-slate-900">
      <Card className="rounded-3xl border border-[#1B2E5A]/15 bg-white shadow-sm overflow-hidden">
        <CardHeader className="pb-8 border-b border-slate-50 bg-slate-50/30">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-[#1B2E5A]/15 shadow-sm text-[#1B2E5A]">
              <ListOrdered className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-[#1B2E5A]">Complete Timeline</CardTitle>
              <CardDescription className="text-slate-500 mt-1">
                Your entire history of activities and transactions
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {timelineLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
                <ZopkitRoundLoader size="lg" className="mb-4" />
                <p className="text-sm font-medium text-slate-500">Loading your history...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                <Clock className="h-10 w-10 text-slate-300" />
              </div>
              <h4 className="text-lg font-bold text-[#1B2E5A] mb-1">
                No events recorded
              </h4>
              <p className="text-slate-500 max-w-xs mx-auto text-sm">
                Activities will appear here once you start using the platform.
              </p>
            </div>
          ) : (
            <div className="relative p-6 sm:p-10">
              {/* Continuous vertical line connecting everything */}
              <div className="absolute left-[2.85rem] sm:left-[3.85rem] top-10 bottom-10 w-px bg-slate-200" />

              <div className="space-y-8">
                {events.map((event, index) => {
                  const isToday = event.type === 'today'
                  const isActivity = event.type === 'activity'
                  const styles = getEventStyles(event.type, isToday, isActivity)
                  
                  return (
                    <div key={index} className="relative flex gap-6 sm:gap-8 group">
                      {/* Icon Bubble */}
                      <div className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-all duration-300 group-hover:scale-110 ${styles.container}`}>
                        {getEventIcon(event.type)}
                      </div>

                      {/* Content Card */}
                      <div className="flex-1 min-w-0 pt-1">
                         <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2">
                            <h4 className={`text-sm font-bold ${isToday ? 'text-[#1B2E5A]' : 'text-[#1B2E5A]'}`}>
                                {event.label}
                            </h4>
                            <span className="text-xs font-medium text-slate-400 whitespace-nowrap">
                                {formatDate(event.date)}
                            </span>
                         </div>
                         
                         <div className={`rounded-2xl p-4 transition-all duration-300 ${
                            isToday 
                              ? 'bg-[#1B2E5A]/5 border border-[#1B2E5A]/10'
                              : 'bg-white border border-slate-100 group-hover:border-[#1B2E5A]/15 group-hover:shadow-md group-hover:shadow-[#1B2E5A]/5'
                         }`}>
                             {/* Metadata rendering logic */}
                             {(!event.metadata || Object.keys(event.metadata).length === 0) ? (
                                <p className="text-xs text-slate-500 italic">No additional details</p>
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
                                      <div className="flex flex-wrap items-center gap-2 text-sm">
                                         <span className="font-medium text-slate-700">{event.metadata.appName}</span>
                                         {event.metadata.action && (
                                            <>
                                                <ArrowRight className="w-3 h-3 text-slate-300" />
                                                <span className="text-slate-500">{event.metadata.action}</span>
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
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200 hover:border-blue-200"
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
