import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarRange, History, PackageCheck, ShoppingCart, TrendingUp, Wallet, XCircle } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useListState } from '@/hooks/use-list-state';
import type { ApiResponse, AuditFacets, AuditLogEntry, ReportStats } from '@/types';
import { formatDate, formatMoney, formatNumber, formatShortDate } from '@/lib/utils';
import {
  DELIVERY_STATUS_LABELS,
  MOVEMENT_TYPE_LABELS,
  ORDER_STATUS_LABELS,
  ROLE_LABELS,
} from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { SearchInput } from '@/components/shared/search-input';
import { Pagination } from '@/components/shared/pagination';
import { DataTable } from '@/components/shared/data-table';
import { BreakdownBars, TrendChart } from '@/components/shared/charts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableCell, TableRow } from '@/components/ui/table';

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function rangeOf(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
  accent?: 'default' | 'success' | 'warning';
}

function KpiCard({ label, value, hint, icon: Icon, accent = 'default' }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon
          className={
            accent === 'success'
              ? 'h-4 w-4 text-emerald-600'
              : accent === 'warning'
                ? 'h-4 w-4 text-amber-600'
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
}

function ReportPanel({ range }: { range: { from: string; to: string } }) {
  const params = { from: range.from, to: range.to };

  const reportQuery = useQuery({
    queryKey: queryKeys.stats.report(params),
    queryFn: async () => (await api.get<ApiResponse<ReportStats>>('/stats/report', { params })).data,
  });

  const report = reportQuery.data?.data;

  return (
    <div className="space-y-6">
      {reportQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-[110px]" />
          ))}
        </div>
      ) : !report ? (
        <p className="text-sm text-destructive">{getErrorMessage(reportQuery.error)}</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              label="Chiffre d'affaires encaissé"
              value={formatMoney(report.kpis.revenue)}
              icon={Wallet}
              accent="success"
              hint={`${report.range.days} jour(s) analysés`}
            />
            <KpiCard
              label="Commandes enregistrées"
              value={formatNumber(report.kpis.orders)}
              icon={ShoppingCart}
              hint={`${formatNumber(report.kpis.orderedQuantity)} article(s) commandé(s)`}
            />
            <KpiCard
              label="Panier moyen"
              value={formatMoney(report.kpis.avgBasket)}
              icon={TrendingUp}
              hint="CA encaissé ÷ commandes"
            />
            <KpiCard
              label="Commandes livrées"
              value={formatNumber(report.kpis.delivered)}
              icon={PackageCheck}
              accent="success"
            />
            <KpiCard
              label="Sorties magasin"
              value={formatNumber(report.kpis.exits)}
              icon={History}
            />
            <KpiCard
              label="Échecs de livraison"
              value={formatNumber(report.kpis.failedDeliveries)}
              icon={XCircle}
              accent={report.kpis.failedDeliveries > 0 ? 'warning' : 'default'}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Encaissements par jour</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart
                  points={report.series.map((point) => ({
                    label: formatShortDate(point.date),
                    value: point.revenue,
                  }))}
                  formatValue={(value) => formatMoney(value)}
                  height={170}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Commandes par jour</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart
                  points={report.series.map((point) => ({
                    label: formatShortDate(point.date),
                    value: point.orders,
                  }))}
                  height={170}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Meilleurs articles (CA)</CardTitle>
              </CardHeader>
              <CardContent>
                <BreakdownBars
                  items={report.topArticles.map((article) => ({
                    label: article.name,
                    value: article.revenue,
                    hint: `${article.sku} · ${formatNumber(article.quantity)} unité(s)`,
                  }))}
                  formatValue={(value) => formatMoney(value)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">CA par catégorie</CardTitle>
              </CardHeader>
              <CardContent>
                <BreakdownBars
                  items={report.byCategory.map((category) => ({
                    label: category.name,
                    value: category.revenue,
                    hint: `${formatNumber(category.quantity)} unité(s)`,
                  }))}
                  formatValue={(value) => formatMoney(value)}
                />
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Commandes par statut</CardTitle>
                </CardHeader>
                <CardContent>
                  <BreakdownBars
                    items={report.ordersByStatus.map((row) => ({
                      label: ORDER_STATUS_LABELS[row.status] ?? row.status,
                      value: row.count,
                    }))}
                    className="space-y-2"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Livraisons par statut</CardTitle>
                </CardHeader>
                <CardContent>
                  <BreakdownBars
                    items={report.deliveriesByStatus.map((row) => ({
                      label: DELIVERY_STATUS_LABELS[row.status] ?? row.status,
                      value: row.count,
                    }))}
                    className="space-y-2"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Mouvements de stock</CardTitle>
                </CardHeader>
                <CardContent>
                  <BreakdownBars
                    items={report.movementsByType.map((row) => ({
                      label: MOVEMENT_TYPE_LABELS[row.type] ?? row.type,
                      value: row.count,
                    }))}
                    className="space-y-2"
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const ALL = 'ALL';

function AuditPanel() {
  const { search, page, pageSize, setSearch, setPage, setPageSize } = useListState();
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const facetsQuery = useQuery({
    queryKey: queryKeys.audit.facets,
    queryFn: async () => (await api.get<ApiResponse<AuditFacets>>('/audit/facets')).data,
  });

  const params = useMemo(
    () => ({
      page,
      pageSize,
      ...(search ? { search } : {}),
      ...(action ? { action } : {}),
      ...(entity ? { entity } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    }),
    [page, pageSize, search, action, entity, from, to],
  );

  const auditQuery = useQuery({
    queryKey: queryKeys.audit.list(params),
    queryFn: async () => (await api.get<ApiResponse<AuditLogEntry[]>>('/audit', { params })).data,
  });

  const entries = auditQuery.data?.data ?? [];
  const meta = auditQuery.data?.meta;
  const actions = facetsQuery.data?.data.actions ?? [];
  const entities = facetsQuery.data?.data.entities ?? [];

  const changeFilter = (update: () => void) => {
    update();
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex-1">
          <Label className="mb-1.5 block text-xs text-muted-foreground">Recherche</Label>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Action, entité, identifiant, e-mail..."
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">Action</Label>
          <Select
            value={action || ALL}
            onValueChange={(value) => changeFilter(() => setAction(value === ALL ? '' : value))}
          >
            <SelectTrigger className="h-9 w-full lg:w-52" aria-label="Action">
              <SelectValue placeholder="Toutes les actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes les actions</SelectItem>
              {actions.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.value} ({item.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">Entité</Label>
          <Select
            value={entity || ALL}
            onValueChange={(value) => changeFilter(() => setEntity(value === ALL ? '' : value))}
          >
            <SelectTrigger className="h-9 w-full lg:w-44" aria-label="Entité">
              <SelectValue placeholder="Toutes les entités" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes les entités</SelectItem>
              {entities.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.value} ({item.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">Du</Label>
          <Input
            type="date"
            className="h-9 w-full lg:w-40"
            value={from}
            onChange={(event) => changeFilter(() => setFrom(event.target.value))}
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">Au</Label>
          <Input
            type="date"
            className="h-9 w-full lg:w-40"
            value={to}
            onChange={(event) => changeFilter(() => setTo(event.target.value))}
          />
        </div>
      </div>

      <DataTable
        loading={auditQuery.isLoading}
        error={auditQuery.error ? getErrorMessage(auditQuery.error) : null}
        onRetry={() => void auditQuery.refetch()}
        isEmpty={!auditQuery.isLoading && entries.length === 0}
        emptyTitle="Aucune trace"
        emptyDescription="Aucune opération ne correspond à ces filtres."
        headers={['Date', 'Utilisateur', 'Action', 'Entité', 'Détail']}
      >
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
              {formatDate(entry.createdAt)}
            </TableCell>
            <TableCell>
              {entry.user ? (
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {entry.user.firstName} {entry.user.lastName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {ROLE_LABELS[entry.user.role]} · {entry.user.email}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Système</span>
              )}
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{entry.action}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{entry.entity}</Badge>
            </TableCell>
            <TableCell className="max-w-[320px]">
              <code className="line-clamp-2 block text-xs text-muted-foreground">
                {entry.newValue ? JSON.stringify(entry.newValue) : '—'}
              </code>
            </TableCell>
          </TableRow>
        ))}
      </DataTable>

      <Pagination meta={meta} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </div>
  );
}

export function StatisticsPage() {
  const [tab, setTab] = useState('report');
  const [range, setRange] = useState(() => rangeOf(30));
  const invalidRange = range.from > range.to;

  const applyPreset = (days: number) => setRange(rangeOf(days));

  return (
    <div>
      <PageHeader
        title="Statistiques"
        description="Pilotage commercial, stock et livraisons + journal d'audit"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {[7, 30, 90].map((days) => (
              <Button
                key={days}
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => applyPreset(days)}
              >
                {days} jours
              </Button>
            ))}
            <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
              <CalendarRange className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                className="h-7 w-36 border-none p-0 text-xs"
                value={range.from}
                aria-label="Date de début"
                onChange={(event) =>
                  setRange((current) => ({ ...current, from: event.target.value }))
                }
              />
              <span className="text-xs text-muted-foreground">→</span>
              <Input
                type="date"
                className="h-7 w-36 border-none p-0 text-xs"
                value={range.to}
                aria-label="Date de fin"
                onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))}
              />
            </div>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="report">Indicateurs</TabsTrigger>
          <TabsTrigger value="audit">Journal d'audit</TabsTrigger>
        </TabsList>

        <TabsContent value="report" className="mt-4">
          {invalidRange ? (
            <p className="text-sm text-destructive">
              La date de début doit précéder la date de fin.
            </p>
          ) : (
            <ReportPanel range={range} />
          )}
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <AuditPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
