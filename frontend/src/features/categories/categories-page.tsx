import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useListState } from '@/hooks/use-list-state';
import { useAuthStore } from '@/stores/auth.store';
import type { ApiResponse, Category } from '@/types';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Pagination } from '@/components/shared/pagination';
import { SearchInput } from '@/components/shared/search-input';
import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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

const categorySchema = z.object({
  name: z.string().trim().min(1, 'Nom requis').max(120),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]*$/, 'Minuscules, chiffres et tirets uniquement')
    .max(140),
  description: z.string().max(1000).optional(),
  parentId: z.string().optional(),
  isActive: z.boolean(),
});

type CategoryValues = z.infer<typeof categorySchema>;

const DEFAULT_VALUES: CategoryValues = {
  name: '',
  slug: '',
  description: '',
  parentId: '',
  isActive: true,
};

export function CategoriesPage() {
  const user = useAuthStore((state) => state.user);
  const canWrite = user?.role === 'ADMIN';
  const { search, page, pageSize, setSearch, setPage, setPageSize } = useListState();
  const [editing, setEditing] = useState<Category | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const queryClient = useQueryClient();

  const params = useMemo(() => ({ page, pageSize, ...(search ? { search } : {}) }), [page, pageSize, search]);

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories.list(params),
    queryFn: async () => (await api.get<ApiResponse<Category[]>>('/categories', { params })).data,
  });

  const form = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: DEFAULT_VALUES,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['categories'] });

  const saveMutation = useMutation({
    mutationFn: async (values: CategoryValues) => {
      const payload = {
        name: values.name,
        slug: values.slug || undefined,
        description: values.description || null,
        parentId: values.parentId || null,
        isActive: values.isActive,
      };
      if (editing) return (await api.put(`/categories/${editing.id}`, payload)).data;
      return (await api.post('/categories', payload)).data;
    },
    onSuccess: () => {
      toast.success(editing ? 'Catégorie modifiée' : 'Catégorie créée');
      setDialogOpen(false);
      setEditing(null);
      form.reset(DEFAULT_VALUES);
      invalidate();
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories.list({ pageSize: 100 }) });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (category: Category) => (await api.delete(`/categories/${category.id}`)).data,
    onSuccess: () => {
      toast.success('Catégorie désactivée');
      setDeleting(null);
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const categories = categoriesQuery.data?.data ?? [];
  const parentOptions = categories.filter((category) => category.id !== editing?.id);

  const openCreate = () => {
    setEditing(null);
    form.reset(DEFAULT_VALUES);
    setDialogOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    form.reset({
      name: category.name,
      slug: category.slug,
      description: category.description ?? '',
      parentId: category.parentId ?? '',
      isActive: category.isActive,
    });
    setDialogOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Catégories"
        description="Organisation du catalogue par famille d'articles"
        actions={
          canWrite && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nouvelle catégorie
            </Button>
          )
        }
      />

      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Rechercher une catégorie..."
          className="w-full sm:max-w-xs"
        />
      </div>

      <DataTable
        loading={categoriesQuery.isLoading}
        error={categoriesQuery.error ? getErrorMessage(categoriesQuery.error) : null}
        onRetry={() => void categoriesQuery.refetch()}
        isEmpty={!categoriesQuery.isLoading && categories.length === 0}
        emptyTitle="Aucune catégorie"
        emptyDescription="Créez une première catégorie pour organiser votre catalogue."
        emptyAction={
          canWrite ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Créer
            </Button>
          ) : null
        }
        headers={['Nom', 'Slug', 'Description', 'Articles', 'Statut', ...(canWrite ? ['Actions'] : [])]}
      >
        {categories.map((category) => (
          <TableRow key={category.id}>
            <TableCell className="font-medium">
              <span className="flex items-center gap-2">
                <Tags className="h-4 w-4 text-muted-foreground" />
                {category.name}
              </span>
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">{category.slug}</TableCell>
            <TableCell className="max-w-[280px] truncate text-muted-foreground">
              {category.description ?? '—'}
            </TableCell>
            <TableCell>{category._count?.articles ?? 0}</TableCell>
            <TableCell>
              <Badge variant={category.isActive ? 'success' : 'muted'}>
                {category.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </TableCell>
            {canWrite && (
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(category)}
                    aria-label={`Modifier ${category.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleting(category)}
                    aria-label={`Désactiver ${category.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </DataTable>

      <div className="mt-4">
        <Pagination meta={categoriesQuery.data?.meta} onPageChange={setPage} onPageSizeChange={setPageSize} />
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
            <DialogTitle>{editing ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</DialogTitle>
            <DialogDescription>Le slug est généré automatiquement s'il n'est pas précisé.</DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))} className="space-y-4">
            <FormField label="Nom" htmlFor="cat-name" required error={form.formState.errors.name?.message}>
              <Input id="cat-name" {...form.register('name')} placeholder="Électronique" />
            </FormField>

            <FormField label="Slug" htmlFor="cat-slug" error={form.formState.errors.slug?.message} hint="Optionnel — généré depuis le nom">
              <Input id="cat-slug" {...form.register('slug')} placeholder="electronique" />
            </FormField>

            <FormField label="Description" htmlFor="cat-description" error={form.formState.errors.description?.message}>
              <Textarea id="cat-description" {...form.register('description')} rows={2} />
            </FormField>

            <FormField label="Catégorie parente" htmlFor="cat-parent">
              <Select
                value={form.watch('parentId') || 'none'}
                onValueChange={(value) => form.setValue('parentId', value === 'none' ? '' : value)}
              >
                <SelectTrigger id="cat-parent">
                  <SelectValue placeholder="Aucune" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune (racine)</SelectItem>
                  {parentOptions.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <div className="flex items-center gap-2">
              <Checkbox
                id="cat-active"
                checked={form.watch('isActive')}
                onCheckedChange={(checked) => form.setValue('isActive', checked === true)}
              />
              <label htmlFor="cat-active" className="text-sm font-medium">
                Catégorie active
              </label>
            </div>

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
            <AlertDialogTitle>Désactiver la catégorie ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {deleting?.name} » sera marquée comme inactive. Les articles associés sont conservés.
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
