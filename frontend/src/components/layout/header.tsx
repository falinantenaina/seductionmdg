import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, PanelLeft, PanelLeftClose, UserCog } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useUiStore } from '@/stores/ui.store';
import { ROLE_LABELS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NotificationsBell } from '@/components/shared/notifications-bell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { visibleNavItems } from '@/components/layout/nav';
import logoSidebar from '@/assets/logo-sidebar.jpg';

function Breadcrumbs() {
  const { pathname } = useLocation();
  const user = useAuthStore((state) => state.user);
  const items = visibleNavItems(user?.role);

  const current =
    [...items].sort((a, b) => b.path.length - a.path.length).find(
      (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
    ) ?? null;

  const parts = pathname.split('/').filter(Boolean);

  return (
    <nav aria-label="Fil d'Ariane" className="hidden items-center gap-1.5 text-sm text-muted-foreground md:flex">
      <Link to="/dashboard" className="hover:text-foreground">
        Accueil
      </Link>
      {parts.map((part, index) => {
        const isLast = index === parts.length - 1;
        return (
          <span key={`${part}-${index}`} className="flex items-center gap-1.5">
            <span>/</span>
            <span className={isLast ? 'font-medium text-foreground' : 'hover:text-foreground'}>
              {isLast && current ? current.label : decodeURIComponent(part)}
            </span>
          </span>
        );
      })}
    </nav>
  );
}

export function Header() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const setMobileNavOpen = useUiStore((state) => state.setMobileNavOpen);
  const sidebarHidden = useUiStore((state) => state.sidebarHidden);
  const toggleSidebarHidden = useUiStore((state) => state.toggleSidebarHidden);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 lg:hidden"
        onClick={() => setMobileNavOpen(true)}
        aria-label="Ouvrir le menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex items-center gap-2 lg:hidden">
        <img
          src={logoSidebar}
          alt="Séduction MdG"
          width={753}
          height={639}
          className="h-10 w-auto shrink-0 rounded-md"
        />
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="hidden h-9 w-9 lg:flex"
        onClick={toggleSidebarHidden}
        aria-label={sidebarHidden ? 'Afficher le menu' : 'Masquer le menu'}
        title={sidebarHidden ? 'Afficher le menu' : 'Masquer le menu'}
      >
        {sidebarHidden ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
      </Button>

      <Breadcrumbs />

      <div className="ml-auto flex items-center gap-2">
        <NotificationsBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[11px] font-semibold uppercase">
                {user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}` : '?'}
              </span>
              <span className="hidden max-w-[140px] truncate text-sm font-medium sm:inline">
                {user ? `${user.firstName} ${user.lastName}` : ''}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="truncate text-sm font-medium">{user?.email}</p>
              <div className="mt-1">
                <Badge variant="secondary">{user ? ROLE_LABELS[user.role] : ''}</Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <UserCog className="h-4 w-4" />
              Mon profil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              onClick={() => void handleLogout()}
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
