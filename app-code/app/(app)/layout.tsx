import { redirect } from 'next/navigation';
import { validateRequest, getUserWarehouses } from '@/lib/auth/lucia';
import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';
import { BottomNav } from '@/components/shell/bottom-nav';
import { SidebarProvider } from '@/components/shell/sidebar-context';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await validateRequest();
  if (!user) redirect('/login');

  const warehouses = await getUserWarehouses(user.id);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex bg-background">
        <Sidebar role={user.role} />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar
            user={{ id: user.id, username: user.username, fullName: user.fullName, role: user.role }}
            warehouses={warehouses}
          />
          <main className="flex-1 overflow-auto pb-20 md:pb-0" role="main">
            {children}
          </main>
        </div>
        <BottomNav role={user.role} />
      </div>
    </SidebarProvider>
  );
}
