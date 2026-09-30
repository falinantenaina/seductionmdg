import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useListState } from '@/hooks/use-list-state';
import type { ApiResponse, Role, User } from '@/types';
import { ROLE_LABELS } from '@/lib/constants';
import { formatDate, fullName } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Pagination } from '@/components/shared/pagination';
import { SearchInput } from '@/components/shared/search-input';
import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableCell, TableRow } from '@/components/ui/table';

const ROLES: Role[] = ['ADMIN', 'COMMERCIAL', 'FACTURIER', 'MAGASINIER', 'DISPATCHER', 'LIVREUR'];

const userSchema = z.object({
  email: z.email('Email invalide'),
  password: z.string().min(8, '8 caractères minimum').optional(),
  firstName: z.string().trim().min(1, 'Prénom requis').max(80),
  lastName: z.string().trim().min(1, 'Nom requis').max(80),
  phone: z.string().max(40).optional(),
  role: z.enum(['ADMIN', 'COMMERCIAL', 'FACTURIER', 'MAGASINIER', 'DISPATCHER', 'LIVREUR']),
  isActive: z.boolean(),
});

type UserValues = z.infer<typeof userSchema>;

const DEFAULT_VALUES: UserValues = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  phone: '',
  role: 'COMMERCIAL',
  isActive: true,
};

export function UsersPage() {
  const { search, page, pageSize, setSearch, setPage, setPageSize } = useListState();
  const [roleFilter, setRoleFilter] = useState('all');
  const [editing, setEditing] = useState<User | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deactivating, setDeactivating] = useState<User | null>(null);
  const queryClient = useQueryClient();

  const params = useMemo(
    () => ({
      page,
      pageSize,
      ...(search ? { search } : {}),
      ...(roleFilter !== 'all' ? { role: roleFilter } : {}),
    }),
    [page, pageSize, search, roleFilter],
  );

  const usersQuery = useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: async () => (await api.get<ApiResponse<User[]>>('/users', { params })).data,
  });

  const form = useForm<UserValues>({ resolver: zodResolver(userSchema), defaultValues: DEFAULT_VALUES });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['users'] });

  const saveMutation = useMutation({
    mutationFn: async (values: UserValues) => {
      const base = {
        email: values.email,
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone || null,
        role: values.role,
        isActive: values.isActive,
      };
      if (editing) {
        return (
          await api.put(`/users/${editing.id}`, {
            ...base,
            ...(values.password ? { password: values.password } : {}),
          })
        ).data;
      }
      return (await api.post('/users', { ...base, password: values.password })).data;
    },
    onSuccess: () => {
      toast.success(editing ? 'Utilisateur modifié' : 'Utilisateur créé');
      setDialogOpen(false);
      setEditing(null);
      form.reset(DEFAULT_VALUES);
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (user: User) => (await api.delete(`/users/${user.id}`)).data,
    onSuccess: () => {
      toast.success('Compte désactivé');
      setDeactivating(null);
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const users = usersQuery.data?.data ?? [];

  const openCreate = () => {
    setEditing(null);
    form.reset(DEFAULT_VALUES);
    setDialogOpen(true);
  };

  const openEdit = (user: User) => {
    setEditing(user);
    form.reset({
      email: user.email,
      password: '',
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? '',
      role: user.role,
      isActive: user.isActive,
    });
    setDialogOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Utilisateurs"
        description="Comptes et rôles de l'application"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouvel utilisateur
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Nom, prénom ou email..."
          className="w-full sm:max-w-xs"
        />
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="h-9 w-full sm:w-52" aria-label="Rôle">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            {ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {ROLE_LABELS[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        loading={usersQuery.isLoading}
        error={usersQuery.error ? getErrorMessage(usersQuery.error) : null}
        onRetry={() => void usersQuery.refetch()}
        isEmpty={!usersQuery.isLoading && users.length === 0}
        emptyTitle="Aucun utilisateur"
        emptyDescription="Créez un compte pour donner un accès à l'application."
        emptyAction={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Créer
          </Button>
        }
        headers={['Utilisateur', 'Email', 'Téléphone', 'Rôle', 'Créé le', 'Statut', 'Actions']}
      >
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold uppercase">
                  {user.firstName[0]}
                  {user.lastName[0]}
                </span>
                <span className="font-medium">{fullName(user)}</span>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">{user.email}</TableCell>
            <TableCell className="text-muted-foreground">{user.phone ?? '—'}</TableCell>
            <TableCell>
              <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>{ROLE_LABELS[user.role]}</Badge>
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
              {formatDate(user.createdAt)}
            </TableCell>
            <TableCell>
              <Badge variant={user.isActive ? 'success' : 'muted'}>
                {user.isActive ? 'Actif' : 'Inactif'}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEdit(user)}
                  aria-label={`Modifier ${fullName(user)}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setDeactivating(user)}
                  aria-label={`Désactiver ${fullName(user)}`}
                  disabled={!user.isActive}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </DataTable>

      <div className="mt-4">
        <Pagination meta={usersQuery.data?.meta} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Laissez le mot de passe vide pour le conserver.'
                : 'Le rôle détermine les pages et actions accessibles.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Prénom" htmlFor="u-first" required error={form.formState.errors.firstName?.message}>
                <Input id="u-first" {...form.register('firstName')} />
              </FormField>
              <FormField label="Nom" htmlFor="u-last" required error={form.formState.errors.lastName?.message}>
                <Input id="u-last" {...form.register('lastName')} />
              </FormField>
            </div>

            <FormField label="Email" htmlFor="u-email" required error={form.formState.errors.email?.message}>
              <Input id="u-email" type="email" {...form.register('email')} />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Mot de passe"
                htmlFor="u-password"
                required={!editing}
                error={form.formState.errors.password?.message}
              >
                <Input id="u-password" type="password" autoComplete="new-password" {...form.register('password')} />
              </FormField>
              <FormField label="Téléphone" htmlFor="u-phone" error={form.formState.errors.phone?.message}>
                <Input id="u-phone" {...form.register('phone')} placeholder="+261 34 00 000 00" />
              </FormField>
            </div>

            <FormField label="Rôle" htmlFor="u-role" required error={form.formState.errors.role?.message}>
              <Select
                value={form.watch('role')}
                onValueChange={(value) => form.setValue('role', value as Role)}
              >
                <SelectTrigger id="u-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={form.watch('isActive')}
                onChange={(event) => form.setValue('isActive', event.target.checked)}
              />
              Compte actif
            </label>

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

      <AlertDialog open={!!deactivating} onOpenChange={(open) => !open && setDeactivating(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Désactiver le compte ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivating ? fullName(deactivating) : ''} ne pourra plus se connecter. L'historique de ses
              opérations est conservé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deactivating && deactivateMutation.mutate(deactivating)}
            >
              Désactiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
