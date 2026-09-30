import { NavLink } from 'react-router-dom';
import { ChevronsLeft, X } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useUiStore } from '@/stores/ui.store';
import { visibleNavItems } from '@/components/layout/nav';
import { ROLE_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import logoSidebar from '@/assets/logo-sidebar.jpg';
import logoPlume from '@/assets/logo-plume.jpg';

interface SidebarProps {
  mobile?: boolean;
}

export function Sidebar({ mobile = false }: SidebarProps) {
  const user = useAuthStore((state) => state.user);
  const { sidebarCollapsed, toggleSidebar, setMobileNavOpen } = useUiStore();
  const items = visibleNavItems(user?.role);

  const content = (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'relative border-b',
          sidebarCollapsed && !mobile ? 'flex items-center justify-center px-3 py-3' : 'px-3 py-3',
        )}
      >
        {sidebarCollapsed && !mobile ? (
          <img
            src={logoPlume}
            alt="Séduction MdG"
            width={285}
            height={627}
            className="mx-auto h-auto w-10"
          />
        ) : (
          <img
            src={logoSidebar}
            alt="Séduction MdG — Votre destination Fashion"
            width={753}
            height={639}
            className="mx-auto h-24 w-auto max-w-full rounded-lg"
          />
        )}
        {mobile && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 h-8 w-8"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Fermer le menu"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => mobile && setMobileNavOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                sidebarCollapsed && !mobile && 'justify-center px-2',
              )
            }
            title={sidebarCollapsed && !mobile ? item.label : undefined}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {(!sidebarCollapsed || mobile) && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <Separator />
      <div className={cn('flex items-center gap-3 p-3', sidebarCollapsed && !mobile && 'justify-center')}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold uppercase">
          {user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}` : '?'}
        </div>
        {(!sidebarCollapsed || mobile) && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">
              {user ? `${user.firstName} ${user.lastName}` : '—'}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {user ? ROLE_LABELS[user.role] : ''}
            </p>
          </div>
        )}
        {!mobile && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'Déplier le menu' : 'Replier le menu'}
          >
            <ChevronsLeft className={cn('h-4 w-4 transition-transform', sidebarCollapsed && 'rotate-180')} />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 border-r bg-card transition-[width] duration-200 lg:block',
          sidebarCollapsed ? 'w-[68px]' : 'w-64',
        )}
      >
        {content}
      </aside>

      {/* Mobile */}
      {mobile && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r bg-card lg:hidden">{content}</aside>
        </>
      )}
    </>
  );
}
