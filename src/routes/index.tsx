import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from '../layouts/app.layout';
import AdminLayout from '../layouts/admin.layout';
import ClientLayout from '../layouts/client.layout';
import NotFound from '../components/shared/NotFound';
import ProtectedAdminRoute from '../components/shared/ProtectedAdminRoute';
import { ROUTE_PATHS } from './route-names';

// Admin pages
const DashboardPage = lazy(() => import('../features/admin/dashboard/page'));
const AnalyticsPage = lazy(() => import('../features/admin/analytics/page'));
const ProductsPage = lazy(() => import('../features/admin/products/page'));
const ProductCreatePage = lazy(() => import('../features/admin/products-create/page'));
const ProductImportPage = lazy(() => import('../features/admin/products-import/page'));
const ProductDiscountsPage = lazy(() => import('../features/admin/products-discounts/page'));
const ProductInventoryDamagePage = lazy(() => import('../features/admin/products-damage/page'));
const ProductInventoryLowStockPage = lazy(() => import('../features/admin/products-lowstock/page'));
const CategoriesPage = lazy(() => import('../features/admin/categories/page'));
const SubcategoriesPage = lazy(() => import('../features/admin/subcategories/page'));
const OrdersPage = lazy(() => import('../features/admin/orders/page'));
const CustomersPage = lazy(() => import('../features/admin/customers/page'));
const ReportsPage = lazy(() => import('../features/admin/reports/page'));
const InterfacePage = lazy(() => import('../features/admin/interface/page'));
const SecurityPage = lazy(() => import('../features/admin/security/page'));
const PermissionsPage = lazy(() => import('../features/admin/permissions/page'));
const SettingsPage = lazy(() => import('../features/admin/settings/page'));
const OriginsPage = lazy(() => import('../features/admin/origins/page'));
const TagsPage = lazy(() => import('../features/admin/tags/page'));
const NewsPage = lazy(() => import('../features/admin/news/page'));
const ReviewsPage = lazy(() => import('../features/admin/reviews/page'));
const PaymentsPage = lazy(() => import('../features/admin/payments/page'));
const NewsletterPage = lazy(() => import('../features/admin/newsletter/page'));
const NewsCommentsPage = lazy(() => import('../features/admin/news-comments/page'));
const SupportChatsPage = lazy(() => import('../features/admin/support-chats/page'));
const RiceDiagnosisAdminPage = lazy(() => import('../features/admin/rice-diagnosis/page'));
const SuppliersPage = lazy(() => import('../features/admin/suppliers/page'));
const ProcurementPage = lazy(() => import('../features/admin/procurement/page'));
const PricingPage = lazy(() => import('../features/admin/pricing/page'));
const WarehousesPage = lazy(() => import('../features/admin/warehouses/page'));
const InventoryLedgerPage = lazy(() => import('../features/admin/inventory-ledger/page'));
const InventoryValuationPage = lazy(() => import('../features/admin/inventory-valuation/page'));
const ReturnsAdminPage = lazy(() => import('../features/admin/returns/page'));
const InvoicePrintPage = lazy(() => import('../features/admin/invoice/page'));
const ProfitabilityPage = lazy(() => import('../features/admin/profitability/page'));
const AgingDebtPage = lazy(() => import('../features/admin/aging-debt/page'));
const CreditLimitsPage = lazy(() => import('../features/admin/credit-limits/page'));
const AuditLogsPage = lazy(() => import('../features/admin/audit-logs/page'));
const SuperAdminConfigPage = lazy(() => import('../pages/SuperAdminConfig'));

// Client pages
const ClientHomePage = lazy(() => import('../features/client/home/page'));
const ClientProductsPage = lazy(() => import('../features/client/products/page'));
const ClientCategoriesPage = lazy(() => import('../pages/client/Categories'));
const ClientProductDetailPage = lazy(() => import('../features/client/product-detail/page'));
const ClientCartPage = lazy(() => import('../features/client/cart/page'));
const ClientVouchersPage = lazy(() => import('../features/client/vouchers/page'));
const ClientCheckoutPage = lazy(() => import('../features/client/checkout/page'));
const ClientPaymentPage = lazy(() => import('../features/client/payment/page'));
const ClientNewsListPage = lazy(() => import('../features/client/news/page'));
const ClientNewsDetailPage = lazy(() => import('../features/client/news-detail/page'));
const ClientSupportPage = lazy(() => import('../pages/client/SupportLanding'));
const ClientLoginPage = lazy(() => import('../features/client/login/page'));
const ClientForgotPasswordPage = lazy(() => import('../features/client/forgot-password/page'));
const ClientRegisterPage = lazy(() => import('../features/client/register/page'));
const ClientAccountPage = lazy(() => import('../features/client/account/page'));
const ClientOrdersPage = lazy(() => import('../features/client/orders/page'));
const ClientOrderDetailPage = lazy(() => import('../features/client/order-detail/page'));
const ClientWishlistPage = lazy(() => import('../features/client/wishlist/page'));
const ClientAddressesPage = lazy(() => import('../features/client/addresses/page'));
const ClientRiceDiagnosisPage = lazy(() => import('../features/client/rice-diagnosis/page'));

const AgriInventoryPage = lazy(() => import('../pages/AgriInventory'));

const LoginPage = lazy(() => import('../pages/Login'));
const SuperAdminLoginPage = lazy(() => import('../pages/SuperAdminLogin'));

const withSuspense = (element: ReactNode) => (
  <Suspense fallback={<div className="p-6 text-sm text-on-surface-variant">Loading...</div>}>{element}</Suspense>
);

const clientSuspense = (element: ReactNode) => (
  <Suspense fallback={
    <div className="flex min-h-[40vh] items-center justify-center" style={{ background: '#f2f0eb' }}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#006241] border-t-transparent" />
    </div>
  }>
    {element}
  </Suspense>
);

export const router = createBrowserRouter([
  {
    path: ROUTE_PATHS.root,
    element: <AppLayout />,
    errorElement: <NotFound />,
    children: [
      { index: true, element: <Navigate to={ROUTE_PATHS.admin} replace /> },
      {
        element: <ProtectedAdminRoute />,
        children: [
          {
            path: 'admin',
            element: <AdminLayout />,
            children: [
              { index: true, element: withSuspense(<DashboardPage />) },
              { path: 'analytics', element: withSuspense(<AnalyticsPage />) },
              { path: 'products', element: withSuspense(<ProductsPage />) },
              { path: 'products/new', element: withSuspense(<ProductCreatePage />) },
              { path: 'products/create', element: <Navigate to="/admin/products/new" replace /> },
              { path: 'products/import', element: withSuspense(<ProductImportPage />) },
              { path: 'products/inventory-damage', element: withSuspense(<ProductInventoryDamagePage />) },
              { path: 'products/inventory-lowstock', element: withSuspense(<ProductInventoryLowStockPage />) },
              { path: 'discounts', element: withSuspense(<ProductDiscountsPage />) },
              { path: 'categories', element: withSuspense(<CategoriesPage />) },
              { path: 'subcategories', element: withSuspense(<SubcategoriesPage />) },
              { path: 'origins', element: withSuspense(<OriginsPage />) },
              { path: 'tags', element: withSuspense(<TagsPage />) },
              { path: 'orders', element: withSuspense(<OrdersPage />) },
              { path: 'customers', element: withSuspense(<CustomersPage />) },
              { path: 'news', element: withSuspense(<NewsPage />) },
              { path: 'news-comments', element: withSuspense(<NewsCommentsPage />) },
              { path: 'reviews', element: withSuspense(<ReviewsPage />) },
              { path: 'payments', element: withSuspense(<PaymentsPage />) },
              { path: 'newsletter', element: withSuspense(<NewsletterPage />) },
              { path: 'support-chats', element: withSuspense(<SupportChatsPage />) },
              { path: 'rice-diagnosis', element: withSuspense(<RiceDiagnosisAdminPage />) },
              { path: 'reports', element: withSuspense(<ReportsPage />) },
              { path: 'permissions', element: withSuspense(<PermissionsPage />) },
              { path: 'interface', element: withSuspense(<InterfacePage />) },
              { path: 'security', element: withSuspense(<SecurityPage />) },
              { path: 'settings', element: withSuspense(<SettingsPage />) },
              { path: 'suppliers', element: withSuspense(<SuppliersPage />) },
              { path: 'procurement', element: withSuspense(<ProcurementPage />) },
              { path: 'pricing', element: withSuspense(<PricingPage />) },
              { path: 'warehouses', element: withSuspense(<WarehousesPage />) },
              { path: 'inventory-ledger', element: withSuspense(<InventoryLedgerPage />) },
              { path: 'inventory-valuation', element: withSuspense(<InventoryValuationPage />) },
              { path: 'returns', element: withSuspense(<ReturnsAdminPage />) },
              { path: 'invoices/:orderId/print', element: withSuspense(<InvoicePrintPage />) },
              { path: 'profitability', element: withSuspense(<ProfitabilityPage />) },
              { path: 'aging-debt', element: withSuspense(<AgingDebtPage />) },
              { path: 'credit-limits', element: withSuspense(<CreditLimitsPage />) },
              { path: 'audit-logs', element: withSuspense(<AuditLogsPage />) },
              { path: 'agri-inventory', element: withSuspense(<AgriInventoryPage />) },
              { path: 'super-admin', element: withSuspense(<SuperAdminConfigPage />) },
            ],
          },
        ],
      },
      {
        path: 'client',
        element: <ClientLayout />,
        children: [
          { index: true, element: clientSuspense(<ClientHomePage />) },
          { path: 'products', element: clientSuspense(<ClientProductsPage />) },
          { path: 'products/:id', element: clientSuspense(<ClientProductDetailPage />) },
          { path: 'categories', element: clientSuspense(<ClientCategoriesPage />) },
          { path: 'categories/:categoryId', element: clientSuspense(<ClientCategoriesPage />) },
          { path: 'cart', element: clientSuspense(<ClientCartPage />) },
          { path: 'vouchers', element: clientSuspense(<ClientVouchersPage />) },
          { path: 'checkout', element: clientSuspense(<ClientCheckoutPage />) },
          { path: 'payment', element: clientSuspense(<ClientPaymentPage />) },
          { path: 'news', element: clientSuspense(<ClientNewsListPage />) },
          { path: 'news/:slug', element: clientSuspense(<ClientNewsDetailPage />) },
          { path: 'support/:slug', element: clientSuspense(<ClientSupportPage />) },
          { path: 'account', element: clientSuspense(<ClientAccountPage />) },
          { path: 'orders', element: clientSuspense(<ClientOrdersPage />) },
          { path: 'orders/:id', element: clientSuspense(<ClientOrderDetailPage />) },
          { path: 'wishlist', element: clientSuspense(<ClientWishlistPage />) },
          { path: 'account/addresses', element: clientSuspense(<ClientAddressesPage />) },
          { path: 'rice-diagnosis', element: clientSuspense(<ClientRiceDiagnosisPage />) },
        ],
      },
      { path: 'client/login', element: clientSuspense(<ClientLoginPage />) },
      { path: 'client/forgot-password', element: clientSuspense(<ClientForgotPasswordPage />) },
      { path: 'client/register', element: clientSuspense(<ClientRegisterPage />) },
      { path: 'login', element: withSuspense(<LoginPage />) },
      { path: 'super-admin/login', element: withSuspense(<SuperAdminLoginPage />) },
      { path: 'central-super/login', element: <Navigate to="/super-admin/login" replace /> },
      { path: 'central-super/config', element: <Navigate to="/admin/super-admin" replace /> },
    ],
  },
]);
