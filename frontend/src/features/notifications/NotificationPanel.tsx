import React, { useState, useEffect } from 'react';
import { X, Check, Settings, Loader2, TestTube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { NotificationItem } from './NotificationItem';
import { NotificationPanelProps } from './types';
import { NotificationService } from '@/services/notificationService';
import { useNotifications } from '@/hooks/useNotifications';

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
  const { loadNotifications } = useNotifications();

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl">
        <Card className="h-full rounded-none border-0 border-l">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg font-semibold">Notifications</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            {/* Filter Tabs */}
            <div className="px-6 pb-4">
              <div className="flex items-center gap-2">
                <Button
                  variant={activeFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveFilter('all')}
                  className="text-xs"
                >
                  All ({notifications.filter(n => !n.isDismissed).length})
                </Button>
                <Button
                  variant={activeFilter === 'unread' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveFilter('unread')}
                  className="text-xs"
                >
                  Unread
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-xs">
                      {unreadCount}
                    </Badge>
                  )}
                </Button>
              </div>

              {/* Mark All as Read Button */}
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  className="w-full mt-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
                  <Check className="w-3 h-3 mr-1" />
                  Mark all as read
                </Button>
              )}
            </div>

            <Separator />

            {/* Notifications List */}
            <ScrollArea className="flex-1 px-6">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-500">Loading notifications...</span>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Settings className="w-6 h-6 text-gray-400" />
                  </div>
                  <h3 className="text-sm font-medium text-[#1B2E5A] mb-1">
                    {activeFilter === 'unread' ? 'No unread notifications' : 'No notifications'}
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">
                    {activeFilter === 'unread'
                      ? 'You\'re all caught up!'
                      : 'Notifications will appear here when you have updates.'
                    }
                  </p>
                  {activeFilter === 'all' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCreateSampleNotifications}
                      disabled={creatingSamples}
                      className="text-xs"
                    >
                      {creatingSamples ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <TestTube className="w-3 h-3 mr-1" />
                          Create Sample Notifications
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3 py-4">
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
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
