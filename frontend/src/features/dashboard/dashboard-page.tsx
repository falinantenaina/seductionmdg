import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  History,
  Package,
  PackageCheck,
  Percent,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth.store';
import type { ApiResponse, DashboardStats, Role } from '@/types';
import { ORDER_STATUS_LABELS, ROLE_LABELS } from '@/lib/constants';
import { formatDate, formatMoney, formatNumber, formatShortDate } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { BreakdownBars, TrendChart } from '@/components/shared/charts';
import { OrderStatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  hint?: string;
  to?: string;
  accent?: 'default' | 'warning' | 'success';
}

function StatCard({ label, value, icon: Icon, hint, to, accent = 'default' }: StatCardProps) {
  const body = (
    <Card className={to ? 'transition-colors hover:border-primary/50' : ''}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon
          className={
            accent === 'warning'
              ? 'h-4 w-4 text-amber-600'
              : accent === 'success'
                ? 'h-4 w-4 text-emerald-600'
                : 'h-4 w-4 text-muted-foreground'
          }
        />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );

  return to ? <Link to={to}>{body}</Link> : body;
}

function buildCards(role: Role | undefined, stats: DashboardStats | undefined): StatCardProps[] {
  if (!stats) return [];
  const { orders, revenue, stock, deliveries, people } = stats;

  if (role === 'LIVREUR') {
    return [
      {
        label: 'Livraisons à faire',
        value: formatNumber(deliveries.open),
        icon: Truck,
        hint: 'Fiches affectées ou à affecter',
        to: '/deliveries',
        accent: deliveries.open > 0 ? 'warning' : 'default',
      },
      {
        label: 'Livrées ce mois',
        value: formatNumber(deliveries.deliveredMonth),
        icon: PackageCheck,
        accent: 'success',
      },
      {
        label: 'Échecs de livraison',
        value: formatNumber(deliveries.failed),
        icon: AlertTriangle,
        accent: deliveries.failed > 0 ? 'warning' : 'default',
      },
      {
        label: 'Espace',
        value: ROLE_LABELS[role],
        icon: Boxes,
        hint: 'Rôle connecté',
      },
    ];
  }

  if (role === 'MAGASINIER') {
    return [
      {
        label: 'Commandes à préparer',
        value: formatNumber(orders.pending),
        icon: ShoppingCart,
        hint: `${formatNumber(orders.total)} au total`,
        to: '/warehouse',
        accent: orders.pending > 0 ? 'warning' : 'default',
      },
      {
        label: 'Articles au catalogue',
        value: formatNumber(stock.articles),
        icon: Package,
        to: '/articles',
      },
      {
        label: 'Stock faible',
        value: formatNumber(stock.lowStock),
        icon: AlertTriangle,
        hint: 'Sous le seuil d\'alerte',
        to: '/stocks?filter=low',
        accent: stock.lowStock > 0 ? 'warning' : 'default',
      },
      {
        label: 'Valeur du stock',
        value: formatMoney(stock.value),
        icon: Wallet,
        hint: 'Prix d\'achat × physique',
        to: '/stocks',
      },
    ];
  }

  if (role === 'DISPATCHER') {
    return [
      {
        label: 'Commandes',
        value: formatNumber(orders.total),
        icon: ShoppingCart,
        hint: `${formatNumber(orders.month)} ce mois`,
        to: '/orders',
      },
      {
        label: 'Livraisons à faire',
        value: formatNumber(deliveries.open),
        icon: Truck,
        hint: 'À affecter ou en cours',
        to: '/deliveries',
        accent: deliveries.open > 0 ? 'warning' : 'default',
      },
      {
        label: 'Livrées ce mois',
        value: formatNumber(deliveries.deliveredMonth),
        icon: PackageCheck,
        accent: 'success',
      },
      {
        label: 'Échecs de livraison',
        value: formatNumber(deliveries.failed),
        icon: AlertTriangle,
        accent: deliveries.failed > 0 ? 'warning' : 'default',
      },
    ];
  }

  const cards: StatCardProps[] = [
    {
      label: role === 'COMMERCIAL' ? 'Mes commandes' : 'Commandes',
      value: formatNumber(orders.total),
      icon: ShoppingCart,
      hint: `${formatNumber(orders.month)} ce mois · ${formatNumber(orders.pending)} à traiter`,
      to: '/orders',
      accent: orders.pending > 0 ? 'warning' : 'default',
    },
    {
      label: role === 'COMMERCIAL' ? 'Mes ventes encaissées' : 'Chiffre d\'affaires',
      value: formatMoney(revenue.total),
      icon: Wallet,
      hint: `${formatMoney(revenue.month)} ce mois · ${formatMoney(revenue.today)} aujourd'hui`,
      to: '/statistics',
      accent: 'success',
    },
    {
      label: 'Articles au catalogue',
      value: formatNumber(stock.articles),
      icon: Package,
      hint: `${formatNumber(stock.lowStock)} en stock faible`,
      to: '/articles',
      accent: stock.lowStock > 0 ? 'warning' : 'default',
    },
    {
      label: 'Clients actifs',
      value: formatNumber(people.customers),
      icon: Users,
      to: '/customers',
    },
  ];

  return cards;
}

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role;

  const statsQuery = useQuery({
    queryKey: queryKeys.dashboard.stats({}),
    queryFn: async () => (await api.get<ApiResponse<DashboardStats>>('/stats/dashboard')).data,
  });

  const stats = statsQuery.data?.data;
  const cards = buildCards(role, stats);
  const canSeeStock = role === 'ADMIN' || role === 'MAGASINIER' || role === 'COMMERCIAL';
  const showOrders = role !== 'LIVREUR';
  const loading = statsQuery.isLoading;

  return (
    <div>
      <PageHeader
        title={`Bonjour ${user?.firstName ?? ''}`}
        description={role ? `Espace ${ROLE_LABELS[role]}` : undefined}
        actions={
          <>
            {role === 'ADMIN' && (
              <Button variant="outline" asChild>
                <Link to="/statistics">
                  <BarChart3 className="h-4 w-4" />
                  Statistiques
                </Link>
              </Button>
            )}
            {(role === 'MAGASINIER' || role === 'ADMIN') && (
              <Button variant="outline" asChild>
                <Link to="/stocks/movements">
                  <History className="h-4 w-4" />
                  Mouvements
                </Link>
              </Button>
            )}
          </>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[118px]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>
      )}

      {stats && !loading && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-base">Commandes — {stats.range.days} derniers jours</CardTitle>
              <Badge variant="secondary">{formatNumber(stats.orders.today)} aujourd'hui</Badge>
            </CardHeader>
            <CardContent>
              <TrendChart
                points={stats.series.map((point) => ({
                  label: formatShortDate(point.date),
                  value: point.orders,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-base">Encaissements — {stats.range.days} derniers jours</CardTitle>
              <Badge variant="success">{formatMoney(stats.revenue.today)}</Badge>
            </CardHeader>
            <CardContent>
              <TrendChart
                points={stats.series.map((point) => ({
                  label: formatShortDate(point.date),
                  value: point.revenue,
                }))}
                formatValue={(value) => formatMoney(value)}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {canSeeStock && (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Alertes de stock
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/stocks">
                  Voir tout
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {(stats?.lowStock.length ?? 0) === 0 ? (
                <EmptyState
                  icon={<PackageCheck className="h-5 w-5" />}
                  title="Aucune alerte"
                  description="Tous les articles sont au-dessus de leur seuil d'alerte."
                  className="py-8"
                />
              ) : (
                stats?.lowStock.map((article) => (
                  <div
                    key={article.id}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{article.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {article.sku} · seuil {formatNumber(article.alertThreshold)}
                      </p>
                    </div>
                    <Badge variant="warning">{formatNumber(article.stockPhysical)} restant(s)</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {showOrders && (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="h-4 w-4 text-primary" />
                Dernières commandes
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/orders">
                  Voir tout
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {(stats?.recentOrders.length ?? 0) === 0 ? (
                <EmptyState
                  icon={<ShoppingCart className="h-5 w-5" />}
                  title="Aucune commande"
                  description="Les commandes récentes apparaîtront ici."
                  className="py-8"
                />
              ) : (
                stats?.recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    to={`/orders/${order.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors hover:border-primary/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{order.orderNumber}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {order.customer.name} · {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <OrderStatusBadge status={order.status} />
                      <span className="text-xs font-medium">{formatMoney(order.total)}</span>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Percent className="h-4 w-4 text-primary" />
              Répartition des commandes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownBars
              items={Object.entries(stats?.orders.byStatus ?? {})
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => ({
                  label:
                    ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS] ??
                    status.replace(/_/g, ' '),
                  value: count,
                }))}
              className="space-y-2.5"
            />
            <div className="mt-5 grid gap-2">
              {(role === 'ADMIN' || role === 'MAGASINIER') && (
                <Button variant="outline" className="justify-between" asChild>
                  <Link to="/stocks">
                    Historique des mouvements
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
              {role === 'ADMIN' && (
                <Button variant="outline" className="justify-between" asChild>
                  <Link to="/users">
                    Gérer les utilisateurs
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
              {(role === 'ADMIN' || role === 'DISPATCHER') && (
                <Button variant="outline" className="justify-between" asChild>
                  <Link to="/deliveries">
                    Suivi des livraisons
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
              <Button variant="outline" className="justify-between" asChild>
                <Link to="/notifications">
                  Mes notifications
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {statsQuery.error && (
        <p className="mt-4 text-sm text-destructive">{getErrorMessage(statsQuery.error)}</p>
      )}
    </div>
  );
}
