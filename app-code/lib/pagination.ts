export const PAGE_SIZES = [25, 50, 100, 200] as const;
export const DEFAULT_PAGE_SIZE = 50;

export type Paging = {
  page: number;
  pageSize: number;
  /** Dùng trực tiếp cho prisma findMany */
  skip: number;
  take: number;
};

/** Đọc ?page= & ?pageSize= từ searchParams, kẹp về khoảng hợp lệ. */
export function parsePaging(
  sp: { page?: string; pageSize?: string },
  defaultSize: number = DEFAULT_PAGE_SIZE
): Paging {
  const rawSize = Number(sp.pageSize);
  const pageSize = (PAGE_SIZES as readonly number[]).includes(rawSize) ? rawSize : defaultSize;
  const rawPage = Number(sp.page);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/**
 * Kẹp lại số trang sau khi đã biết tổng số bản ghi.
 * Trả về khoảng hiển thị 1-indexed để in "X–Y trong N".
 */
export function pageMeta(total: number, paging: Paging) {
  const pageCount = Math.max(1, Math.ceil(total / paging.pageSize));
  const page = Math.min(paging.page, pageCount);
  const from = total === 0 ? 0 : (page - 1) * paging.pageSize + 1;
  const to = Math.min(page * paging.pageSize, total);
  return { page, pageCount, from, to, pageSize: paging.pageSize, total };
}

/** Dãy số trang rút gọn quanh trang hiện tại, ví dụ: 1 … 4 5 6 … 20 */
export function pageWindow(page: number, pageCount: number, span = 2): (number | 'gap')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const pages = new Set<number>([1, pageCount]);
  for (let p = page - span; p <= page + span; p++) {
    if (p >= 1 && p <= pageCount) pages.add(p);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('gap');
    out.push(p);
    prev = p;
  }
  return out;
}
