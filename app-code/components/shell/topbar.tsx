'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Cloud, CloudOff, RefreshCcw, CheckCircle2, AlertTriangle, User as UserIcon, LogOut, Moon, Sun, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { logoutAction } from './shell-actions';
import { useSidebar } from './sidebar-context';

type Warehouse = { id: string; code: string; name: string };

export function Topbar({
  user,
  warehouses
}: {
  user: { id: string; fullName: string; username: string; role: string };
  warehouses: Warehouse[];
}) {
  const router = useRouter();
  const { collapsed: sidebarCollapsed, toggle: toggleSidebar } = useSidebar();
  const [currentWh, setCurrentWh] = useState<string>('');
  const [sync, setSync] = useState<'online' | 'offline'>('online');
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('current_warehouse');
    if (stored && warehouses.some((w) => w.id === stored)) setCurrentWh(stored);
    else if (warehouses[0]) setCurrentWh(warehouses[0].id);

    const isDark = localStorage.getItem('theme') === 'dark';
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);

    const updateOnline = () => setSync(navigator.onLine ? 'online' : 'offline');
    updateOnline();
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);

    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
      window.removeEventListener('keydown', onKey);
    };
  }, [warehouses, toggleSidebar]);

  const onChangeWh = (id: string) => {
    setCurrentWh(id);
    localStorage.setItem('current_warehouse', id);
    router.refresh();
  };

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  return (
    <header
      className="h-14 border-b bg-card flex items-center px-4 md:px-6 gap-4"
      role="banner"
    >
      <button
        type="button"
        onClick={toggleSidebar}
        className="hidden md:inline-flex items-center justify-center w-9 h-9 rounded-md hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring -ml-2"
        aria-label={sidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
        aria-expanded={!sidebarCollapsed}
        aria-controls="app-sidebar"
        title={sidebarCollapsed ? 'Mở rộng menu (Ctrl+B)' : 'Thu gọn menu (Ctrl+B)'}
      >
        {sidebarCollapsed ? (
          <PanelLeftOpen className="w-4 h-4" strokeWidth={1.75} />
        ) : (
          <PanelLeftClose className="w-4 h-4" strokeWidth={1.75} />
        )}
      </button>

      {warehouses.length > 0 && (
        <Select value={currentWh} onValueChange={onChangeWh}>
          <SelectTrigger className="w-auto min-w-[180px] h-8">
            <SelectValue placeholder="Chọn kho" />
          </SelectTrigger>
          <SelectContent>
            {user.role === 'ADMIN' && <SelectItem value="ALL">Tất cả các kho</SelectItem>}
            {warehouses.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="ml-auto flex items-center gap-3">
        <div
          className={
            sync === 'online'
              ? 'badge badge-success'
              : 'badge badge-warning'
          }
          role="status"
          aria-live="polite"
        >
          {sync === 'online' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <CloudOff className="w-3.5 h-3.5" />}
          <span>{sync === 'online' ? 'Đã đồng bộ' : 'Đang offline'}</span>
        </div>

        <button
          onClick={toggleDark}
          className="p-2 rounded-md hover:bg-muted"
          aria-label={dark ? 'Chuyển sang nền sáng' : 'Chuyển sang nền tối'}
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="w-8 h-8 rounded-full bg-primary text-primary-foreground grid place-items-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring">
            {user.fullName.charAt(0).toUpperCase()}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <div className="font-semibold">{user.fullName}</div>
              <div className="text-xs text-muted-foreground font-normal">@{user.username} · {user.role === 'ADMIN' ? 'Quản trị' : 'Thủ kho'}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/ca-nhan"><UserIcon className="w-4 h-4" />Hồ sơ cá nhân</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => logoutAction()}>
              <LogOut className="w-4 h-4" />Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
