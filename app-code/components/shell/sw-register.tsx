'use client';
import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return; // don't register SW in dev to avoid stale cache
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* swallow — SW failure should not break app */
    });
  }, []);
  return null;
}
