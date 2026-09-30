import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AlertTriangle, ArrowDownToLine, History, ListRestart, PackagePlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, getErrorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useListState } from '@/hooks/use-list-state';
import { useAuthStore } from '@/stores/auth.store';
import type { ApiResponse, Article } from '@/types';
import { UNIT_LABELS } from '@/lib/constants';
import { cn, formatNumber } from '@/lib/utils';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableCell, TableRow } from '@/components/ui/table';

const entrySchema = z.object({
  articleId: z.string().min(1, 'Article requis'),
  quantity: z.number({ error: 'Quantité requise' }).int().positive('Quantité positive requise'),
  comment: z.string().max(500).optional(),
});

const adjustmentSchema = z.object({
  articleId: z.string().min(1, 'Article requis'),
  newPhysical: z.number({ error: 'Valeur requise' }).int().min(0, 'Valeur positive requise'),
  comment: z.string().max(500).optional(),
});

type EntryValues = z.infer<typeof entrySchema>;
type AdjustmentValues = z.infer<typeof adjustmentSchema>;

type DialogMode = 'entry' | 'adjustment' | null;

export function StocksPage() {
  const user = useAuthStore((state) => state.user);
  const canWrite = user?.role === 'MAGASINIER' || user?.role === 'ADMIN';
  const canSeeHistory = user?.role === 'MAGASINIER' || user?.role === 'ADMIN';
  const { search, page, pageSize, setSearch, setPage, setPageSize } = useListState();
  const [lowStock, setLowStock] = useState('all');
  const [mode, setMode] = useState<DialogMode>(null);
  const [selected, setSelected] = useState<Article | null>(null);
  const queryClient = useQueryClient();

  const params = useMemo(
    () => ({
      page,
      pageSize,
      ...(search ? { search } : {}),
      ...(lowStock === 'low' ? { lowStock: 'true' } : {}),
    }),
    [page, pageSize, search, lowStock],
  );

  const stocksQuery = useQuery({
    queryKey: queryKeys.stocks.list(params),
    queryFn: async () => (await api.get<ApiResponse<Article[]>>('/stocks', { params })).data,
  });

  const allArticlesQuery = useQuery({
    queryKey: queryKeys.articles.list({ pageSize: 100, forSelect: true }),
    queryFn: async () =>
      (await api.get<ApiResponse<Article[]>>('/articles', { params: { pageSize: 100 } })).data,
  });

  const entryForm = useForm<EntryValues>({ resolver: zodResolver(entrySchema) });
  const adjustmentForm = useForm<AdjustmentValues>({ resolver: zodResolver(adjustmentSchema) });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['stocks'] });
    void queryClient.invalidateQueries({ queryKey: ['articles'] });
  };

  const entryMutation = useMutation({
    mutationFn: async (values: EntryValues) => (await api.post('/stocks/entry', values)).data,
    onSuccess: () => {
      toast.success('Entrée de stock enregistrée');
      closeDialog();
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const adjustmentMutation = useMutation({
    mutationFn: async (values: AdjustmentValues) => (await api.post('/stocks/adjustment', values)).data,
    onSuccess: () => {
      toast.success('Ajustement enregistré');
      closeDialog();
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const openDialog = (dialogMode: DialogMode, article: Article) => {
    setSelected(article);
    setMode(dialogMode);
    entryForm.reset({ articleId: article.id, quantity: 0, comment: '' });
    adjustmentForm.reset({ articleId: article.id, newPhysical: article.stockPhysical, comment: '' });
  };

  const closeDialog = () => {
    setMode(null);
    setSelected(null);
  };

  const openEntryFromHeader = () => {
    setSelected(null);
    setMode('entry');
    entryForm.reset({ articleId: '', quantity: 0, comment: '' });
  };

  const articles = stocksQuery.data?.data ?? [];
  const selectArticles = allArticlesQuery.data?.data ?? [];
  const lowCount = articles.filter((article) => article.lowStock).length;

  return (
    <div>
      <PageHeader
        title="État des stocks"
        description="Stock physique, réservé et disponible de chaque article"
        actions={
          <>
            {canSeeHistory && (
              <Button variant="outline" asChild>
                <Link to="/stocks/movements">
                  <History className="h-4 w-4" />
                  Mouvements
                </Link>
              </Button>
            )}
            {canWrite && (
              <Button variant="outline" onClick={openEntryFromHeader}>
                <PackagePlus className="h-4 w-4" />
                Entrée
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Rechercher par référence ou nom..."
          className="w-full sm:max-w-xs"
        />
        <Select value={lowStock} onValueChange={setLowStock}>
          <SelectTrigger className="h-9 w-full sm:w-52" aria-label="Filtre stock">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les articles</SelectItem>
            <SelectItem value="low">Stock faible uniquement</SelectItem>
          </SelectContent>
        </Select>
        {lowCount > 0 && (
          <Badge variant="warning" className="w-fit">
            <AlertTriangle className="h-3 w-3" />
            {lowCount} article(s) sous le seuil
          </Badge>
        )}
      </div>

      <DataTable
        loading={stocksQuery.isLoading}
        error={stocksQuery.error ? getErrorMessage(stocksQuery.error) : null}
        onRetry={() => void stocksQuery.refetch()}
        isEmpty={!stocksQuery.isLoading && articles.length === 0}
        emptyTitle="Aucun article en stock"
        emptyDescription="Aucun article ne correspond à la recherche."
        headers={[
          'Référence',
          'Article',
          'Catégorie',
          'Physique',
          'Réservé',
          'Disponible',
          'Seuil',
          ...(canWrite ? ['Actions'] : []),
        ]}
      >
        {articles.map((article) => (
          <TableRow key={article.id} className={cn(article.lowStock && 'bg-amber-50/50')}>
            <TableCell className="font-medium">{article.sku}</TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span>{article.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatNumber(article.stockAvailable ?? 0)} {UNIT_LABELS[article.unit]} disponible(s)
                </span>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">{article.category?.name ?? '—'}</TableCell>
            <TableCell>{formatNumber(article.stockPhysical)}</TableCell>
            <TableCell className={cn(article.stockReserved > 0 && 'font-medium text-amber-600')}>
              {formatNumber(article.stockReserved)}
            </TableCell>
            <TableCell>
              <span
                className={cn(
                  'font-medium',
                  (article.stockAvailable ?? 0) <= 0 && 'text-destructive',
                  article.lowStock && (article.stockAvailable ?? 0) > 0 && 'text-amber-600',
                )}
              >
                {formatNumber(article.stockAvailable ?? 0)}
              </span>
            </TableCell>
            <TableCell className="text-muted-foreground">{formatNumber(article.alertThreshold)}</TableCell>
            {canWrite && (
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Entrée de stock"
                    aria-label={`Entrée pour ${article.sku}`}
                    onClick={() => openDialog('entry', article)}
                  >
                    <ArrowDownToLine className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Ajustement d'inventaire"
                    aria-label={`Ajustement pour ${article.sku}`}
                    onClick={() => openDialog('adjustment', article)}
                  >
                    <ListRestart className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </DataTable>

      <div className="mt-4">
        <Pagination meta={stocksQuery.data?.meta} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      <Dialog open={mode !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === 'entry' ? 'Entrée de stock' : 'Ajustement d\'inventaire'}
            </DialogTitle>
            <DialogDescription>
              {selected
                ? `${selected.sku} — ${selected.name}`
                : mode === 'entry'
                  ? 'Sélectionnez l\'article concerné par cette entrée.'
                  : ''}
              {selected && (
                <span className="mt-1 block">
                  Physique : {formatNumber(selected.stockPhysical)} · Réservé :{' '}
                  {formatNumber(selected.stockReserved)} · Disponible :{' '}
                  {formatNumber(selected.stockAvailable ?? 0)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {mode === 'entry' && (
            <form
              onSubmit={entryForm.handleSubmit((values) => entryMutation.mutate(values))}
              className="space-y-4"
            >
              {!selected && (
                <FormField
                  label="Article"
                  htmlFor="entry-article"
                  required
                  error={entryForm.formState.errors.articleId?.message}
                >
                  <Select
                    value={entryForm.watch('articleId')}
                    onValueChange={(value) => entryForm.setValue('articleId', value)}
                  >
                    <SelectTrigger id="entry-article">
                      <SelectValue placeholder="Choisir un article" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectArticles.map((article) => (
                        <SelectItem key={article.id} value={article.id}>
                          {article.sku} — {article.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              )}
              <FormField
                label="Quantité entrée"
                htmlFor="entry-quantity"
                required
                error={entryForm.formState.errors.quantity?.message}
              >
                <Input id="entry-quantity" type="number" min="1" {...entryForm.register('quantity', { valueAsNumber: true })} />
              </FormField>
              <FormField label="Commentaire" htmlFor="entry-comment" error={entryForm.formState.errors.comment?.message}>
                <Textarea
                  id="entry-comment"
                  {...entryForm.register('comment')}
                  placeholder="Réception fournisseur, retour, transfert..."
                />
              </FormField>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Annuler
                </Button>
                <Button type="submit" loading={entryMutation.isPending}>
                  Valider l'entrée
                </Button>
              </DialogFooter>
            </form>
          )}

          {mode === 'adjustment' && (
            <form
              onSubmit={adjustmentForm.handleSubmit((values) => adjustmentMutation.mutate(values))}
              className="space-y-4"
            >
              <FormField
                label="Nouveau stock physique"
                htmlFor="adj-value"
                required
                error={adjustmentForm.formState.errors.newPhysical?.message}
                hint={
                  selected
                    ? `Valeur actuelle : ${formatNumber(selected.stockPhysical)} — ne peut être inférieure à la quantité réservée (${formatNumber(selected.stockReserved)})`
                    : undefined
                }
              >
                <Input id="adj-value" type="number" min="0" {...adjustmentForm.register('newPhysical', { valueAsNumber: true })} />
              </FormField>
              <FormField
                label="Commentaire"
                htmlFor="adj-comment"
                required
                error={adjustmentForm.formState.errors.comment?.message}
                hint="Obligatoire : l'ajustement doit être justifié (traçabilité)"
              >
                <Textarea id="adj-comment" {...adjustmentForm.register('comment')} placeholder="Inventaire tournant, casse, correction..." />
              </FormField>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Annuler
                </Button>
                <Button type="submit" loading={adjustmentMutation.isPending}>
                  Enregistrer l'ajustement
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
