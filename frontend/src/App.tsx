import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/app-layout';
import { Toaster } from '@/components/ui/sonner';
import { LoginPage } from '@/features/auth/login-page';
import { NotFoundPage } from '@/features/errors/not-found-page';

const DashboardPage = lazy(() =>
  import('@/features/dashboard/dashboard-page').then((module) => ({ default: module.DashboardPage })),
);
const ArticlesPage = lazy(() =>
  import('@/features/articles/articles-page').then((module) => ({ default: module.ArticlesPage })),
);
const CategoriesPage = lazy(() =>
  import('@/features/categories/categories-page').then((module) => ({ default: module.CategoriesPage })),
);
const StocksPage = lazy(() =>
  import('@/features/stocks/stocks-page').then((module) => ({ default: module.StocksPage })),
);
const StockMovementsPage = lazy(() =>
  import('@/features/stocks/stock-movements-page').then((module) => ({ default: module.StockMovementsPage })),
);
const UsersPage = lazy(() =>
  import('@/features/users/users-page').then((module) => ({ default: module.UsersPage })),
);
const CustomersPage = lazy(() =>
  import('@/features/customers/customers-page').then((module) => ({ default: module.CustomersPage })),
);
const OrdersPage = lazy(() =>
  import('@/features/orders/orders-page').then((module) => ({ default: module.OrdersPage })),
);
const OrderCreatePage = lazy(() =>
  import('@/features/orders/order-create-page').then((module) => ({ default: module.OrderCreatePage })),
);
const OrderDetailPage = lazy(() =>
  import('@/features/orders/order-detail-page').then((module) => ({ default: module.OrderDetailPage })),
);
const InvoicesPage = lazy(() =>
  import('@/features/invoices/invoices-page').then((module) => ({ default: module.InvoicesPage })),
);
const InvoiceDetailPage = lazy(() =>
  import('@/features/invoices/invoice-detail-page').then((module) => ({ default: module.InvoiceDetailPage })),
);
const WarehousePage = lazy(() =>
  import('@/features/warehouse/warehouse-page').then((module) => ({ default: module.WarehousePage })),
);
const DeliveriesPage = lazy(() =>
  import('@/features/deliveries/deliveries-page').then((module) => ({ default: module.DeliveriesPage })),
);
const DeliveryDetailPage = lazy(() =>
  import('@/features/deliveries/delivery-detail-page').then((module) => ({ default: module.DeliveryDetailPage })),
);
const DeliveryPersonsPage = lazy(() =>
  import('@/features/delivery-persons/delivery-persons-page').then((module) => ({
    default: module.DeliveryPersonsPage,
  })),
);
const NotificationsPage = lazy(() =>
  import('@/features/notifications/notifications-page').then((module) => ({ default: module.NotificationsPage })),
);
const StatisticsPage = lazy(() =>
  import('@/features/statistics/statistics-page').then((module) => ({ default: module.StatisticsPage })),
);

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span className="text-sm">Chargement…</span>
    </div>
  );
}

export function App() {
  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/articles" element={<ArticlesPage />} />
            <Route path="/articles/:id" element={<ArticlesPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/stocks" element={<StocksPage />} />
            <Route path="/stocks/movements" element={<StockMovementsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/new" element={<OrderCreatePage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
            <Route path="/warehouse" element={<WarehousePage />} />
            <Route path="/deliveries" element={<DeliveriesPage />} />
            <Route path="/deliveries/:id" element={<DeliveryDetailPage />} />
            <Route path="/delivery-persons" element={<DeliveryPersonsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/statistics" element={<StatisticsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
      <Toaster />
    </>
  );
}
