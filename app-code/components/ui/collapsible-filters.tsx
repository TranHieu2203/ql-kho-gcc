'use client';
import { useId, useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Bọc form lọc: trên mobile thu gọn thành 1 nút "Bộ lọc (n)" bấm để ẩn/hiện,
 * trên desktop (md+) luôn hiện và wrapper dùng `display: contents` nên không ảnh hưởng layout cũ.
 */
export function CollapsibleFilters({ activeCount, children }: { activeCount: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <>
      <button
        type="button"
        className="md:hidden flex w-full flex-shrink-0 items-center justify-between gap-2 px-4 h-11 border-b text-sm font-medium"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4" />
          {open ? 'Ẩn bộ lọc' : 'Bộ lọc'}
          {activeCount > 0 && <span className="badge badge-info">{activeCount} đang bật</span>}
        </span>
        <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
      </button>
      <div id={id} className={cn(open ? 'block' : 'hidden', 'md:contents')}>
        {children}
      </div>
    </>
  );
}
