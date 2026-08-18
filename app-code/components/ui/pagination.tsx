import Link from 'next/link';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PAGE_SIZES, DEFAULT_PAGE_SIZE, pageWindow } from '@/lib/pagination';

type Props = {
  /** Đường dẫn trang, ví dụ "/danh-muc" */
  basePath: string;
  /** Các query param hiện tại cần giữ lại (bỏ qua page/pageSize — component tự set). */
  params?: Record<string, string | number | undefined | null>;
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  from: number;
  to: number;
  /** Danh từ đếm, ví dụ "sản phẩm", "phiếu", "giao dịch". */
  itemLabel?: string;
};

/**
 * Giữ nguyên mọi filter hiện tại; page/pageSize lấy giá trị đang dùng trừ khi được override.
 * Bỏ qua page=1 và pageSize mặc định để URL gọn.
 */
function href(
  basePath: string,
  params: Props['params'],
  current: { page: number; pageSize: number },
  overrides: { page?: number; pageSize?: number }
) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (k === 'page' || k === 'pageSize') continue;
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const page = overrides.page ?? current.page;
  const pageSize = overrides.pageSize ?? current.pageSize;
  if (pageSize !== DEFAULT_PAGE_SIZE) sp.set('pageSize', String(pageSize));
  if (page > 1) sp.set('page', String(page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

const navBase =
  'inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-md text-xs font-medium border transition-colors';

export function Pagination({
  basePath,
  params,
  page,
  pageCount,
  pageSize,
  total,
  from,
  to,
  itemLabel = 'mục'
}: Props) {
  if (total === 0) return null;

  const link = (overrides: { page?: number; pageSize?: number }) =>
    href(basePath, params, { page, pageSize }, overrides);
  const win = pageWindow(page, pageCount);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t text-sm flex-shrink-0">
      <div className="text-muted-foreground">
        Hiển thị <span className="font-medium text-foreground">{from}–{to}</span> trong{' '}
        <span className="font-medium text-foreground">{total}</span> {itemLabel}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Dòng/trang</span>
          {PAGE_SIZES.map((s) => (
            <Link
              key={s}
              href={link({ pageSize: s, page: 1 })}
              aria-current={s === pageSize ? 'true' : undefined}
              className={cn(navBase, s === pageSize ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted')}
            >
              {s}
            </Link>
          ))}
        </div>

        {pageCount > 1 && (
          <nav className="flex items-center gap-1" aria-label="Phân trang">
            {page > 1 ? (
              <>
                <Link href={link({ page: 1 })} className={cn(navBase, 'hover:bg-muted')} aria-label="Trang đầu">
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </Link>
                <Link href={link({ page: page - 1 })} className={cn(navBase, 'hover:bg-muted')} aria-label="Trang trước">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Link>
              </>
            ) : (
              <>
                <span className={cn(navBase, 'opacity-40')} aria-hidden="true"><ChevronsLeft className="w-3.5 h-3.5" /></span>
                <span className={cn(navBase, 'opacity-40')} aria-hidden="true"><ChevronLeft className="w-3.5 h-3.5" /></span>
              </>
            )}

            {win.map((p, i) =>
              p === 'gap' ? (
                <span key={`gap-${i}`} className="px-1 text-muted-foreground">…</span>
              ) : (
                <Link
                  key={p}
                  href={link({ page: p })}
                  aria-current={p === page ? 'page' : undefined}
                  className={cn(navBase, p === page ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted')}
                >
                  {p}
                </Link>
              )
            )}

            {page < pageCount ? (
              <>
                <Link href={link({ page: page + 1 })} className={cn(navBase, 'hover:bg-muted')} aria-label="Trang sau">
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
                <Link href={link({ page: pageCount })} className={cn(navBase, 'hover:bg-muted')} aria-label="Trang cuối">
                  <ChevronsRight className="w-3.5 h-3.5" />
                </Link>
              </>
            ) : (
              <>
                <span className={cn(navBase, 'opacity-40')} aria-hidden="true"><ChevronRight className="w-3.5 h-3.5" /></span>
                <span className={cn(navBase, 'opacity-40')} aria-hidden="true"><ChevronsRight className="w-3.5 h-3.5" /></span>
              </>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
