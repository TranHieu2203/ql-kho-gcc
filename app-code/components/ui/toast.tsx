'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle, XCircle, Info, X } from 'lucide-react';

type ToastVariant = 'success' | 'warning' | 'danger' | 'info';
type ToastItem = { id: number; variant: ToastVariant; message: string };

const ToastCtx = React.createContext<{
  push: (t: Omit<ToastItem, 'id'>) => void;
}>({ push: () => {} });

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const push = React.useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = nextId++;
    setItems((prev) => [...prev, { ...t, id }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2"
        role="status"
        aria-live="polite"
        aria-atomic="false"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-2 rounded-lg border bg-card p-3 shadow-md',
              t.variant === 'success' && 'border-success-soft',
              t.variant === 'danger' && 'border-danger-soft',
              t.variant === 'warning' && 'border-warning-soft'
            )}
            role={t.variant === 'danger' ? 'alert' : 'status'}
          >
            <div className="mt-0.5">
              {t.variant === 'success' && <CheckCircle2 className="h-5 w-5 text-success" />}
              {t.variant === 'warning' && <AlertCircle className="h-5 w-5 text-warning" />}
              {t.variant === 'danger' && <XCircle className="h-5 w-5 text-danger" />}
              {t.variant === 'info' && <Info className="h-5 w-5 text-info" />}
            </div>
            <div className="flex-1 text-sm">{t.message}</div>
            <button
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
              className="opacity-60 hover:opacity-100"
              aria-label="Đóng thông báo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return React.useContext(ToastCtx);
}
