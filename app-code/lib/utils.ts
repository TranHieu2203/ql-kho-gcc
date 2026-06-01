import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
}

export function formatNumber(n: number | bigint): string {
  return new Intl.NumberFormat('vi-VN').format(n);
}

export function generateReceiptCode(type: 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUSTMENT', seq: number, year = new Date().getFullYear()): string {
  const prefix = { INBOUND: 'IN', OUTBOUND: 'OUT', TRANSFER: 'TR', ADJUSTMENT: 'ADJ' }[type];
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
}
