import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Settings2, Truck, UserRound } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useListState } from '@/hooks/use-list-state';
import { useAuthStore } from '@/stores/auth.store';
import type { ApiResponse, DeliveryListItem, DeliveryStatus } from '@/types';
import { formatDate, formatNumber } from '@/lib/utils';
import { DELIVERY_STATUS_LABELS } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Pagination } from '@/components/shared/pagination';
import { SearchInput } from '@/components/shared/search-input';
import { DeliveryStatusBadge, OrderStatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableCell, TableRow } from '@/components/ui/table';

const STATUSES = Object.keys(DELIVERY_STATUS_LABELS) as DeliveryStatus[];

export function DeliveriesPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isLivre = user?.role === 'LIVREUR';
  const canManagePeople = user?.role === 'DISPATCHER' || user?.role === 'ADMIN';
  const { search, page, pageSize, setSearch, setPage, setPageSize } = useListState();
  const [status, setStatus] = useState('all');

  const params = useMemo(
    () => ({
      page,
      pageSize,
      ...(search ? { search } : {}),
      ...(status !== 'all' ? { status } : {}),
      ...(isLivre ? { mine: 'true' } : {}),
    }),
    [page, pageSize, search, status, isLivre],
  );

  const deliveriesQuery = useQuery({
    queryKey: queryKeys.deliveries.list(params),
    queryFn: async () => (await api.get<ApiResponse<DeliveryListItem[]>>('/deliveries', { params })).data,
  });

  const deliveries = deliveriesQuery.data?.data ?? [];

  return (
    <div>
      <PageHeader
        title={isLivre ? 'Mes livraisons' : 'Livraisons'}
        description={
          isLivre
            ? 'Vos fiches de livraison : prise en charge, exécution et validation'
            : 'Fiches de livraison : affectation des livreurs et suivi des tournées'
        }
        actions={
          canManagePeople && (
            <Button variant="outline" onClick={() => navigate('/delivery-persons')}>
              <UserRound className="h-4 w-4" />
              Gérer les livreurs
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="N° de fiche, commande, client, livreur..."
          className="w-full sm:max-w-xs"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-full sm:w-48" aria-label="Statut">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {DELIVERY_STATUS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        loading={deliveriesQuery.isLoading}
        error={deliveriesQuery.error ? getErrorMessage(deliveriesQuery.error) : null}
        onRetry={() => void deliveriesQuery.refetch()}
        isEmpty={!deliveriesQuery.isLoading && deliveries.length === 0}
        emptyTitle="Aucune livraison"
        emptyDescription={
          isLivre
            ? 'Les fiches qui vous sont affectées apparaîtront ici.'
            : 'Créez une fiche depuis une commande sortie du magasin, puis affectez un livreur.'
        }
        headers={
          isLivre
            ? ['Fiche', 'Commande', 'Client', 'Prévue le', 'Lignes', 'Statut', '']
            : ['Fiche', 'Commande', 'Client', 'Livreur', 'Prévue le', 'Statut', '']
        }
      >
        {deliveries.map((delivery) => (
          <TableRow
            key={delivery.id}
            className="cursor-pointer"
            onClick={() => navigate(`/deliveries/${delivery.id}`)}
          >
            <TableCell>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                </span>
                <span className="font-medium">{delivery.deliveryNumber}</span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium">{delivery.order.orderNumber}</span>
                <OrderStatusBadge status={delivery.order.status} />
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium">{delivery.order.customer.name}</span>
                <span className="text-xs text-muted-foreground">{delivery.order.customer.phone ?? ''}</span>
              </div>
            </TableCell>
            {isLivre ? (
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatDate(delivery.scheduledAt)}
              </TableCell>
            ) : (
              <TableCell>
                {delivery.deliveryPerson ? (
                  <div className="flex flex-col">
                    <span className="font-medium">{delivery.deliveryPerson.name}</span>
                    <span className="text-xs text-muted-foreground">{delivery.deliveryPerson.vehicle ?? ''}</span>
                  </div>
                ) : (
                  <Badge variant="outline">Non affectée</Badge>
                )}
              </TableCell>
            )}
            {isLivre ? (
              <TableCell className="text-muted-foreground">
                {delivery.items.reduce((sum, line) => sum + line.quantity, 0)} u.
              </TableCell>
            ) : (
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatDate(delivery.scheduledAt)}
              </TableCell>
            )}
            <TableCell>
              <DeliveryStatusBadge status={delivery.status} />
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={`Ouvrir ${delivery.deliveryNumber}`}
                onClick={(event) => {
                  event.stopPropagation();
                  navigate(`/deliveries/${delivery.id}`);
                }}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </DataTable>

      <div className="mt-4">
        <Pagination meta={deliveriesQuery.data?.meta} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {canManagePeople && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Settings2 className="h-3.5 w-3.5" />
          {formatNumber(deliveries.length)} fiche(s) affichée(s) — l'historique complet est disponible avec le filtre «
          Tous les statuts ».
        </p>
      )}
    </div>
  );
}
