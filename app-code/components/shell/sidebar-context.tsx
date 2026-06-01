'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type SidebarCtx = {
  collapsed: boolean;
  toggle: () => void;
};

const Ctx = createContext<SidebarCtx>({ collapsed: false, toggle: () => {} });

const STORAGE_KEY = 'sidebar_collapsed';

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === '1') setCollapsed(true);
    setHydrated(true);
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {}
      return next;
    });
  };

  // Avoid flash on hydration: render hidden until we've read localStorage
  return (
    <Ctx.Provider value={{ collapsed, toggle }}>
      <div data-sidebar-hydrated={hydrated ? 'true' : 'false'} className="contents">
        {children}
      </div>
    </Ctx.Provider>
  );
}

export function useSidebar() {
  return useContext(Ctx);
}
