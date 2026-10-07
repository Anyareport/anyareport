import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Empty, Modal, Space, Spin, Typography, message } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { api, type NotificationFeedItem } from '../../lib/api';
import { notificationFeedQueryKey, useNotificationFeed } from '../../lib/notificationFeed';
import NotificationCard from '../../components/NotificationCard';
import { useAuth } from '../../contexts/AuthContext';
import PageHero from '../../components/PageHero';
import { FilterControl } from '../../components/StatusFilter';
import { registerPushToken } from '../../lib/pushNotifications';
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  type BrowserNotificationPermission,
} from '../../lib/browserNotifications';

const { Title, Text } = Typography;
type NotificationFilter = 'all' | 'unread' | 'alerts' | 'updates';

interface NotificationsPageProps {
  title: string;
}

function getDayGroup(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  today.setHours(0, 0, 0, 0);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  return 'Earlier';
}

export default function NotificationsPage({ title }: NotificationsPageProps) {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const feed = useNotificationFeed();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [notificationPermission, setNotificationPermission] =
    useState<BrowserNotificationPermission>(getBrowserNotificationPermission);
  const [dispatchInvite, setDispatchInvite] = useState<NotificationFeedItem | null>(null);
  const pages = feed.data?.pages || [];
  const firstPage = pages[0];
  const counts = firstPage?.counts || { all: 0, unread: 0, alerts: 0, updates: 0 };
  const unreadCount = firstPage?.unreadCount || 0;
  const loadedItems = pages.flatMap((page) => page.items);
  const filteredItems = loadedItems.filter((item) => {
    if (filter === 'unread') return !item.read;
    if (filter === 'alerts' || filter === 'updates') return item.bucket === filter;
    return true;
  });

  const invalidateFeed = () =>
    queryClient.invalidateQueries({ queryKey: notificationFeedQueryKey });

  const markRead = useMutation({
    mutationFn: (item: NotificationFeedItem) => {
      if (item.kind === 'status_group' && item.reportId) {
        return api.patch(`/api/notifications/reports/${item.reportId}/status-updates/read`, {});
      }
      return api.patch(`/api/notifications/${item.latestEventId}/read`, {});
    },
    onSuccess: invalidateFeed,
    onError: (error: Error) => message.error(error.message),
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch('/api/notifications/read-all', {}),
    onSuccess: invalidateFeed,
    onError: (error: Error) => message.error(error.message),
  });

  const dispatchResponse = useMutation({
    mutationFn: ({
      reportId,
      notificationId,
      accepted,
    }: {
      reportId: string;
      notificationId: string;
      accepted: boolean;
    }) => api.post(`/api/reports/${reportId}/dispatch-response`, { accepted, notificationId }),
    onSuccess: (_, { accepted }) => {
      setDispatchInvite(null);
      invalidateFeed();
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      message.success(accepted ? 'You accepted the assistance request' : 'Assistance request declined');
    },
    onError: (error: Error) => message.error(error.message),
  });

  const enablePushNotifications = async () => {
    try {
      const permission = await requestBrowserNotificationPermission();
      setNotificationPermission(permission);
      if (permission === 'granted' && !(await registerPushToken())) {
        message.error('Push notifications are not configured for this app.');
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not enable notifications.');
    }
  };

  const getReportPath = (reportId: string) => {
    const basePath =
      role === 'resident'
        ? '/resident/reports'
        : ['tanod', 'responder'].includes(role || '')
          ? '/responder/incidents'
          : '/admin/incidents';
    return `${basePath}/${encodeURIComponent(reportId)}`;
  };

  const filterOptions = [
    { label: `All ${counts.all}`, value: 'all' },
    { label: `Unread ${counts.unread}`, value: 'unread' },
    { label: `Alerts ${counts.alerts}`, value: 'alerts' },
    { label: `Updates ${counts.updates}`, value: 'updates' },
  ];

  const dayGroups = ['Today', 'Yesterday', 'Earlier'].map((day) => ({
    day,
    items: filteredItems.filter((item) => getDayGroup(item.createdAt) === day),
  }));

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHero
        title={title}
        description="Incident updates, urgent alerts, and system messages appear here."
      />

      <div className="toolbar-row">
        <FilterControl
          value={filter}
          onChange={(value) => setFilter(value as NotificationFilter)}
          options={filterOptions}
          ariaLabel="Filter notifications"
        />
        <Button
          type="default"
          icon={<CheckOutlined />}
          loading={markAllRead.isPending}
          disabled={unreadCount === 0}
          onClick={() => markAllRead.mutate()}
        >
          Mark all as read
        </Button>
      </div>

      {notificationPermission === 'granted' ? (
        <Alert
          type="success"
          showIcon
          message="Push notifications are enabled for new incident updates."
        />
      ) : notificationPermission === 'denied' ? (
        <Alert
          type="warning"
          showIcon
          message="Push notifications are blocked. Allow notifications in your browser settings to enable them."
        />
      ) : notificationPermission === 'unsupported' ? (
        <Alert
          type="info"
          showIcon
          message="This browser does not support push notifications."
        />
      ) : (
        <Alert
          type="info"
          showIcon
          message="Get notified about new incident updates"
          description="Enable browser notifications to receive alerts while using Anyareport."
          action={
            <Button
              size="small"
              icon={<BellOutlined />}
              onClick={enablePushNotifications}
            >
              Enable
            </Button>
          }
        />
      )}

      {feed.isPending ? (
        <div className="notifications-page__empty">
          <Spin />
        </div>
      ) : feed.isError && loadedItems.length === 0 ? (
        <Alert
          type="error"
          showIcon
          title="Notifications could not be loaded"
          description={feed.error.message}
          action={<Button onClick={() => feed.refetch()}>Retry</Button>}
        />
      ) : filteredItems.length === 0 ? (
        <div className="notifications-page__empty">
          {feed.hasNextPage && filter !== 'all' ? (
            <Text type="secondary">
              No matching notifications on this page. Load older items to continue.
            </Text>
          ) : (
            <Empty
              description={filter === 'unread' ? 'You are all caught up' : 'No notifications yet'}
            />
          )}
        </div>
      ) : (
        <div>
          {dayGroups.map(
            ({ day, items }) =>
              items.length > 0 && (
                <section key={day} aria-label={day}>
                  <Title level={5} className="notification-day__heading">
                    {day}
                  </Title>
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    {items.map((item) => (
                      <NotificationCard
                        key={item.id}
                        item={item}
                        role={role}
                        to={
                          item.reportId &&
                          !(role && ['tanod', 'responder'].includes(role) &&
                            item.type === 'incident_dispatched' &&
                            !item.dispatchResponse)
                            ? getReportPath(item.reportId)
                            : null
                        }
                        onOpen={() => {
                          if (!item.read) markRead.mutate(item);
                          if (
                            item.reportId &&
                            ['tanod', 'responder'].includes(role || '') &&
                            item.type === 'incident_dispatched' &&
                            !item.dispatchResponse
                          ) {
                            setDispatchInvite(item);
                          }
                        }}
                      />
                    ))}
                  </Space>
                </section>
              )
          )}
        </div>
      )}

      {feed.hasNextPage && (
        <Button
          className="notifications-page__load-more"
          type="text"
          loading={feed.isFetchingNextPage}
          onClick={() => feed.fetchNextPage()}
        >
          Load older notifications
        </Button>
      )}

      <Modal
        title="Assistance request"
        open={!!dispatchInvite}
        okText="Accept"
        cancelText="Decline"
        confirmLoading={dispatchResponse.isPending}
        onOk={() => {
          if (dispatchInvite?.reportId) {
            dispatchResponse.mutate({
              reportId: dispatchInvite.reportId,
              notificationId: dispatchInvite.latestEventId,
              accepted: true,
            });
          }
        }}
        onCancel={() => {
          if (dispatchInvite?.reportId) {
            dispatchResponse.mutate({
              reportId: dispatchInvite.reportId,
              notificationId: dispatchInvite.latestEventId,
              accepted: false,
            });
          }
        }}
        closable={!dispatchResponse.isPending}
        maskClosable={!dispatchResponse.isPending}
      >
        <Text>
          {dispatchInvite?.message || 'Would you like to accept this civil blotter assistance request?'}
        </Text>
      </Modal>
    </Space>
  );
}
