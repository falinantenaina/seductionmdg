import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useListState } from '@/hooks/use-list-state';
import { useAuthStore } from '@/stores/auth.store';
import type { ApiResponse, Customer } from '@/types';
import { formatDate, formatNumber } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Pagination } from '@/components/shared/pagination';
import { SearchInput } from '@/components/shared/search-input';
import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TableCell, TableRow } from '@/components/ui/table';

const customerSchema = z.object({
  name: z.string().trim().min(1, 'Nom requis').max(160),
  contactName: z.string().max(120).optional(),
  email: z.email('Email invalide').optional().or(z.literal('')),
  phone: z.string().max(40).optional(),
  address: z.string().max(300).optional(),
  deliveryPlace: z.string().max(300).optional(),
  city: z.string().max(120).optional(),
  notes: z.string().max(1000).optional(),
});

type CustomerValues = z.infer<typeof customerSchema>;

const DEFAULT_VALUES: CustomerValues = {
  name: '',
  contactName: '',
  email: '',
  phone: '',
  address: '',
  deliveryPlace: '',
  city: '',
  notes: '',
};

export function CustomersPage() {
  const user = useAuthStore((state) => state.user);
  const canWrite = user?.role === 'ADMIN' || user?.role === 'COMMERCIAL' || user?.role === 'FACTURIER';
  const canDelete = user?.role === 'ADMIN' || user?.role === 'COMMERCIAL';
  const { search, page, pageSize, setSearch, setPage, setPageSize } = useListState();
  const [editing, setEditing] = useState<Customer | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const queryClient = useQueryClient();

  const params = useMemo(() => ({ page, pageSize, ...(search ? { search } : {}) }), [page, pageSize, search]);

  const customersQuery = useQuery({
    queryKey: queryKeys.customers.list(params),
    queryFn: async () => (await api.get<ApiResponse<Customer[]>>('/customers', { params })).data,
  });

  const form = useForm<CustomerValues>({ resolver: zodResolver(customerSchema), defaultValues: DEFAULT_VALUES });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['customers'] });

  const saveMutation = useMutation({
    mutationFn: async (values: CustomerValues) => {
      const payload = {
        ...values,
        email: values.email || null,
        contactName: values.contactName || null,
        phone: values.phone || null,
        address: values.address || null,
        deliveryPlace: values.deliveryPlace || null,
        city: values.city || null,
        notes: values.notes || null,
      };
      if (editing) return (await api.put(`/customers/${editing.id}`, payload)).data;
      return (await api.post('/customers', payload)).data;
    },
    onSuccess: () => {
      toast.success(editing ? 'Client modifié' : 'Client créé');
      setDialogOpen(false);
      setEditing(null);
      form.reset(DEFAULT_VALUES);
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (customer: Customer) => (await api.delete(`/customers/${customer.id}`)).data,
    onSuccess: () => {
      toast.success('Client désactivé');
      setDeleting(null);
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const customers = customersQuery.data?.data ?? [];

  const openCreate = () => {
    setEditing(null);
    form.reset(DEFAULT_VALUES);
    setDialogOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditing(customer);
    form.reset({
      name: customer.name,
      contactName: customer.contactName ?? '',
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      address: customer.address ?? '',
      deliveryPlace: customer.deliveryPlace ?? '',
      city: customer.city ?? '',
      notes: customer.notes ?? '',
    });
    setDialogOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Coordonnées et lieux de livraison"
        actions={
          canWrite && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nouveau client
            </Button>
          )
        }
      />

      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Nom, contact, téléphone, ville..."
          className="w-full sm:max-w-sm"
        />
      </div>

      <DataTable
        loading={customersQuery.isLoading}
        error={customersQuery.error ? getErrorMessage(customersQuery.error) : null}
        onRetry={() => void customersQuery.refetch()}
        isEmpty={!customersQuery.isLoading && customers.length === 0}
        emptyTitle="Aucun client"
        emptyDescription="Ajoutez vos clients pour créer des commandes."
        emptyAction={
          canWrite ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Ajouter
            </Button>
          ) : null
        }
        headers={['Client', 'Contact', 'Téléphone', 'Ville / lieu', 'Commandes', 'Statut', ...(canWrite ? ['Actions'] : [])]}
      >
        {customers.map((customer) => (
          <TableRow key={customer.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                </span>
                <div className="flex flex-col">
                  <span className="font-medium">{customer.name}</span>
                  {customer.email && <span className="text-xs text-muted-foreground">{customer.email}</span>}
                </div>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">{customer.contactName ?? '—'}</TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">{customer.phone ?? '—'}</TableCell>
            <TableCell className="max-w-[200px] truncate text-muted-foreground">
              {[customer.city, customer.deliveryPlace].filter(Boolean).join(' · ') || customer.address || '—'}
            </TableCell>
            <TableCell>{formatNumber(customer._count?.orders ?? 0)}</TableCell>
            <TableCell>
              <Badge variant={customer.isActive ? 'success' : 'muted'}>
                {customer.isActive ? 'Actif' : 'Inactif'}
              </Badge>
            </TableCell>
            {canWrite && (
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(customer)}
                    aria-label={`Modifier ${customer.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleting(customer)}
                      aria-label={`Désactiver ${customer.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </DataTable>

      <div className="mt-4">
        <Pagination meta={customersQuery.data?.meta} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier le client' : 'Nouveau client'}</DialogTitle>
            <DialogDescription>
              Créé le {editing ? formatDate(editing.createdAt) : '—'} · les informations serviront à la facturation et
              à la livraison.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Raison sociale / nom" htmlFor="c-name" required error={form.formState.errors.name?.message}>
                <Input id="c-name" {...form.register('name')} />
              </FormField>
              <FormField label="Contact" htmlFor="c-contact" error={form.formState.errors.contactName?.message}>
                <Input id="c-contact" {...form.register('contactName')} placeholder="Nom du destinataire" />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Téléphone" htmlFor="c-phone" error={form.formState.errors.phone?.message}>
                <Input id="c-phone" {...form.register('phone')} placeholder="+261 34 00 000 00" />
              </FormField>
              <FormField label="Email" htmlFor="c-email" error={form.formState.errors.email?.message}>
                <Input id="c-email" type="email" {...form.register('email')} />
              </FormField>
            </div>

            <FormField label="Adresse" htmlFor="c-address" error={form.formState.errors.address?.message}>
              <Input id="c-address" {...form.register('address')} />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Lieu de livraison" htmlFor="c-place" error={form.formState.errors.deliveryPlace?.message}>
                <Input id="c-place" {...form.register('deliveryPlace')} />
              </FormField>
              <FormField label="Ville" htmlFor="c-city" error={form.formState.errors.city?.message}>
                <Input id="c-city" {...form.register('city')} />
              </FormField>
            </div>

            <FormField label="Notes" htmlFor="c-notes" error={form.formState.errors.notes?.message}>
              <Textarea id="c-notes" {...form.register('notes')} rows={2} />
            </FormField>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" loading={saveMutation.isPending}>
                {editing ? 'Enregistrer' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Désactiver le client ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {deleting?.name} » ne sera plus proposé pour les nouvelles commandes. L'historique est conservé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleting && deleteMutation.mutate(deleting)}
            >
              Désactiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
