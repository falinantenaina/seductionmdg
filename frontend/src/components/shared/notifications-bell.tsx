import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { ApiResponse, NotificationEntry } from '@/types';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const PREVIEW_PARAMS = { page: 1, pageSize: 6 };

/** Cloche de notifications : compteur + aperçu des dernières. */
export function NotificationsBell() {
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['notifications'] });

  const countQuery = useQuery({
    queryKey: queryKeys.notifications.count,
    queryFn: async () => (await api.get<ApiResponse<{ unread: number }>>('/notifications/count')).data,
    refetchInterval: 60_000,
  });

  const listQuery = useQuery({
    queryKey: queryKeys.notifications.list({ ...PREVIEW_PARAMS, preview: true }),
    queryFn: async () =>
      (await api.get<ApiResponse<NotificationEntry[]>>('/notifications', { params: PREVIEW_PARAMS })).data,
    refetchInterval: 60_000,
  });

  const readOne = useMutation({
    mutationFn: async (id: string) => (await api.post(`/notifications/${id}/read`)).data,
    onSuccess: invalidate,
  });
  const readAll = useMutation({
    mutationFn: async () => (await api.post('/notifications/read-all')).data,
    onSuccess: invalidate,
  });

  const unread = countQuery.data?.data.unread ?? 0;
  const items = listQuery.data?.data ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label={unread > 0 ? `Notifications (${unread} non lues)` : 'Notifications'}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unread > 0 && (
            <span className="text-xs font-normal text-muted-foreground">{unread} non lue(s)</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="max-h-80 overflow-y-auto p-1">
          {listQuery.isLoading && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Chargement…</p>
          )}
          {!listQuery.isLoading && items.length === 0 && (
            <div className="flex flex-col items-center gap-1 px-3 py-6 text-center">
              <Inbox className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Aucune notification</p>
            </div>
          )}
          {items.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => !notification.isRead && readOne.mutate(notification.id)}
              className="w-full rounded-sm px-3 py-2 text-left transition-colors hover:bg-accent"
            >
              <div className="flex items-start gap-2">
                <span
                  className={
                    notification.isRead
                      ? 'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-transparent'
                      : 'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary'
                  }
                />
                <div className="min-w-0">
                  <p
                    className={
                      notification.isRead
                        ? 'truncate text-sm text-muted-foreground'
                        : 'truncate text-sm font-medium'
                    }
                  >
                    {notification.title}
                  </p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {formatDate(notification.createdAt)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={unread === 0 || readAll.isPending} onSelect={() => readAll.mutate()}>
          <CheckCheck className="h-4 w-4" />
          Tout marquer comme lu
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/notifications">Voir toutes les notifications</Link>
        </DropdownMenuItem>
        {listQuery.error && <p className="px-3 py-2 text-xs text-destructive">{getErrorMessage(listQuery.error)}</p>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
