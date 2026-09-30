import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Download, FilePlus2, FileText } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { downloadInvoicePdf } from '@/lib/pdf';
import { useListState } from '@/hooks/use-list-state';
import { useAuthStore } from '@/stores/auth.store';
import type { ApiResponse, InvoiceDetail, InvoiceListItem, InvoiceStatus, OrderListItem } from '@/types';
import { formatDate, formatMoney } from '@/lib/utils';
import { INVOICE_STATUS_LABELS } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Pagination } from '@/components/shared/pagination';
import { SearchInput } from '@/components/shared/search-input';
import { InvoiceStatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableCell, TableRow } from '@/components/ui/table';

const STATUSES = Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[];
const BILLABLE_STATUSES = ['COMMANDE', 'EN_FACTURATION'];

const DELIVERY_FIELDS = ['deliveryAddress', 'deliveryPlace', 'recipientName', 'recipientPhone'] as const;
type DeliveryField = (typeof DELIVERY_FIELDS)[number];
type DeliveryValues = Record<DeliveryField, string>;

const EMPTY_DELIVERY: DeliveryValues = {
  deliveryAddress: '',
  deliveryPlace: '',
  recipientName: '',
  recipientPhone: '',
};

export function InvoicesPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const canWrite = user?.role === 'FACTURIER' || user?.role === 'ADMIN';
  const { search, page, pageSize, setSearch, setPage, setPageSize } = useListState();
  const [status, setStatus] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saveAsDraft, setSaveAsDraft] = useState(true);
  const [delivery, setDelivery] = useState<DeliveryValues>(EMPTY_DELIVERY);
  const [initialDelivery, setInitialDelivery] = useState<DeliveryValues>(EMPTY_DELIVERY);
  const [downloading, setDownloading] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const params = useMemo(
    () => ({ page, pageSize, ...(search ? { search } : {}), ...(status !== 'all' ? { status } : {}) }),
    [page, pageSize, search, status],
  );

  const invoicesQuery = useQuery({
    queryKey: queryKeys.invoices.list(params),
    queryFn: async () => (await api.get<ApiResponse<InvoiceListItem[]>>('/invoices', { params })).data,
  });

  const billableQuery = useQuery({
    queryKey: queryKeys.orders.list({ billable: true }),
    queryFn: async () =>
      (await api.get<ApiResponse<OrderListItem[]>>('/orders', { params: { pageSize: 100 } })).data,
    enabled: dialogOpen && canWrite,
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setOrderId('');
    setDueDate('');
    setNotes('');
    setDelivery(EMPTY_DELIVERY);
    setInitialDelivery(EMPTY_DELIVERY);
  };

  const invoices = invoicesQuery.data?.data ?? [];
  const billable = (billableQuery.data?.data ?? []).filter(
    (order) => !order.invoice && BILLABLE_STATUSES.includes(order.status),
  );

  const selectOrder = (value: string) => {
    setOrderId(value);
    const order = billable.find((entry) => entry.id === value);
    const fromOrder: DeliveryValues = {
      deliveryAddress: order?.deliveryAddress ?? '',
      deliveryPlace: order?.deliveryPlace ?? '',
      recipientName: order?.recipientName ?? '',
      recipientPhone: order?.recipientPhone ?? '',
    };
    setInitialDelivery(fromOrder);
    setDelivery(fromOrder);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      // Seuls les champs de livraison modifiés sont envoyés (les autres restent inchangés).
      const deliveryPayload: Partial<Record<DeliveryField, string | null>> = {};
      for (const field of DELIVERY_FIELDS) {
        if (delivery[field] !== initialDelivery[field]) {
          deliveryPayload[field] = delivery[field].trim() || null;
        }
      }
      const { data } = await api.post<ApiResponse<InvoiceDetail>>('/invoices', {
        orderId,
        dueDate: dueDate || null,
        notes: notes || null,
        saveAsDraft,
        ...deliveryPayload,
      });
      return data.data;
    },
    onSuccess: (invoice) => {
      toast.success(`${invoice.invoiceNumber} créée`);
      closeDialog();
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      navigate(`/invoices/${invoice.id}`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const download = async (invoice: InvoiceListItem) => {
    setDownloading(invoice.id);
    try {
      await downloadInvoicePdf(invoice.id, invoice.invoiceNumber);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Factures"
        description="Émission, encaissement et téléchargement PDF"
        actions={
          canWrite && (
            <Button onClick={() => setDialogOpen(true)}>
              <FilePlus2 className="h-4 w-4" />
              Nouvelle facture
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="N° facture, commande, client..."
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
                {INVOICE_STATUS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        loading={invoicesQuery.isLoading}
        error={invoicesQuery.error ? getErrorMessage(invoicesQuery.error) : null}
        onRetry={() => void invoicesQuery.refetch()}
        isEmpty={!invoicesQuery.isLoading && invoices.length === 0}
        emptyTitle="Aucune facture"
        emptyDescription="Les factures émises à partir d'une commande apparaîtront ici."
        emptyAction={
          canWrite ? (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <FilePlus2 className="h-4 w-4" />
              Créer une facture
            </Button>
          ) : null
        }
        headers={['Facture', 'Client', 'Commande', 'Émission', 'Échéance', 'Montant', 'Statut', '']}
      >
        {invoices.map((invoice) => (
          <TableRow key={invoice.id} className="cursor-pointer" onClick={() => navigate(`/invoices/${invoice.id}`)}>
            <TableCell>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </span>
                <span className="font-medium">{invoice.invoiceNumber}</span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium">{invoice.customer.name}</span>
                <span className="text-xs text-muted-foreground">{invoice.customer.phone ?? '—'}</span>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">{invoice.order.orderNumber}</TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(invoice.issueDate)}</TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">
              {invoice.dueDate ? formatDate(invoice.dueDate) : '—'}
            </TableCell>
            <TableCell className="whitespace-nowrap font-medium">{formatMoney(invoice.total)}</TableCell>
            <TableCell>
              <InvoiceStatusBadge status={invoice.status} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Télécharger ${invoice.invoiceNumber}`}
                  disabled={downloading === invoice.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    void download(invoice);
                  }}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Ouvrir ${invoice.invoiceNumber}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate(`/invoices/${invoice.id}`);
                  }}
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </DataTable>

      <div className="mt-4">
        <Pagination meta={invoicesQuery.data?.meta} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
          else setDialogOpen(true);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle facture</DialogTitle>
            <DialogDescription>
              La facture est générée à partir d'une commande non facturée. Un brouillon passe la commande en « en
              facturation », une facture émise la passe en « facturée ».
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inv-order">Commande *</Label>
              <Select value={orderId} onValueChange={selectOrder} disabled={billableQuery.isLoading}>
                <SelectTrigger id="inv-order">
                  <SelectValue placeholder={billableQuery.isLoading ? 'Chargement...' : 'Sélectionner une commande'} />
                </SelectTrigger>
                <SelectContent>
                  {billable.map((order) => (
                    <SelectItem key={order.id} value={order.id}>
                      {order.orderNumber} — {order.customer?.name} · {formatMoney(order.total)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!billableQuery.isLoading && billable.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Aucune commande éligible : facturez une commande validée (statut « Commande »).
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="inv-due">Échéance</Label>
              <Input
                id="inv-due"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inv-notes">Note affichée sur la facture</Label>
              <Textarea
                id="inv-notes"
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Ex. : Paiement à 15 jours"
              />
            </div>

            {orderId && (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Livraison et contact</p>
                  <p className="text-xs text-muted-foreground">
                    Renseignez ou corrigez le lieu de livraison et le contact du destinataire : ces informations
                    apparaîtront sur la facture, la fiche de livraison et pour le dispatcher.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="inv-delivery-place">Lieu de livraison</Label>
                    <Input
                      id="inv-delivery-place"
                      value={delivery.deliveryPlace}
                      onChange={(event) => setDelivery((prev) => ({ ...prev, deliveryPlace: event.target.value }))}
                      placeholder="Quartier, repère, zone..."
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="inv-delivery-address">Adresse de livraison</Label>
                    <Input
                      id="inv-delivery-address"
                      value={delivery.deliveryAddress}
                      onChange={(event) => setDelivery((prev) => ({ ...prev, deliveryAddress: event.target.value }))}
                      placeholder="Lot, rue, avenue..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inv-recipient">Destinataire</Label>
                    <Input
                      id="inv-recipient"
                      value={delivery.recipientName}
                      onChange={(event) => setDelivery((prev) => ({ ...prev, recipientName: event.target.value }))}
                      placeholder="Nom de la personne à contacter"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inv-recipient-phone">Téléphone du destinataire</Label>
                    <Input
                      id="inv-recipient-phone"
                      value={delivery.recipientPhone}
                      onChange={(event) => setDelivery((prev) => ({ ...prev, recipientPhone: event.target.value }))}
                      placeholder="+261 34 00 000 00"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button
                variant={saveAsDraft ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setSaveAsDraft(true)}
                type="button"
              >
                Enregistrer comme brouillon
              </Button>
              <Button
                variant={saveAsDraft ? 'outline' : 'default'}
                className="flex-1"
                onClick={() => setSaveAsDraft(false)}
                type="button"
              >
                Émettre immédiatement
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {saveAsDraft
                ? 'Le brouillon sera à émettre depuis la fiche de la facture.'
                : 'La facture sera émise tout de suite et le PDF disponible.'}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Annuler
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
              disabled={!orderId}
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
