import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, MailOpen } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useListState } from '@/hooks/use-list-state';
import type { ApiResponse, NotificationEntry } from '@/types';
import { formatDate } from '@/lib/utils';
import { NOTIFICATION_TYPE_LABELS } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const { page, pageSize, setPage, setPageSize } = useListState();
  const [unreadOnly, setUnreadOnly] = useState(false);

  const params = useMemo(
    () => ({ page, pageSize, ...(unreadOnly ? { unreadOnly: 'true' } : {}) }),
    [page, pageSize, unreadOnly],
  );

  const listQuery = useQuery({
    queryKey: queryKeys.notifications.list(params),
    queryFn: async () => (await api.get<ApiResponse<NotificationEntry[]>>('/notifications', { params })).data,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['notifications'] });

  const readOne = useMutation({
    mutationFn: async (id: string) => (await api.post(`/notifications/${id}/read`)).data,
    onSuccess: invalidate,
  });
  const readAll = useMutation({
    mutationFn: async () => (await api.post('/notifications/read-all')).data,
    onSuccess: invalidate,
  });

  const items = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta;
  const unread = items.filter((item) => !item.isRead).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Alertes de commande, de facturation, de stock et de livraison"
        actions={
          <>
            <div className="flex rounded-md border p-0.5">
              <Button
                variant={unreadOnly ? 'ghost' : 'secondary'}
                size="sm"
                className="h-8"
                onClick={() => setUnreadOnly(false)}
              >
                Toutes
              </Button>
              <Button
                variant={unreadOnly ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8"
                onClick={() => setUnreadOnly(true)}
              >
                Non lues{unread > 0 ? ` (${unread})` : ''}
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={readAll.isPending}
              onClick={() => readAll.mutate()}
            >
              <CheckCheck className="h-4 w-4" />
              Tout marquer comme lu
            </Button>
          </>
        }
      />

      {listQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-[86px]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-5 w-5" />}
          title={unreadOnly ? 'Aucune notification non lue' : 'Aucune notification'}
          description={
            unreadOnly
              ? 'Toutes vos notifications ont été traitées.'
              : 'Les événements du logiciel (commandes, stocks, livraisons) apparaîtront ici.'
          }
          action={
            unreadOnly ? (
              <Button variant="outline" size="sm" onClick={() => setUnreadOnly(false)}>
                Voir toutes les notifications
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((notification) => (
            <div
              key={notification.id}
              className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start ${
                notification.isRead ? '' : 'border-primary/40 bg-primary/5'
              }`}
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  notification.isRead ? 'bg-muted-foreground/30' : 'bg-primary'
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{notification.title}</p>
                  <Badge variant="secondary">{NOTIFICATION_TYPE_LABELS[notification.type]}</Badge>
                  {!notification.isRead && <Badge variant="info">Non lue</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>{formatDate(notification.createdAt)}</span>
                  {notification.order && (
                    <Link
                      to={`/orders/${notification.order.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {notification.order.orderNumber}
                    </Link>
                  )}
                </div>
              </div>
              {!notification.isRead && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0"
                  disabled={readOne.isPending}
                  onClick={() => readOne.mutate(notification.id)}
                >
                  <MailOpen className="h-4 w-4" />
                  Marquer lu
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {listQuery.error && <p className="mt-4 text-sm text-destructive">{getErrorMessage(listQuery.error)}</p>}

      <div className="mt-6">
        <Pagination meta={meta} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>
    </div>
  );
}
