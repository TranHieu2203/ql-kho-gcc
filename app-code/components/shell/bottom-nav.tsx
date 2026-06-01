'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, ArrowDownToLine, Plus, ArrowUpFromLine, ListChecks, Menu, Package, BarChart3, Repeat, Settings, X, User } from 'lucide-react';
import { useState } from 'react';
import { logoutAction } from './shell-actions';

type Item = { href?: string; label: string; icon: React.ComponentType<any>; action?: 'menu' };

const NAV_ITEMS: Item[] = [
  { href: '/tong-quan', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/nhap-kho', label: 'Nhập', icon: ArrowDownToLine },
  { href: '/xuat-kho', label: 'Xuất', icon: ArrowUpFromLine },
  { href: '/ton-kho', label: 'Tồn', icon: ListChecks },
  { label: 'Thêm', icon: Menu, action: 'menu' }
];

const MORE_ITEMS = [
  { href: '/chuyen-kho', label: 'Phiếu Chuyển', icon: Repeat },
  { href: '/danh-muc', label: 'Danh mục SP', icon: Package },
  { href: '/bao-cao/nxt', label: 'Báo cáo NXT', icon: BarChart3 },
  { href: '/ca-nhan', label: 'Hồ sơ cá nhân', icon: User }
];

export function BottomNav({ role }: { role: string }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t flex items-stretch z-40"
        role="navigation"
        aria-label="Điều hướng chính (mobile)"
      >
        {NAV_ITEMS.map((it) => {
          const Icon = it.icon;
          const active = it.href ? pathname === it.href || pathname.startsWith(it.href + '/') : false;
          const cls = cn(
            'flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors',
            active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          );
          if (it.action === 'menu') {
            return (
              <button key="menu" type="button" className={cls} onClick={() => setMenuOpen(true)} aria-label="Mở menu thêm">
                <Icon className="w-5 h-5" strokeWidth={1.75} />
                <span>{it.label}</span>
              </button>
            );
          }
          return (
            <Link key={it.href} href={it.href!} className={cls}>
              <Icon className="w-5 h-5" strokeWidth={1.75} />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </nav>

      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/45 flex items-end"
          onClick={() => setMenuOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Menu thêm"
        >
          <div
            className="bg-card w-full rounded-t-xl pb-8 pt-2 animate-in slide-in-from-bottom-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b">
              <div className="font-semibold">Menu</div>
              <button onClick={() => setMenuOpen(false)} aria-label="Đóng" className="p-2 -mr-2">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="py-2">
              {MORE_ITEMS.map((it) => {
                const Icon = it.icon;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted active:bg-muted"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon className="w-5 h-5 text-muted-foreground" />
                    <span>{it.label}</span>
                  </Link>
                );
              })}
              {role === 'ADMIN' && (
                <Link
                  href="/quan-tri"
                  className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted active:bg-muted"
                  onClick={() => setMenuOpen(false)}
                >
                  <Settings className="w-5 h-5 text-muted-foreground" />
                  <span>Quản trị</span>
                </Link>
              )}
              <button
                onClick={() => logoutAction()}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted active:bg-muted text-danger-strong"
              >
                <X className="w-5 h-5" />
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
