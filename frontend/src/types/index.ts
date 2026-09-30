export type Role = 'ADMIN' | 'COMMERCIAL' | 'FACTURIER' | 'MAGASINIER' | 'DISPATCHER' | 'LIVREUR';

export type OrderStatus =
  | 'BROUILLON'
  | 'COMMANDE'
  | 'EN_FACTURATION'
  | 'FACTUREE'
  | 'A_PREPARER'
  | 'SORTIE_MAGASIN'
  | 'EN_LIVRAISON'
  | 'LIVREE'
  | 'ANNULEE';

export type InvoiceStatus = 'BROUILLON' | 'EMISE' | 'PAYEE' | 'ANNULEE';
export type DeliveryStatus = 'A_LIVRER' | 'AFFECTEE' | 'EN_COURS' | 'LIVREE' | 'ECHEC' | 'ANNULEE';
export type StockMovementType =
  | 'ENTREE'
  | 'SORTIE'
  | 'AJUSTEMENT'
  | 'RESERVATION'
  | 'ANNULATION_RESERVATION'
  | 'RETOUR';
export type Unit = 'PIECE' | 'KG' | 'LITRE' | 'METRE' | 'CARTON' | 'BOITE' | 'PALET';
export type NotificationType =
  | 'NOUVELLE_COMMANDE'
  | 'FACTURE_VALIDE'
  | 'SORTIE_MAGASIN'
  | 'LIVRAISON_AFFECTEE'
  | 'STATUT_COMMANDE'
  | 'STOCK_FAIBLE'
  | 'SYSTEME';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { articles: number; children: number };
}

export interface Article {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  category?: { id: string; name: string; slug: string } | null;
  unit: Unit;
  price: string;
  stockPhysical: number;
  stockReserved: number;
  stockAvailable?: number;
  alertThreshold: number;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lowStock?: boolean;
}

export interface StockMovement {
  id: string;
  type: StockMovementType;
  articleId: string;
  orderId: string | null;
  quantity: number;
  previousPhysical: number;
  newPhysical: number;
  previousReserved: number;
  newReserved: number;
  userId: string;
  comment: string | null;
  createdAt: string;
  article: { id: string; sku: string; name: string; unit: Unit };
  user: { id: string; firstName: string; lastName: string; role: Role };
  order: { id: string; orderNumber: string } | null;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  orderId: string | null;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  deliveryPlace: string | null;
  city: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { orders: number; invoices?: number };
}

export interface OrderItem {
  id: string;
  orderId: string;
  articleId: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  article?: Article;
}

export interface OrderBase {
  id: string;
  orderNumber: string;
  customerId: string;
  commercialId: string;
  status: OrderStatus;
  subtotal: string;
  total: string;
  deliveryAddress: string | null;
  deliveryPlace: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  comments: string | null;
  reservedAt: string | null;
  releasedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Réponse de GET /api/orders (liste) */
export interface OrderListItem extends OrderBase {
  customer: Pick<Customer, 'id' | 'name' | 'phone' | 'city'> | null;
  commercial: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
  items: Array<{ quantity: number }>;
  invoice: { id: string; invoiceNumber: string; status: InvoiceStatus } | null;
  delivery: { id: string; deliveryNumber: string; status: DeliveryStatus } | null;
}

/** Réponse de GET /api/orders/:id */
export interface OrderDetail extends OrderBase {
  customer: Pick<Customer, 'id' | 'name' | 'phone' | 'address' | 'deliveryPlace' | 'city'> | null;
  commercial: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'> | null;
  items: OrderItem[];
  invoice: { id: string; invoiceNumber: string; status: InvoiceStatus; issueDate: string } | null;
  delivery: {
    id: string;
    deliveryNumber: string;
    status: DeliveryStatus;
    scheduledAt: string | null;
    deliveredAt: string | null;
    deliveryPerson: { name: string; phone: string | null } | null;
  } | null;
}

/** Mouvement de stock tel que renvoyé par GET /api/orders/:id */
export interface OrderMovement {
  id: string;
  type: StockMovementType;
  articleId: string;
  orderId: string | null;
  quantity: number;
  previousPhysical: number;
  newPhysical: number;
  previousReserved: number;
  newReserved: number;
  userId: string;
  comment: string | null;
  createdAt: string;
  article: { id: string; sku: string; name: string; unit?: Unit } | null;
  user: { id: string; firstName: string; lastName: string; role?: Role } | null;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  articleId: string | null;
  designation: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}

export interface InvoiceBase {
  id: string;
  invoiceNumber: string;
  orderId: string;
  customerId: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string | null;
  subtotal: string;
  total: string;
  notes: string | null;
  paidAt: string | null;
  cancelReason: string | null;
  authorId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Réponse de GET /api/invoices (liste) */
export interface InvoiceListItem extends InvoiceBase {
  customer: Pick<Customer, 'id' | 'name' | 'phone' | 'city'>;
  order: { id: string; orderNumber: string; status: OrderStatus };
  items: Array<{ quantity: number }>;
}

/** Réponse de GET /api/invoices/:id */
export interface InvoiceDetail extends InvoiceBase {
  customer: Pick<
    Customer,
    'id' | 'name' | 'contactName' | 'phone' | 'address' | 'city' | 'deliveryPlace' | 'email'
  >;
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    createdAt: string;
    deliveryAddress: string | null;
    deliveryPlace: string | null;
    recipientName: string | null;
    recipientPhone: string | null;
    commercial: Pick<User, 'id' | 'firstName' | 'lastName'>;
  };
  items: InvoiceItem[];
  author: Pick<User, 'id' | 'firstName' | 'lastName' | 'role'> | null;
}

/** Réponse de GET /api/delivery-persons */
export interface DeliveryPerson {
  id: string;
  userId: string | null;
  name: string;
  phone: string;
  vehicle: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user?: Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'isActive'> | null;
  _count?: { deliveries: number };
}

export interface DeliveryItem {
  id: string;
  deliveryId: string;
  articleId: string | null;
  designation: string;
  quantity: number;
  quantityDelivered: number | null;
  article?: Pick<Article, 'id' | 'sku' | 'name' | 'unit'> | null;
}

export interface DeliveryBase {
  id: string;
  deliveryNumber: string;
  orderId: string;
  deliveryPersonId: string | null;
  status: DeliveryStatus;
  scheduledAt: string | null;
  deliveredAt: string | null;
  instructions: string | null;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Réponse de GET /api/deliveries (liste) */
export interface DeliveryListItem extends DeliveryBase {
  deliveryPerson: Pick<DeliveryPerson, 'id' | 'name' | 'phone' | 'vehicle' | 'userId'> | null;
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    releasedAt: string | null;
    deliveryAddress: string | null;
    deliveryPlace: string | null;
    total: string;
    customer: Pick<Customer, 'id' | 'name' | 'phone' | 'city'>;
    items: Array<{ quantity: number }>;
    invoice: { invoiceNumber: string; status: InvoiceStatus } | null;
  };
  items: Array<{ quantity: number; quantityDelivered: number | null }>;
}

/** Réponse de GET /api/deliveries/:id */
export interface DeliveryDetail extends DeliveryBase {
  deliveryPerson: Pick<DeliveryPerson, 'id' | 'name' | 'phone' | 'vehicle' | 'userId' | 'isActive'> | null;
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    releasedAt: string | null;
    deliveryAddress: string | null;
    deliveryPlace: string | null;
    recipientName: string | null;
    recipientPhone: string | null;
    total: string;
    customer: Pick<Customer, 'id' | 'name' | 'contactName' | 'phone' | 'address' | 'city' | 'deliveryPlace'>;
    commercial: Pick<User, 'id' | 'firstName' | 'lastName' | 'phone'>;
    items: OrderItem[];
    invoice: { id: string; invoiceNumber: string; status: InvoiceStatus; paidAt: string | null } | null;
  };
  items: DeliveryItem[];
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: PageMeta;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  code: string;
  details?: Array<{ path: string; message: string }>;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface NotificationEntry extends Notification {
  order?: { id: string; orderNumber: string } | null;
}

export interface DashboardStats {
  generatedAt: string;
  range: { days: number; from: string; to: string };
  scope: Role;
  orders: {
    total: number;
    month: number;
    today: number;
    pending: number;
    byStatus: Record<string, number>;
  };
  revenue: { total: number; month: number; today: number };
  stock: { articles: number; lowStock: number; value: number };
  deliveries: { open: number; deliveredMonth: number; failed: number };
  people: { customers: number; users: number };
  series: Array<{ date: string; orders: number; revenue: number }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: OrderStatus;
    total: string;
    createdAt: string;
    customer: { name: string };
  }>;
  lowStock: Array<{
    id: string;
    sku: string;
    name: string;
    stockPhysical: number;
    alertThreshold: number;
  }>;
}

export interface ReportStats {
  range: { from: string; to: string; days: number };
  kpis: {
    revenue: number;
    orders: number;
    avgBasket: number;
    delivered: number;
    exits: number;
    failedDeliveries: number;
    orderedQuantity: number;
  };
  series: Array<{ date: string; orders: number; revenue: number }>;
  topArticles: Array<{ sku: string; name: string; quantity: number; revenue: number }>;
  byCategory: Array<{ name: string; quantity: number; revenue: number }>;
  ordersByStatus: Array<{ status: OrderStatus; count: number }>;
  deliveriesByStatus: Array<{ status: DeliveryStatus; count: number }>;
  movementsByType: Array<{ type: StockMovementType; count: number }>;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  oldValue: unknown;
  newValue: unknown;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string; role: Role } | null;
}

export interface AuditFacets {
  actions: Array<{ value: string; count: number }>;
  entities: Array<{ value: string; count: number }>;
}
