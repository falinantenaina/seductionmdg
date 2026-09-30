import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Minus, PackagePlus, Plus, ShoppingBasket, Trash2, UserPlus } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth.store';
import { useListState } from '@/hooks/use-list-state';
import { cartTotal, useOrderStore } from '@/stores/order.store';
import type { ApiResponse, Article, Category, Customer, OrderDetail } from '@/types';
import { formatMoney, formatNumber } from '@/lib/utils';
import { UNIT_LABELS } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { SearchInput } from '@/components/shared/search-input';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

const EMPTY_CUSTOMER = {
  name: '',
  phone: '',
  address: '',
  city: '',
  deliveryPlace: '',
};

export function OrderCreatePage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const canCreate = user?.role === 'ADMIN' || user?.role === 'COMMERCIAL';
  const { search, setSearch } = useListState();
  const [categoryId, setCategoryId] = useState('all');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState(EMPTY_CUSTOMER);
  const queryClient = useQueryClient();
  const store = useOrderStore();

  const articleParams = useMemo(
    () => ({ page: 1, pageSize: 24, ...(search ? { search } : {}), ...(categoryId !== 'all' ? { categoryId } : {}) }),
    [search, categoryId],
  );

  const articlesQuery = useQuery({
    queryKey: queryKeys.articles.list(articleParams),
    queryFn: async () => (await api.get<ApiResponse<Article[]>>('/articles', { params: articleParams })).data,
    enabled: canCreate,
  });

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories.list({ pageSize: 100 }),
    queryFn: async () => (await api.get<ApiResponse<Category[]>>('/categories', { params: { pageSize: 100 } })).data,
    enabled: canCreate,
  });

  const customersQuery = useQuery({
    queryKey: queryKeys.customers.list({ pageSize: 100, search: customerSearch }),
    queryFn: async () =>
      (await api.get<ApiResponse<Customer[]>>('/customers', { params: { pageSize: 100, search: customerSearch } }))
        .data,
    enabled: canCreate,
  });

  /** Création rapide d'un client depuis la création de commande (pas de passage par /customers). */
  const createCustomerMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: newCustomer.name.trim(),
        phone: newCustomer.phone.trim() || null,
        address: newCustomer.address.trim() || null,
        city: newCustomer.city.trim() || null,
        deliveryPlace: newCustomer.deliveryPlace.trim() || null,
      };
      const { data } = await api.post<ApiResponse<Customer>>('/customers', payload);
      return data.data;
    },
    onSuccess: (created) => {
      toast.success(`${created.name} créé et sélectionné`);
      store.setCustomerId(created.id);
      setCustomerDialogOpen(false);
      setNewCustomer(EMPTY_CUSTOMER);
      setCustomerSearch('');
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const createMutation = useMutation({
    mutationFn: async (saveAsDraft: boolean) => {
      const payload = {
        customerId: store.customerId,
        items: store.lines.map((line) => ({ articleId: line.articleId, quantity: line.quantity })),
        comments: store.comments || null,
        deliveryAddress: store.deliveryAddress || null,
        deliveryPlace: store.deliveryPlace || null,
        recipientName: store.recipientName || null,
        recipientPhone: store.recipientPhone || null,
        saveAsDraft,
      };
      const { data } = await api.post<ApiResponse<OrderDetail>>('/orders', payload);
      return data.data;
    },
    onSuccess: (order, saveAsDraft) => {
      toast.success(
        saveAsDraft ? `${order.orderNumber} enregistré comme brouillon` : `${order.orderNumber} créée et réservée`,
      );
      store.clear();
      navigate(`/orders/${order.id}`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (!canCreate) {
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState
          title="Accès non autorisé"
          description="Seuls les commerciaux peuvent créer des commandes."
          action={<Button variant="outline" onClick={() => navigate('/orders')}>Retour aux commandes</Button>}
        />
      </div>
    );
  }

  const articles = articlesQuery.data?.data ?? [];
  const categories = categoriesQuery.data?.data ?? [];
  const customers = customersQuery.data?.data ?? [];
  const lines = store.lines;
  const total = cartTotal(lines);
  const overStock = lines.some((line) => line.quantity > line.stockAvailable);
  const canSubmit = !!store.customerId && lines.length > 0 && !overStock && !createMutation.isPending;
  const customer = customers.find((c) => c.id === store.customerId);

  return (
    <div>
      <PageHeader
        title="Nouvelle commande"
        description="Sélectionnez les articles : la quantité réservée sera décrémentée du disponible à la validation"
        actions={
          <Button variant="outline" onClick={() => navigate('/orders')}>
            <ArrowLeft className="h-4 w-4" />
            Commandes
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Catalogue */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Référence ou désignation..."
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
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {articles.map((article) => {
              const available = article.stockAvailable ?? 0;
              const inCart = lines.find((line) => line.articleId === article.id);
              const soldOut = available <= 0;
              return (
                <Card key={article.id} className={soldOut ? 'opacity-60' : undefined}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">{article.sku}</p>
                        <p className="line-clamp-2 text-sm font-medium">{article.name}</p>
                      </div>
                      <Badge variant={soldOut ? 'destructive' : available <= (article.alertThreshold ?? 0) ? 'warning' : 'success'}>
                        {soldOut ? 'Rupture' : `${formatNumber(available)} ${UNIT_LABELS[article.unit]}`}
                      </Badge>
                    </div>
                    <p className="text-sm font-semibold">{formatMoney(article.price)}</p>
                    <Button
                      size="sm"
                      className="w-full"
                      variant={inCart ? 'secondary' : 'default'}
                      disabled={soldOut || (!!inCart && inCart.quantity >= available)}
                      onClick={() => store.addArticle(article)}
                    >
                      <PackagePlus className="h-4 w-4" />
                      {inCart ? `Au panier (${inCart.quantity})` : 'Ajouter'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {!articlesQuery.isLoading && articles.length === 0 && (
            <div className="rounded-xl border bg-card">
              <EmptyState title="Aucun article" description="Aucun article ne correspond à votre recherche." />
            </div>
          )}
        </div>

        {/* Panier */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <ShoppingBasket className="h-4 w-4" />
                  Panier
                </span>
                <Badge variant="outline">{lines.length} ligne(s)</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="order-customer">Client *</Label>
                <Select value={store.customerId ?? undefined} onValueChange={(value) => store.setCustomerId(value)}>
                  <SelectTrigger id="order-customer">
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.name}
                        {entry.city ? ` — ${entry.city}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={customerSearch}
                  onChange={(event) => setCustomerSearch(event.target.value)}
                  placeholder="Rechercher un client..."
                  className="h-9"
                />
                {customer?.deliveryPlace && (
                  <p className="text-xs text-muted-foreground">Lieu habituel : {customer.deliveryPlace}</p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setCustomerDialogOpen(true)}
                >
                  <UserPlus className="h-4 w-4" />
                  Nouveau client
                </Button>
              </div>

              <Separator />

              {lines.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Panier vide — ajoutez des articles depuis le catalogue.
                </p>
              ) : (
                <div className="space-y-3">
                  {lines.map((line) => (
                    <div key={line.articleId} className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{line.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {line.sku} · {formatMoney(line.price)}/{UNIT_LABELS[line.unit].toLowerCase()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => store.removeLine(line.articleId)}
                          aria-label={`Retirer ${line.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => store.setQuantity(line.articleId, line.quantity - 1)}
                            aria-label="Diminuer"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number"
                            min={0}
                            value={line.quantity}
                            onChange={(event) => store.setQuantity(line.articleId, Number(event.target.value))}
                            className="h-7 w-16 text-center"
                            aria-label={`Quantité ${line.name}`}
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => store.setQuantity(line.articleId, line.quantity + 1)}
                            aria-label="Augmenter"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <span className="text-sm font-medium">{formatMoney(line.price * line.quantity)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Disponible : {formatNumber(line.stockAvailable)}{' '}
                        {line.quantity > line.stockAvailable && (
                          <span className="text-destructive">· quantité supérieure au disponible</span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total ({formatNumber(total)} Ar)</span>
                <span className="text-lg font-semibold">{formatMoney(total)}</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="order-address">Adresse de livraison</Label>
                <Input
                  id="order-address"
                  value={store.deliveryAddress}
                  onChange={(event) => store.setField('deliveryAddress', event.target.value)}
                  placeholder={customer?.address ?? 'Rue, avenue...'}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    aria-label="Lieu de livraison"
                    value={store.deliveryPlace}
                    onChange={(event) => store.setField('deliveryPlace', event.target.value)}
                    placeholder={customer?.deliveryPlace ?? 'Quartier / repère'}
                  />
                  <Input
                    aria-label="Téléphone du destinataire"
                    value={store.recipientPhone}
                    onChange={(event) => store.setField('recipientPhone', event.target.value)}
                    placeholder={customer?.phone ?? 'Téléphone'}
                  />
                </div>
                <Input
                  aria-label="Nom du destinataire"
                  value={store.recipientName}
                  onChange={(event) => store.setField('recipientName', event.target.value)}
                  placeholder="Nom du destinataire"
                />
                <Textarea
                  aria-label="Commentaires"
                  rows={2}
                  value={store.comments}
                  onChange={(event) => store.setField('comments', event.target.value)}
                  placeholder="Instructions particulières..."
                />
              </div>

              <div className="grid gap-2">
                <Button
                  onClick={() => createMutation.mutate(false)}
                  loading={createMutation.isPending}
                  disabled={!canSubmit}
                >
                  Valider la commande
                </Button>
                <Button
                  variant="outline"
                  onClick={() => createMutation.mutate(true)}
                  loading={createMutation.isPending}
                  disabled={!canSubmit}
                >
                  Enregistrer comme brouillon
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                La validation réserve immédiatement les quantités (stock disponible diminué, stock physique inchangé).
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau client</DialogTitle>
            <DialogDescription>
              Le client est créé puis sélectionné automatiquement dans cette commande.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="nc-name">Nom / raison sociale *</Label>
              <Input
                id="nc-name"
                value={newCustomer.name}
                onChange={(event) => setNewCustomer((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Ex. : Hanitra Rasoanaivo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nc-phone">Téléphone</Label>
              <Input
                id="nc-phone"
                value={newCustomer.phone}
                onChange={(event) => setNewCustomer((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="+261 34 00 000 00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nc-city">Ville</Label>
              <Input
                id="nc-city"
                value={newCustomer.city}
                onChange={(event) => setNewCustomer((prev) => ({ ...prev, city: event.target.value }))}
                placeholder="Antananarivo"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="nc-address">Adresse</Label>
              <Input
                id="nc-address"
                value={newCustomer.address}
                onChange={(event) => setNewCustomer((prev) => ({ ...prev, address: event.target.value }))}
                placeholder="Lot, rue, avenue..."
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="nc-place">Lieu de livraison habituel</Label>
              <Input
                id="nc-place"
                value={newCustomer.deliveryPlace}
                onChange={(event) => setNewCustomer((prev) => ({ ...prev, deliveryPlace: event.target.value }))}
                placeholder="Quartier, repère, zone..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomerDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={!newCustomer.name.trim()}
              loading={createCustomerMutation.isPending}
              onClick={() => createCustomerMutation.mutate()}
            >
              Créer et sélectionner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
