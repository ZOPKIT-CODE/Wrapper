import React, { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Bell, Check, Loader2, TestTube } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { NotificationItem } from './NotificationItem'
import { Notification, NotificationPanelProps } from './types'
import { NotificationService } from '@/services/notificationService'
import { useInvalidateQueries } from '@/hooks/useSharedQueries'

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onDismiss,
  onMarkAllAsRead,
  loading = false,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all')
  const [creatingSamples, setCreatingSamples] = useState(false)
  const { invalidateNotifications: loadNotifications } = useInvalidateQueries()
  const navigate = useNavigate()

  const filteredNotifications = notifications.filter((notification) => {
    if (activeFilter === 'unread') {
      return !notification.isRead && !notification.isDismissed
    }
    return !notification.isDismissed
  })

  const unreadCount = notifications.filter(
    (n) => !n.isRead && !n.isDismissed
  ).length

  const handleCreateSampleNotifications = async () => {
    try {
      setCreatingSamples(true)
      await NotificationService.createSampleNotifications()
      await loadNotifications() // Refresh the notifications
    } catch (error) {
      console.error('Failed to create sample notifications:', error)
    } finally {
      setCreatingSamples(false)
    }
  }

  const handleMarkAllAsRead = () => {
    onMarkAllAsRead()
  }

  const handleAction = (notification: Notification) => {
    if (notification.actionUrl) {
      // Map legacy/backend URLs to valid TanStack Router paths
      const url = notification.actionUrl
      const path = url.startsWith('/credits') ? '/dashboard/billing' : url
      navigate({ to: path })
      onClose()
    }
  }

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent
        side="right"
        className="flex h-full min-h-0 w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[420px] [&>button]:text-white [&>button]:hover:bg-white/15"
      >
        {/* Header */}
        <SheetHeader className="shrink-0 border-b border-white/10 bg-[#1B2E5A] px-6 pt-8 pb-5 text-white">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2.5 text-lg font-semibold text-white">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
                <Bell className="h-4 w-4 shrink-0" aria-hidden />
              </div>
              Notifications
            </SheetTitle>
            {unreadCount > 0 && (
              <Badge className="border-0 bg-white/20 text-xs text-white hover:bg-white/20">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          <SheetDescription className="mt-1.5 text-sm text-white/70">
            Stay updated on activity across your workspace.
          </SheetDescription>
        </SheetHeader>

        {/* Toolbar */}
        <div className="shrink-0 border-b border-gray-100 bg-white px-5 py-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            {/* Filter tabs */}
            <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-slate-800">
              {(['all', 'unread'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setActiveFilter(f)}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs font-medium transition-all',
                    activeFilter === f
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-700 dark:text-white'
                      : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'
                  )}
                >
                  {f === 'all'
                    ? `All (${notifications.filter((n) => !n.isDismissed).length})`
                    : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
                </button>
              ))}
            </div>

            {/* Mark all read */}
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-1 text-xs font-medium text-[#1B2E5A] hover:text-[#243A6C] dark:text-slate-400 dark:hover:text-slate-200"
              >
                <Check className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50/60 dark:bg-slate-900/60">
          <ScrollArea className="h-full min-h-0 flex-1">
            <div className="space-y-2 p-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-400">Loading…</span>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1B2E5A]/8 dark:bg-slate-800">
                    <Bell className="h-6 w-6 text-[#1B2E5A]/40 dark:text-slate-500" />
                  </div>
                  <h3 className="mb-1 text-sm font-semibold text-gray-700 dark:text-slate-200">
                    {activeFilter === 'unread'
                      ? 'All caught up!'
                      : 'No notifications yet'}
                  </h3>
                  <p className="mb-5 text-xs text-gray-400 dark:text-slate-500">
                    {activeFilter === 'unread'
                      ? "You've read everything."
                      : 'Notifications will appear here when there are updates.'}
                  </p>
                  {activeFilter === 'all' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCreateSampleNotifications}
                      disabled={creatingSamples}
                      className="border-[#1B2E5A]/20 text-xs text-[#1B2E5A] hover:bg-[#1B2E5A]/5 dark:border-slate-600 dark:text-slate-300"
                    >
                      {creatingSamples ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          Creating…
                        </>
                      ) : (
                        <>
                          <TestTube className="mr-1 h-3 w-3" />
                          Create sample notifications
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                filteredNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.notificationId}
                    notification={notification}
                    onMarkAsRead={onMarkAsRead}
                    onDismiss={onDismiss}
                    onAction={handleAction}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <SheetFooter className="shrink-0 border-t border-gray-100 bg-white px-5 py-3 dark:border-slate-700 dark:bg-slate-900">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="w-full border-gray-200 text-sm text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
