export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  categories: {
    list: (params: unknown) => ['categories', 'list', params] as const,
    tree: ['categories', 'tree'] as const,
  },
  articles: {
    list: (params: unknown) => ['articles', 'list', params] as const,
    detail: (id: string) => ['articles', 'detail', id] as const,
  },
  stocks: {
    list: (params: unknown) => ['stocks', 'list', params] as const,
    movements: (params: unknown) => ['stocks', 'movements', params] as const,
  },
  users: {
    list: (params: unknown) => ['users', 'list', params] as const,
  },
  customers: {
    list: (params: unknown) => ['customers', 'list', params] as const,
  },
  orders: {
    list: (params: unknown) => ['orders', 'list', params] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
    movements: (id: string) => ['orders', 'movements', id] as const,
  },
  invoices: {
    list: (params: unknown) => ['invoices', 'list', params] as const,
    detail: (id: string) => ['invoices', 'detail', id] as const,
  },
  warehouse: {
    exits: (params: unknown) => ['warehouse', 'exits', params] as const,
  },
  deliveries: {
    list: (params: unknown) => ['deliveries', 'list', params] as const,
    detail: (id: string) => ['deliveries', 'detail', id] as const,
  },
  deliveryPeople: {
    list: (params: unknown) => ['delivery-people', 'list', params] as const,
  },
  dashboard: {
    stats: (params: unknown) => ['dashboard', 'stats', params] as const,
  },
  notifications: {
    list: (params: unknown) => ['notifications', 'list', params] as const,
    count: ['notifications', 'count'] as const,
  },
  stats: {
    report: (params: unknown) => ['stats', 'report', params] as const,
  },
  audit: {
    list: (params: unknown) => ['audit', 'list', params] as const,
    facets: ['audit', 'facets'] as const,
  },
} as const;
