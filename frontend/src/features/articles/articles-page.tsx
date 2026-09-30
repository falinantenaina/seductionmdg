import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useListState } from '@/hooks/use-list-state';
import { useAuthStore } from '@/stores/auth.store';
import type { ApiResponse, Article, Category } from '@/types';
import { UNIT_LABELS } from '@/lib/constants';
import { cn, formatMoney, formatNumber } from '@/lib/utils';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableCell, TableRow } from '@/components/ui/table';

const articleSchema = z.object({
  sku: z.string().trim().min(1, 'Référence requise').max(60),
  name: z.string().trim().min(1, 'Nom requis').max(160),
  description: z.string().max(2000).optional().nullable(),
  categoryId: z.string().optional(),
  unit: z.enum(['PIECE', 'KG', 'LITRE', 'METRE', 'CARTON', 'BOITE', 'PALET']),
  price: z.number({ error: 'Prix invalide' }).min(0, 'Prix invalide'),
  alertThreshold: z.number({ error: 'Seuil invalide' }).int().min(0, 'Seuil invalide'),
  isActive: z.boolean(),
  initialQuantity: z.number({ error: 'Quantité invalide' }).int().min(0, 'Quantité invalide'),
});

type ArticleValues = z.infer<typeof articleSchema>;

const DEFAULT_VALUES: ArticleValues = {
  sku: '',
  name: '',
  description: '',
  categoryId: '',
  unit: 'PIECE',
  price: 0,
  alertThreshold: 0,
  isActive: true,
  initialQuantity: 0,
};

export function ArticlesPage() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';
  const { search, page, pageSize, setSearch, setPage, setPageSize } = useListState();
  const [categoryId, setCategoryId] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [editing, setEditing] = useState<Article | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Article | null>(null);
  const queryClient = useQueryClient();

  const params = useMemo(
    () => ({
      page,
      pageSize,
      ...(search ? { search } : {}),
      ...(categoryId !== 'all' ? { categoryId } : {}),
      ...(stockFilter === 'low' ? { lowStock: 'true' } : {}),
      ...(stockFilter === 'available' ? { inStock: 'true' } : {}),
    }),
    [page, pageSize, search, categoryId, stockFilter],
  );

  const articlesQuery = useQuery({
    queryKey: queryKeys.articles.list(params),
    queryFn: async () => (await api.get<ApiResponse<Article[]>>('/articles', { params })).data,
  });

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories.list({ pageSize: 100 }),
    queryFn: async () =>
      (await api.get<ApiResponse<Category[]>>('/categories', { params: { pageSize: 100 } })).data,
  });

  const form = useForm<ArticleValues>({
    resolver: zodResolver(articleSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['articles'] });
    void queryClient.invalidateQueries({ queryKey: ['stocks'] });
  };

  const saveMutation = useMutation({
    mutationFn: async (values: ArticleValues) => {
      const payload = {
        ...values,
        categoryId: values.categoryId || null,
        description: values.description || null,
      };
      if (editing) {
        const { initialQuantity: _ignored, ...updatePayload } = payload;
        return (await api.put(`/articles/${editing.id}`, updatePayload)).data;
      }
      return (await api.post('/articles', payload)).data;
    },
    onSuccess: () => {
      toast.success(editing ? 'Article modifié' : 'Article créé');
      setDialogOpen(false);
      setEditing(null);
      form.reset(DEFAULT_VALUES);
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (article: Article) => (await api.delete(`/articles/${article.id}`)).data,
    onSuccess: () => {
      toast.success('Article désactivé');
      setDeleting(null);
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const openCreate = () => {
    setEditing(null);
    form.reset(DEFAULT_VALUES);
    setDialogOpen(true);
  };

  const openEdit = (article: Article) => {
    setEditing(article);
    form.reset({
      sku: article.sku,
      name: article.name,
      description: article.description ?? '',
      categoryId: article.categoryId ?? '',
      unit: article.unit,
      price: Number(article.price),
      alertThreshold: article.alertThreshold,
      isActive: article.isActive,
      initialQuantity: 0,
    });
    setDialogOpen(true);
  };

  const articles = articlesQuery.data?.data ?? [];
  const categories = categoriesQuery.data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Catalogue des articles"
        description="Références, prix et état du stock disponible"
        actions={
          isAdmin && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nouvel article
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Rechercher par référence ou nom..."
          className="w-full sm:max-w-xs"
        />
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="h-9 w-full sm:w-52" aria-label="Catégorie">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="h-9 w-full sm:w-48" aria-label="Disponibilité">
            <SelectValue placeholder="Disponibilité" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les états</SelectItem>
            <SelectItem value="available">Disponible &gt; 0</SelectItem>
            <SelectItem value="low">Stock faible</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        loading={articlesQuery.isLoading}
        error={articlesQuery.error ? getErrorMessage(articlesQuery.error) : null}
        onRetry={() => void articlesQuery.refetch()}
        isEmpty={!articlesQuery.isLoading && articles.length === 0}
        emptyTitle="Aucun article"
        emptyDescription="Aucun article ne correspond aux filtres sélectionnés."
        emptyAction={
          isAdmin ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Ajouter un article
            </Button>
          ) : null
        }
        headers={[
          'Référence',
          'Désignation',
          'Catégorie',
          'Prix unitaire',
          'Physique',
          'Réservé',
          'Disponible',
          ...(isAdmin ? ['Actions'] : []),
        ]}
      >
        {articles.map((article) => (
            <TableRow key={article.id}>
              <TableCell className="font-medium">{article.sku}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span>{article.name}</span>
                  {!article.isActive && (
                    <Badge variant="muted" className="mt-0.5 w-fit">
                      Inactif
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{article.category?.name ?? '—'}</TableCell>
              <TableCell className="whitespace-nowrap">
                {formatMoney(article.price)}
                <span className="ml-1 text-xs text-muted-foreground">/ {UNIT_LABELS[article.unit]}</span>
              </TableCell>
              <TableCell>{formatNumber(article.stockPhysical)}</TableCell>
              <TableCell className={cn(article.stockReserved > 0 && 'text-amber-600')}>
                {formatNumber(article.stockReserved)}
              </TableCell>
              <TableCell>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 font-medium',
                    (article.stockAvailable ?? 0) <= 0 && 'text-destructive',
                    (article.stockAvailable ?? 0) > 0 &&
                      (article.stockAvailable ?? 0) <= article.alertThreshold &&
                      'text-amber-600',
                  )}
                >
                  {formatNumber(article.stockAvailable ?? 0)}
                  {article.lowStock && <AlertTriangle className="h-3.5 w-3.5" />}
                </span>
              </TableCell>
              {isAdmin && (
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(article)}
                      aria-label={`Modifier ${article.sku}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleting(article)}
                      aria-label={`Désactiver ${article.sku}`}
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
        <Pagination meta={articlesQuery.data?.meta} onPageChange={setPage} onPageSizeChange={setPageSize} />
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
            <DialogTitle>{editing ? `Modifier ${editing.sku}` : 'Nouvel article'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Les quantités de stock ne se modifient pas ici : utilisez les mouvements de stock.'
                : 'Le stock initial est enregistré comme une entrée tracée.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Référence / SKU" htmlFor="sku" required error={form.formState.errors.sku?.message}>
                <Input id="sku" {...form.register('sku')} placeholder="ART-001" />
              </FormField>

              <FormField label="Nom" htmlFor="name" required error={form.formState.errors.name?.message}>
                <Input id="name" {...form.register('name')} placeholder="Désignation de l'article" />
              </FormField>
            </div>

            <FormField
              label="Description"
              htmlFor="description"
              error={form.formState.errors.description?.message}
            >
              <Textarea id="description" {...form.register('description')} rows={2} />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Catégorie" htmlFor="categoryId">
                <Select
                  value={form.watch('categoryId') || 'none'}
                  onValueChange={(value) => form.setValue('categoryId', value === 'none' ? '' : value)}
                >
                  <SelectTrigger id="categoryId">
                    <SelectValue placeholder="Sans catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sans catégorie</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Unité" htmlFor="unit" required error={form.formState.errors.unit?.message}>
                <Select
                  value={form.watch('unit')}
                  onValueChange={(value) => form.setValue('unit', value as ArticleValues['unit'])}
                >
                  <SelectTrigger id="unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(UNIT_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Prix unitaire" htmlFor="price" required error={form.formState.errors.price?.message}>
                <Input id="price" type="number" step="0.01" min="0" {...form.register('price', { valueAsNumber: true })} />
              </FormField>

              <FormField
                label="Seuil d'alerte"
                htmlFor="alertThreshold"
                error={form.formState.errors.alertThreshold?.message}
              >
                <Input id="alertThreshold" type="number" min="0" {...form.register('alertThreshold', { valueAsNumber: true })} />
              </FormField>

              {!editing && (
                <FormField
                  label="Stock initial"
                  htmlFor="initialQuantity"
                  error={form.formState.errors.initialQuantity?.message}
                  hint="Enregistré en entrée tracée"
                >
                  <Input id="initialQuantity" type="number" min="0" {...form.register('initialQuantity', { valueAsNumber: true })} />
                </FormField>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="isActive"
                checked={form.watch('isActive')}
                onCheckedChange={(checked) => form.setValue('isActive', checked === true)}
              />
              <label htmlFor="isActive" className="text-sm font-medium">
                Article actif
              </label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setEditing(null);
                }}
              >
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
            <AlertDialogTitle>Désactiver l'article ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.sku} — {deleting?.name} sera marqué comme inactif et n'apparaîtra plus dans le catalogue.
              L'historique des mouvements est conservé.
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
