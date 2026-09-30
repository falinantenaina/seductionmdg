import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Phone, Plus, Truck, UserRound } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useListState } from '@/hooks/use-list-state';
import type { ApiResponse, DeliveryPerson, User } from '@/types';
import { formatNumber, fullName } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Pagination } from '@/components/shared/pagination';
import { SearchInput } from '@/components/shared/search-input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableCell, TableRow } from '@/components/ui/table';

const EMPTY_FORM = { name: '', phone: '', vehicle: '', userId: '', isActive: true };

export function DeliveryPersonsPage() {
  const { search, page, pageSize, setSearch, setPage, setPageSize } = useListState();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryPerson | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => ({ page, pageSize, ...(search ? { search } : {}) }), [page, pageSize, search]);

  const peopleQuery = useQuery({
    queryKey: queryKeys.deliveryPeople.list(params),
    queryFn: async () => (await api.get<ApiResponse<DeliveryPerson[]>>('/delivery-persons', { params })).data,
  });

  const accountsQuery = useQuery({
    queryKey: queryKeys.users.list({ role: 'LIVREUR', pageSize: 100 }),
    queryFn: async () =>
      (await api.get<ApiResponse<User[]>>('/users', { params: { role: 'LIVREUR', pageSize: 100 } })).data,
    enabled: dialogOpen,
  });

  const people = peopleQuery.data?.data ?? [];
  const accounts = accountsQuery.data?.data ?? [];
  const takenUserIds = new Set(people.map((person) => person.userId).filter(Boolean));

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (person: DeliveryPerson) => {
    setEditing(person);
    setForm({
      name: person.name,
      phone: person.phone,
      vehicle: person.vehicle ?? '',
      userId: person.userId ?? '',
      isActive: person.isActive,
    });
    setError(null);
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        vehicle: form.vehicle.trim() || null,
        userId: form.userId || null,
        ...(editing ? { isActive: form.isActive } : {}),
      };
      if (editing) return (await api.patch(`/delivery-persons/${editing.id}`, payload)).data;
      return (await api.post('/delivery-persons', payload)).data;
    },
    onSuccess: () => {
      toast.success(editing ? 'Profil livreur mis à jour' : 'Profil livreur créé');
      void queryClient.invalidateQueries({ queryKey: ['delivery-people'] });
      closeDialog();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const toggleActive = useMutation({
    mutationFn: async (person: DeliveryPerson) =>
      (await api.patch(`/delivery-persons/${person.id}`, { isActive: !person.isActive })).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['delivery-people'] });
      toast.success('Statut mis à jour');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const submit = () => {
    if (form.name.trim().length < 2) return setError('Nom trop court');
    if (form.phone.trim().length < 5) return setError('Téléphone invalide');
    saveMutation.mutate();
  };

  return (
    <div>
      <PageHeader
        title="Livreurs"
        description="Profils de livraison, comptes rattachés et affectations"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouveau livreur
          </Button>
        }
      />

      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Nom, téléphone, véhicule..."
          className="w-full sm:max-w-xs"
        />
      </div>

      <DataTable
        loading={peopleQuery.isLoading}
        error={peopleQuery.error ? getErrorMessage(peopleQuery.error) : null}
        onRetry={() => void peopleQuery.refetch()}
        isEmpty={!peopleQuery.isLoading && people.length === 0}
        emptyTitle="Aucun livreur"
        emptyDescription="Créez un profil livreur pour pouvoir affecter les fiches de livraison."
        emptyAction={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Créer un livreur
          </Button>
        }
        headers={['Livreur', 'Téléphone', 'Véhicule', 'Compte', 'Livraisons', 'Statut', '']}
      >
        {people.map((person) => (
          <TableRow key={person.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent">
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                </span>
                <span className="font-medium">{person.name}</span>
              </div>
            </TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {person.phone}
              </span>
            </TableCell>
            <TableCell className="text-muted-foreground">
              <span className="flex items-center gap-1">
                <Truck className="h-3.5 w-3.5" />
                {person.vehicle ?? '—'}
              </span>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {person.user ? person.user.email : <span className="text-xs">Aucun compte</span>}
            </TableCell>
            <TableCell className="text-muted-foreground">{formatNumber(person._count?.deliveries ?? 0)}</TableCell>
            <TableCell>
              {person.isActive ? (
                <Badge variant="success">Actif</Badge>
              ) : (
                <Badge variant="muted">Désactivé</Badge>
              )}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={person.isActive ? `Désactiver ${person.name}` : `Activer ${person.name}`}
                  onClick={() => toggleActive.mutate(person)}
                  disabled={toggleActive.isPending}
                >
                  <Checkbox checked={person.isActive} className="pointer-events-none" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Modifier ${person.name}`}
                  onClick={() => openEdit(person)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </DataTable>

      <div className="mt-4">
        <Pagination meta={peopleQuery.data?.meta} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? `Modifier ${editing.name}` : 'Nouveau livreur'}</DialogTitle>
            <DialogDescription>
              Le compte rattaché (rôle Livreur) permet au livreur de démarrer et valider ses fiches.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="person-name">Nom complet *</Label>
              <Input
                id="person-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Ex. : Farid Livraison"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="person-phone">Téléphone *</Label>
                <Input
                  id="person-phone"
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                  placeholder="+261 34 00..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="person-vehicle">Véhicule</Label>
                <Input
                  id="person-vehicle"
                  value={form.vehicle}
                  onChange={(event) => setForm((prev) => ({ ...prev, vehicle: event.target.value }))}
                  placeholder="Ex. : Toyota Hilux"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="person-account">Compte livreur rattaché</Label>
              <Select
                value={form.userId || 'none'}
                onValueChange={(value) => setForm((prev) => ({ ...prev, userId: value === 'none' ? '' : value }))}
              >
                <SelectTrigger id="person-account">
                  <SelectValue placeholder="Aucun compte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun compte</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id} disabled={takenUserIds.has(account.id)}>
                      {fullName(account)} — {account.email}
                      {takenUserIds.has(account.id) ? ' (rattaché)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Comptes disponibles : {formatNumber(accounts.length)} utilisateur(s) de rôle Livreur.
              </p>
            </div>

            {editing && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked === true }))}
                />
                Profil actif (autorisé à recevoir des affectations)
              </label>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Annuler
            </Button>
            <Button loading={saveMutation.isPending} onClick={submit}>
              {editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
