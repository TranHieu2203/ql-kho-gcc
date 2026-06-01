'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ArrowDownToLine,
  ArrowUpFromLine,
  Repeat,
  Package,
  ListChecks,
  BarChart3,
  Settings
} from 'lucide-react';
import { useSidebar } from './sidebar-context';

type Item = { href: string; label: string; icon: React.ComponentType<any> };
type Group = { label?: string; items: Item[]; adminOnly?: boolean };

const groups: Group[] = [
  { items: [{ href: '/tong-quan', label: 'Tổng quan', icon: LayoutDashboard }] },
  {
    label: 'Hoạt động',
    items: [
      { href: '/nhap-kho', label: 'Phiếu Nhập', icon: ArrowDownToLine },
      { href: '/xuat-kho', label: 'Phiếu Xuất', icon: ArrowUpFromLine },
      { href: '/chuyen-kho', label: 'Phiếu Chuyển', icon: Repeat }
    ]
  },
  {
    label: 'Dữ liệu',
    items: [
      { href: '/ton-kho', label: 'Tồn kho', icon: ListChecks },
      { href: '/danh-muc', label: 'Danh mục SP', icon: Package },
      { href: '/bao-cao/nxt', label: 'Báo cáo NXT', icon: BarChart3 }
    ]
  },
  {
    label: 'Hệ thống',
    adminOnly: true,
    items: [{ href: '/quan-tri', label: 'Quản trị', icon: Settings }]
  }
];

export function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const { collapsed } = useSidebar();

  return (
    <aside
      id="app-sidebar"
      className={cn(
        'hidden md:flex flex-col border-r bg-card transition-[width] duration-200 ease-out',
        collapsed ? 'w-16' : 'w-60'
      )}
      role="navigation"
      aria-label="Điều hướng chính"
      aria-expanded={!collapsed}
    >
      <div
        className={cn(
          'h-14 flex items-center border-b',
          collapsed ? 'justify-center px-2' : 'px-5 gap-2.5'
        )}
      >
        <div className="w-7 h-7 rounded-md bg-primary text-primary-foreground grid place-items-center font-bold text-sm flex-shrink-0">
          QL
        </div>
        {!collapsed && <span className="font-bold text-sm">QL Kho Lốp</span>}
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {groups.map((g, gi) => {
          if (g.adminOnly && role !== 'ADMIN') return null;
          return (
            <div key={gi} className="mb-3">
              {g.label && !collapsed && (
                <div className="px-5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.label}
                </div>
              )}
              {g.label && collapsed && gi > 0 && (
                <div className="mx-3 my-2 border-t" aria-hidden="true" />
              )}
              {g.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center text-sm border-l-[3px] transition-colors',
                      collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-5 py-2.5',
                      active
                        ? 'bg-primary-soft text-primary border-primary font-semibold'
                        : 'border-transparent hover:bg-muted'
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
