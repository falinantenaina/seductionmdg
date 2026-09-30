import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Check, Download, FileText, Play, Truck, UserRound, XCircle } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { downloadDeliveryPdf } from '@/lib/pdf';
import { useAuthStore } from '@/stores/auth.store';
import type { ApiResponse, DeliveryDetail, DeliveryPerson } from '@/types';
import { formatDate, formatNumber } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { DeliveryStatusBadge, OrderStatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableCell, TableRow } from '@/components/ui/table';
import { DataTable } from '@/components/shared/data-table';

function toIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function DeliveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const isDispatcher = user?.role === 'DISPATCHER' || user?.role === 'ADMIN';
  const isLivre = user?.role === 'LIVREUR' || user?.role === 'ADMIN';

  const [assignOpen, setAssignOpen] = useState(false);
  const [personId, setPersonId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [completeOpen, setCompleteOpen] = useState(false);
  const [observations, setObservations] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [failOpen, setFailOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [downloading, setDownloading] = useState(false);

  const detailQuery = useQuery({
    queryKey: queryKeys.deliveries.detail(id ?? ''),
    queryFn: async () => (await api.get<ApiResponse<DeliveryDetail>>(`/deliveries/${id}`)).data,
    enabled: !!id,
  });

  const peopleQuery = useQuery({
    queryKey: queryKeys.deliveryPeople.list({ active: true, pageSize: 100 }),
    queryFn: async () =>
      (await api.get<ApiResponse<DeliveryPerson[]>>('/delivery-persons', { params: { isActive: true, pageSize: 100 } }))
        .data,
    enabled: assignOpen && isDispatcher,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
    void queryClient.invalidateQueries({ queryKey: ['delivery-people'] });
  };

  const onError = (error: unknown) => toast.error(getErrorMessage(error));

  const assignMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/deliveries/${id}/assign`, {
          deliveryPersonId: personId,
          scheduledAt: toIso(scheduledAt),
        })
      ).data,
    onSuccess: () => {
      toast.success('Livraison affectée');
      setAssignOpen(false);
      setPersonId('');
      setScheduledAt('');
      refresh();
    },
    onError,
  });

  const unassignMutation = useMutation({
    mutationFn: async () => (await api.post(`/deliveries/${id}/unassign`, {})).data,
    onSuccess: () => {
      toast.success('Affectation retirée');
      refresh();
    },
    onError,
  });

  const startMutation = useMutation({
    mutationFn: async () => (await api.post(`/deliveries/${id}/start`, {})).data,
    onSuccess: () => {
      toast.success('Tournée démarrée');
      refresh();
    },
    onError,
  });

  const completeMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/deliveries/${id}/complete`, {
          observations: observations || null,
          items: (detailQuery.data?.data?.items ?? []).map((line) => ({
            deliveryItemId: line.id,
            quantityDelivered: Number(quantities[line.id] ?? line.quantity),
          })),
        })
      ).data,
    onSuccess: () => {
      toast.success('Livraison validée : la commande est livrée');
      setCompleteOpen(false);
      setObservations('');
      refresh();
    },
    onError,
  });

  const failMutation = useMutation({
    mutationFn: async () => (await api.post(`/deliveries/${id}/fail`, { reason })).data,
    onSuccess: () => {
      toast.success('Échec enregistré : la commande est réexpédiable');
      setFailOpen(false);
      setReason('');
      refresh();
    },
    onError,
  });

  const delivery = detailQuery.data?.data;
  const order = delivery?.order;
  const people = peopleQuery.data?.data ?? [];

  const openComplete = () => {
    const items = detailQuery.data?.data?.items ?? [];
    setQuantities(Object.fromEntries(items.map((line) => [line.id, String(line.quantity)])));
    setCompleteOpen(true);
  };

  const openAssign = () => {
    setScheduledAt(delivery?.scheduledAt ? delivery.scheduledAt.slice(0, 16) : '');
    setPersonId(delivery?.deliveryPersonId ?? '');
    setAssignOpen(true);
  };

  const totals = useMemo(() => {
    const lines = delivery?.items ?? [];
    return {
      expected: lines.reduce((sum, line) => sum + line.quantity, 0),
      delivered: lines.reduce((sum, line) => sum + (line.quantityDelivered ?? 0), 0),
    };
  }, [delivery]);

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (!delivery || !order) {
    return (
      <div className="rounded-xl border bg-card">
        <div className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="font-medium">Livraison introuvable</p>
          <Button variant="outline" onClick={() => navigate('/deliveries')}>
            <ArrowLeft className="h-4 w-4" />
            Retour aux livraisons
          </Button>
        </div>
      </div>
    );
  }

  const canAssign = isDispatcher && (delivery.status === 'A_LIVRER' || delivery.status === 'ECHEC');
  const canUnassign = isDispatcher && delivery.status === 'AFFECTEE';
  const canStart = isLivre && delivery.status === 'AFFECTEE';
  const canExecute = isLivre && delivery.status === 'EN_COURS';

  return (
    <div>
      <PageHeader
        title={delivery.deliveryNumber}
        description={`Commande ${order.orderNumber} · ${order.customer.name} · créée le ${formatDate(delivery.createdAt)}`}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/deliveries')}>
              <ArrowLeft className="h-4 w-4" />
              Livraisons
            </Button>
            <Button
              variant="outline"
              loading={downloading}
              onClick={async () => {
                setDownloading(true);
                try {
                  await downloadDeliveryPdf(delivery.id, delivery.deliveryNumber);
                } catch (error) {
                  toast.error(getErrorMessage(error));
                } finally {
                  setDownloading(false);
                }
              }}
            >
              <Download className="h-4 w-4" />
              Fiche PDF
            </Button>
            <Button variant="outline" onClick={() => navigate(`/orders/${order.id}`)}>
              <FileText className="h-4 w-4" />
              Commande
            </Button>
            {canAssign && (
              <Button onClick={openAssign}>
                <UserRound className="h-4 w-4" />
                Affecter un livreur
              </Button>
            )}
            {canUnassign && (
              <Button
                variant="outline"
                loading={unassignMutation.isPending}
                onClick={() => unassignMutation.mutate()}
              >
                Désaffecter
              </Button>
            )}
            {canStart && (
              <Button loading={startMutation.isPending} onClick={() => startMutation.mutate()}>
                <Play className="h-4 w-4" />
                Démarrer la tournée
              </Button>
            )}
            {canExecute && (
              <>
                <Button onClick={openComplete}>
                  <Check className="h-4 w-4" />
                  Valider la livraison
                </Button>
                <Button variant="destructive" onClick={() => setFailOpen(true)}>
                  <XCircle className="h-4 w-4" />
                  Échec
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <DeliveryStatusBadge status={delivery.status} />
        <OrderStatusBadge status={order.status} />
        {delivery.scheduledAt && <Badge variant="outline">Prévue le {formatDate(delivery.scheduledAt)}</Badge>}
        {delivery.deliveredAt && <Badge variant="outline">Livrée le {formatDate(delivery.deliveredAt)}</Badge>}
        {delivery.status === 'ECHEC' && delivery.observations && (
          <Badge variant="destructive">Motif : {delivery.observations}</Badge>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Destinataire</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{order.customer.name}</p>
            <p className="text-muted-foreground">{order.recipientName ?? order.customer.contactName ?? '—'}</p>
            <p className="text-muted-foreground">{order.deliveryAddress ?? order.customer.address ?? '—'}</p>
            <p className="text-muted-foreground">{order.deliveryPlace ?? order.customer.deliveryPlace ?? '—'}</p>
            <p className="text-muted-foreground">{order.recipientPhone ?? order.customer.phone ?? '—'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Livreur</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {delivery.deliveryPerson ? (
              <>
                <p className="font-medium">{delivery.deliveryPerson.name}</p>
                <p className="text-muted-foreground">{delivery.deliveryPerson.phone}</p>
                <p className="text-muted-foreground">{delivery.deliveryPerson.vehicle ?? 'Véhicule non renseigné'}</p>
              </>
            ) : (
              <p className="text-muted-foreground">Aucun livreur affecté</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Fiche</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{delivery.deliveryNumber}</p>
            <p className="text-muted-foreground">
              {totals.delivered > 0 || delivery.status === 'LIVREE'
                ? `${formatNumber(totals.delivered)} / ${formatNumber(totals.expected)} unité(s) livrée(s)`
                : `${formatNumber(totals.expected)} unité(s) à livrer`}
            </p>
            <p className="text-muted-foreground">{delivery.instructions ?? 'Aucune instruction'}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Articles à livrer</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            embedded
            headers={['Désignation', 'Qté prévue', 'Qté livrée']}
            isEmpty={delivery.items.length === 0}
            emptyTitle="Aucun article"
            emptyDescription="Cette fiche de livraison ne contient aucune ligne."
          >
            {delivery.items.map((line) => (
              <TableRow key={line.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{line.designation}</span>
                    {line.article && (
                      <span className="text-xs text-muted-foreground">Stock : {line.article.sku}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">{formatNumber(line.quantity)}</TableCell>
                <TableCell className="text-right font-medium">
                  {line.quantityDelivered === null ? '—' : formatNumber(line.quantityDelivered)}
                </TableCell>
              </TableRow>
            ))}
          </DataTable>

          {delivery.observations && delivery.status !== 'ECHEC' && (
            <p className="mt-4 text-sm text-muted-foreground">Observations : {delivery.observations}</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Affecter {delivery.deliveryNumber}</DialogTitle>
            <DialogDescription>
              Le livreur reçoit une notification et la commande passe en « en livraison ».
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="del-person">Livreur *</Label>
              <Select value={personId} onValueChange={setPersonId} disabled={peopleQuery.isLoading}>
                <SelectTrigger id="del-person">
                  <SelectValue placeholder={peopleQuery.isLoading ? 'Chargement...' : 'Sélectionner un livreur'} />
                </SelectTrigger>
                <SelectContent>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name} {person.vehicle ? `· ${person.vehicle}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!peopleQuery.isLoading && people.length === 0 && (
                <p className="text-xs text-muted-foreground">Aucun livreur actif : créez d'abord un profil livreur.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="del-schedule">Date prévue</Label>
              <Input
                id="del-schedule"
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Annuler
            </Button>
            <Button
              loading={assignMutation.isPending}
              disabled={!personId}
              onClick={() => assignMutation.mutate()}
            >
              <Truck className="h-4 w-4" />
              Affecter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Valider la livraison {delivery.deliveryNumber}</DialogTitle>
            <DialogDescription>
              Renseignez les quantités réellement remises : la commande passera en « livrée ».
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {delivery.items.map((line) => (
              <div key={line.id} className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{line.designation}</p>
                  <p className="text-xs text-muted-foreground">Prévue : {formatNumber(line.quantity)}</p>
                </div>
                <div className="w-28 shrink-0">
                  <Label htmlFor={`qty-${line.id}`} className="sr-only">
                    Quantité livrée
                  </Label>
                  <Input
                    id={`qty-${line.id}`}
                    type="number"
                    min={0}
                    max={line.quantity}
                    value={quantities[line.id] ?? String(line.quantity)}
                    onChange={(event) => setQuantities((prev) => ({ ...prev, [line.id]: event.target.value }))}
                  />
                </div>
              </div>
            ))}

            <div className="space-y-2 pt-2">
              <Label htmlFor="del-obs">Observations</Label>
              <Textarea
                id="del-obs"
                value={observations}
                onChange={(event) => setObservations(event.target.value)}
                placeholder="Ex. : remis au gardien, reçu signé..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>
              Annuler
            </Button>
            <Button loading={completeMutation.isPending} onClick={() => completeMutation.mutate()}>
              <Check className="h-4 w-4" />
              Confirmer la livraison
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={failOpen} onOpenChange={setFailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Signaler un échec</DialogTitle>
            <DialogDescription>
              La fiche passe en « échec » et la commande repart en magasin pour être réexpédiée.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="del-reason">Motif *</Label>
            <Textarea
              id="del-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex. : adresse introuvable, client injoignable..."
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFailOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              loading={failMutation.isPending}
              disabled={reason.trim().length < 3}
              onClick={() => failMutation.mutate()}
            >
              <XCircle className="h-4 w-4" />
              Enregistrer l'échec
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
