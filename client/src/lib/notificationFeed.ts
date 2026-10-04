import { useInfiniteQuery } from '@tanstack/react-query';
import { api, type NotificationFeedResponse } from './api';

export const notificationFeedQueryKey = ['notification-feed'] as const;
const NOTIFICATION_PAGE_SIZE = 20;

export function useNotificationFeed() {
  return useInfiniteQuery({
    queryKey: notificationFeedQueryKey,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(NOTIFICATION_PAGE_SIZE) });
      if (pageParam) params.set('cursor', pageParam);
      return api.get<NotificationFeedResponse>(`/api/notifications?${params.toString()}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}
