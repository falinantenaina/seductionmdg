import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Plus } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useListState } from '@/hooks/use-list-state';
import { useAuthStore } from '@/stores/auth.store';
import type { ApiResponse, OrderListItem, OrderStatus } from '@/types';
import { formatDate, formatMoney, fullName } from '@/lib/utils';
import { ORDER_STATUS_LABELS } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Pagination } from '@/components/shared/pagination';
import { SearchInput } from '@/components/shared/search-input';
import { OrderStatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUSES = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[];

export function OrdersPage() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const canCreate = user?.role === 'ADMIN' || user?.role === 'COMMERCIAL';
  const { search, page, pageSize, setSearch, setPage, setPageSize } = useListState();
  const [status, setStatus] = useState<string>('all');

  const params = useMemo(
    () => ({
      page,
      pageSize,
      ...(search ? { search } : {}),
      ...(status !== 'all' ? { status } : {}),
    }),
    [page, pageSize, search, status],
  );

  const ordersQuery = useQuery({
    queryKey: queryKeys.orders.list(params),
    queryFn: async () => (await api.get<ApiResponse<OrderListItem[]>>('/orders', { params })).data,
  });

  const orders = ordersQuery.data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Commandes"
        description="Suivi du statut, des réservations et de la livraison"
        actions={
          canCreate && (
            <Button onClick={() => navigate('/orders/new')}>
              <Plus className="h-4 w-4" />
              Nouvelle commande
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="N° de commande, client, téléphone..."
          className="w-full sm:max-w-xs"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-full sm:w-52" aria-label="Statut">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {ORDER_STATUS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        loading={ordersQuery.isLoading}
        error={ordersQuery.error ? getErrorMessage(ordersQuery.error) : null}
        onRetry={() => void ordersQuery.refetch()}
        isEmpty={!ordersQuery.isLoading && orders.length === 0}
        emptyTitle="Aucune commande"
        emptyDescription="Les commandes créées apparaîtront ici avec leur statut et leurs réservations."
        emptyAction={
          canCreate ? (
            <Button size="sm" onClick={() => navigate('/orders/new')}>
              <Plus className="h-4 w-4" />
              Créer une commande
            </Button>
          ) : null
        }
        headers={['Commande', 'Client', 'Date', 'Lignes', 'Montant', 'Commercial', 'Statut', '']}
      >
        {orders.map((order) => (
          <TableRow key={order.id} className="cursor-pointer" onClick={() => navigate(`/orders/${order.id}`)}>
            <TableCell>
              <div className="flex flex-col">
                <Link
                  to={`/orders/${order.id}`}
                  className="font-medium hover:underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  {order.orderNumber}
                </Link>
                {order.invoice && (
                  <span className="text-xs text-muted-foreground">Facture {order.invoice.invoiceNumber}</span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium">{order.customer?.name ?? '—'}</span>
                <span className="text-xs text-muted-foreground">{order.customer?.phone ?? ''}</span>
              </div>
            </TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(order.createdAt)}</TableCell>
            <TableCell>
              <Badge variant="outline">{order.items.reduce((sum, item) => sum + item.quantity, 0)} u.</Badge>
            </TableCell>
            <TableCell className="whitespace-nowrap font-medium">{formatMoney(order.total)}</TableCell>
            <TableCell className="text-muted-foreground">{fullName(order.commercial)}</TableCell>
            <TableCell>
              <OrderStatusBadge status={order.status} />
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={`Ouvrir ${order.orderNumber}`}
                onClick={(event) => {
                  event.stopPropagation();
                  navigate(`/orders/${order.id}`);
                }}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </DataTable>

      <div className="mt-4">
        <Pagination meta={ordersQuery.data?.meta} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>
    </div>
  );
}
