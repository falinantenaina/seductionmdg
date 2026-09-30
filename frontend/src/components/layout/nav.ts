import {
  BarChart3,
  Boxes,
  FileText,
  History,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Tags,
  Truck,
  Users,
  Warehouse,
  UserRound,
  Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Role } from '@/types';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  roles: Role[];
  /** Sous-chemin actif aussi pour les pages de détail */
  matchPrefix?: boolean;
}

export const ALL_ROLES: Role[] = ['ADMIN', 'COMMERCIAL', 'FACTURIER', 'MAGASINIER', 'DISPATCHER', 'LIVREUR'];

export const NAV_ITEMS: NavItem[] = [
  { label: 'Tableau de bord', path: '/dashboard', icon: LayoutDashboard, roles: ALL_ROLES },
  { label: 'Catalogue', path: '/articles', icon: Package, roles: ['ADMIN', 'COMMERCIAL', 'FACTURIER', 'MAGASINIER', 'DISPATCHER'] },
  { label: 'Catégories', path: '/categories', icon: Tags, roles: ['ADMIN', 'MAGASINIER'] },
  { label: 'Stocks', path: '/stocks', icon: Boxes, roles: ['ADMIN', 'COMMERCIAL', 'FACTURIER', 'MAGASINIER', 'DISPATCHER'] },
  { label: 'Mouvements', path: '/stocks/movements', icon: History, roles: ['ADMIN', 'MAGASINIER'] },
  { label: 'Commandes', path: '/orders', icon: ShoppingCart, roles: ['ADMIN', 'COMMERCIAL', 'FACTURIER', 'MAGASINIER', 'DISPATCHER'] },
  { label: 'Factures', path: '/invoices', icon: FileText, roles: ['ADMIN', 'FACTURIER', 'COMMERCIAL'] },
  { label: 'Magasin', path: '/warehouse', icon: Warehouse, roles: ['ADMIN', 'MAGASINIER'] },
  { label: 'Livraisons', path: '/deliveries', icon: Truck, roles: ['ADMIN', 'DISPATCHER', 'LIVREUR'] },
  { label: 'Livreurs', path: '/delivery-persons', icon: UserRound, roles: ['ADMIN', 'DISPATCHER'] },
  { label: 'Clients', path: '/customers', icon: UserRound, roles: ['ADMIN', 'COMMERCIAL', 'FACTURIER'] },
  { label: 'Utilisateurs', path: '/users', icon: Users, roles: ['ADMIN'] },
  { label: 'Statistiques', path: '/statistics', icon: BarChart3, roles: ['ADMIN'] },
  { label: 'Paramètres', path: '/settings', icon: Settings, roles: ALL_ROLES },
];

export function visibleNavItems(role: Role | undefined): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function hasAccess(pathname: string, role: Role | undefined): boolean {
  if (!role) return false;
  // Le chemin le plus long gagne : /stocks/movements prime sur /stocks
  const item = [...NAV_ITEMS]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));
  if (!item) return true;
  return item.roles.includes(role);
}
