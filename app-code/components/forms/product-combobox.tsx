'use client';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ProductOption = {
  id: string;
  sku: string;
  fullName: string;
  brand: string;
  size: string;
  pattern: string;
  defaultUnit?: 'BO' | 'CHIEC' | string;
};

type Props = {
  products: ProductOption[];
  value: string;                              // product id đang chọn (rỗng = chưa chọn)
  onChange: (id: string, product?: ProductOption) => void;
  placeholder?: string;
  inputId?: string;
  required?: boolean;
  ariaLabel?: string;
  className?: string;
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // bỏ dấu tiếng Việt cho search
    .trim();
}

function rankMatch(p: ProductOption, q: string): number {
  if (!q) return 0;
  const sku = normalize(p.sku);
  const name = normalize(p.fullName);
  const brand = normalize(p.brand);
  const pattern = normalize(p.pattern);
  const size = normalize(p.size);
  // Higher score = better match
  if (sku.startsWith(q)) return 100;
  if (sku.includes(q)) return 80;
  if (pattern.startsWith(q)) return 60;
  if (brand.startsWith(q)) return 50;
  if (size.includes(q)) return 40;
  if (name.includes(q)) return 30;
  if (pattern.includes(q)) return 20;
  return 0;
}

export function ProductCombobox({
  products,
  value,
  onChange,
  placeholder = 'Gõ SKU, thương hiệu, size... để tìm',
  inputId,
  required,
  ariaLabel = 'Chọn sản phẩm',
  className
}: Props) {
  const uid = useId();
  const listId = `${uid}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focusIdx, setFocusIdx] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const selected = useMemo(() => products.find((p) => p.id === value), [products, value]);

  const results = useMemo(() => {
    const q = normalize(query);
    if (!q) return products.slice(0, 30);
    return products
      .map((p) => ({ p, score: rankMatch(p, q) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.p.sku.localeCompare(b.p.sku))
      .slice(0, 30)
      .map((r) => r.p);
  }, [products, query]);

  // Reset focus index khi results thay đổi
  useEffect(() => { setFocusIdx(0); }, [query, open]);

  // Click outside → close (check both wrap và listRef vì dropdown ở portal)
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (listRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Position popover qua getBoundingClientRect (escape khỏi overflow cha)
  useLayoutEffect(() => {
    if (!open) return;
    function reposition() {
      const trigger = wrapRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const spaceBelow = viewportH - rect.bottom;
      const spaceAbove = rect.top;
      const desired = 288; // ~max-h-72 (18rem)
      // Mở xuống dưới nếu đủ chỗ; nếu không, mở lên trên
      const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
      setPopoverStyle({
        position: 'fixed',
        left: rect.left,
        top: openUp ? undefined : rect.bottom + 4,
        bottom: openUp ? viewportH - rect.top + 4 : undefined,
        width: rect.width,
        maxHeight: Math.min(desired, openUp ? spaceAbove - 8 : spaceBelow - 8),
        zIndex: 9999
      });
    }
    reposition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  // Auto-scroll focused item vào view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${focusIdx}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [focusIdx, open]);

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setFocusIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const p = results[focusIdx];
      if (p) pick(p);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setQuery('');
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  }

  function pick(p: ProductOption) {
    onChange(p.id, p);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  }

  function clear() {
    onChange('', undefined);
    setQuery('');
    inputRef.current?.focus();
    setOpen(true);
  }

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      {/* Trigger: hiển thị selected hoặc input search */}
      {selected && !open ? (
        <button
          type="button"
          id={inputId}
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
          className="h-9 w-full flex items-center justify-between rounded-md border border-input bg-background px-3 text-sm hover:bg-muted/40 transition-colors text-left"
          aria-haspopup="listbox"
          aria-expanded="false"
          aria-label={ariaLabel}
        >
          <span className="flex items-center gap-2 min-w-0 flex-1">
            <span className="font-mono font-semibold text-primary truncate">{selected.sku}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline truncate">
              {selected.brand} · {selected.size}
            </span>
          </span>
          <ChevronsUpDown className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-2" />
        </button>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            aria-controls={listId}
            aria-expanded={open}
            aria-autocomplete="list"
            aria-label={ariaLabel}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKey}
            placeholder={placeholder}
            required={required && !value}
            autoComplete="off"
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-9 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {value && (
            <button
              type="button"
              onClick={clear}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 grid place-items-center rounded hover:bg-muted text-muted-foreground"
              aria-label="Xoá lựa chọn"
              tabIndex={-1}
            >
              ✕
            </button>
          )}
        </div>
      )}

      {open && mounted && createPortal(
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          style={popoverStyle}
          className="overflow-y-auto rounded-md border bg-card shadow-lg"
        >
          {results.length === 0 ? (
            <div className="px-3 py-6 text-sm text-center text-muted-foreground">
              Không tìm thấy sản phẩm phù hợp.<br />
              <span className="text-xs">Gõ SKU / thương hiệu / size / mã gai...</span>
            </div>
          ) : (
            <>
              {!query && (
                <div className="px-3 py-1.5 text-[11px] text-muted-foreground bg-muted/40 border-b">
                  Hiển thị {results.length} sản phẩm đầu — gõ để lọc
                </div>
              )}
              {results.map((p, i) => {
                const active = i === focusIdx;
                const chosen = p.id === value;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={chosen}
                    data-idx={i}
                    onMouseEnter={() => setFocusIdx(i)}
                    onClick={() => pick(p)}
                    className={cn(
                      'w-full text-left px-3 py-2 flex items-start gap-2 text-sm border-b last:border-b-0 transition-colors',
                      active ? 'bg-primary-soft' : 'hover:bg-muted/60'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-mono font-semibold text-primary truncate">{p.sku}</div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        <span className="font-medium">{p.brand}</span>
                        <span> · </span>{p.size}
                        <span> · </span>{p.pattern}
                      </div>
                    </div>
                    {chosen && <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </>
          )}
          {results.length === 30 && query && (
            <div className="px-3 py-1.5 text-[11px] text-muted-foreground bg-muted/40 border-t text-center">
              Còn nhiều kết quả — thu hẹp tìm kiếm để xem tiếp.
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
