import React, { useState } from 'react';
import { Bell, Check, Settings, Loader2, TestTube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { NotificationItem } from './NotificationItem';
import { NotificationPanelProps } from './types';
import { NotificationService } from '@/services/notificationService';
import { useInvalidateQueries } from '@/hooks/useSharedQueries';

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onDismiss,
  onMarkAllAsRead,
  loading = false
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all');
  const [creatingSamples, setCreatingSamples] = useState(false);
  const { invalidateNotifications: loadNotifications } = useInvalidateQueries();

  const filteredNotifications = notifications.filter(notification => {
    if (activeFilter === 'unread') {
      return !notification.isRead && !notification.isDismissed;
    }
    return !notification.isDismissed;
  });

  const unreadCount = notifications.filter(n => !n.isRead && !n.isDismissed).length;

  const handleCreateSampleNotifications = async () => {
    try {
      setCreatingSamples(true);
      await NotificationService.createSampleNotifications();
      await loadNotifications(); // Refresh the notifications
    } catch (error) {
      console.error('Failed to create sample notifications:', error);
    } finally {
      setCreatingSamples(false);
    }
  };

  const handleMarkAllAsRead = () => {
    onMarkAllAsRead();
  };

  const handleAction = (notification: any) => {
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
      onClose();
    }
  };

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="flex h-full min-h-0 w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg [&>button]:text-white [&>button]:hover:bg-white/15"
      >
        <SheetHeader className="shrink-0 space-y-2 border-b border-white/10 bg-[#1B2E5A] px-6 pb-5 pt-8 text-white">
          <SheetTitle className="flex items-center gap-2 text-lg font-semibold text-white">
            <Bell className="h-5 w-5 shrink-0" aria-hidden />
            Notifications
          </SheetTitle>
          <SheetDescription className="text-sm text-white/85">
            Stay updated on activity and updates across your workspace.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
          <div className="shrink-0 space-y-3 border-b border-[#1B2E5A]/10 px-6 py-4 dark:border-slate-700">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={activeFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter('all')}
                className={cn(
                  'text-xs',
                  activeFilter === 'all' && 'bg-[#1B2E5A] text-white hover:bg-[#243A6C]',
                )}
              >
                All ({notifications.filter((n) => !n.isDismissed).length})
              </Button>
              <Button
                type="button"
                variant={activeFilter === 'unread' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter('unread')}
                className={cn(
                  'text-xs',
                  activeFilter === 'unread' && 'bg-[#1B2E5A] text-white hover:bg-[#243A6C]',
                )}
              >
                Unread
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-1 flex h-4 w-4 items-center justify-center p-0 text-xs">
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </div>
            {unreadCount > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="w-full border-[#1B2E5A]/25 text-xs text-[#1B2E5A] hover:bg-[#1B2E5A]/5 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Check className="mr-1 h-3 w-3" />
                Mark all as read
              </Button>
            )}
          </div>

          <ScrollArea className="h-full min-h-0 flex-1 px-6">
            <div className="py-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading notifications...</span>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#1B2E5A]/10 dark:bg-slate-800">
                    <Settings className="h-6 w-6 text-[#1B2E5A]/60 dark:text-slate-400" />
                  </div>
                  <h3 className="mb-1 text-sm font-medium text-[#1B2E5A] dark:text-slate-100">
                    {activeFilter === 'unread' ? 'No unread notifications' : 'No notifications'}
                  </h3>
                  <p className="mb-4 text-xs text-muted-foreground">
                    {activeFilter === 'unread'
                      ? "You're all caught up!"
                      : 'Notifications will appear here when you have updates.'}
                  </p>
                  {activeFilter === 'all' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCreateSampleNotifications}
                      disabled={creatingSamples}
                      className="border-[#1B2E5A]/25 text-xs text-[#1B2E5A] hover:bg-[#1B2E5A]/5 dark:border-slate-600 dark:text-slate-200"
                    >
                      {creatingSamples ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          Creating...
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
                <div className="space-y-3">
                  {filteredNotifications.map((notification) => (
                    <NotificationItem
                      key={notification.notificationId}
                      notification={notification}
                      onMarkAsRead={onMarkAsRead}
                      onDismiss={onDismiss}
                      onAction={handleAction}
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <SheetFooter className="mt-0 shrink-0 flex-row justify-end gap-2 border-t border-[#1B2E5A]/10 bg-[#F0F4FA] px-6 py-4 dark:border-slate-700 dark:bg-slate-900/80">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-[#1B2E5A]/25 text-[#1B2E5A] hover:bg-[#1B2E5A]/5 dark:border-slate-600 dark:text-slate-200"
          >
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
