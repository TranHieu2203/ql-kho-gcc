import Link from 'next/link';
import { RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReceiptListSearchParams } from '@/lib/receipt-list-filters';

const fieldCls = 'h-9 w-full rounded-md border bg-background px-3 text-sm';
const labelCls = 'text-xs font-medium text-muted-foreground';

type Props = {
  basePath: string;
  searchParams: ReceiptListSearchParams;
  warehouses: { id: string; code: string; name: string }[];
  /** Nhãn cho ô tìm đối tác, ví dụ "Mã phiếu / NCC". */
  partnerLabel: string;
  activeCount: number;
};

/**
 * Bộ lọc GET cho danh sách phiếu. Submit form không gửi `page` nên luôn quay về trang 1;
 * `pageSize` được giữ qua input ẩn.
 */
export function ReceiptListFilters({ basePath, searchParams, warehouses, partnerLabel, activeCount }: Props) {
  return (
    <form action={basePath} className="p-4 border-b flex-shrink-0 space-y-3">
      {searchParams.pageSize && <input type="hidden" name="pageSize" value={searchParams.pageSize} />}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="space-y-1.5">
          <label className={labelCls} htmlFor="f-from">Từ ngày</label>
          <input id="f-from" type="date" name="from" defaultValue={searchParams.from ?? ''} className={fieldCls} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls} htmlFor="f-to">Đến ngày</label>
          <input id="f-to" type="date" name="to" defaultValue={searchParams.to ?? ''} className={fieldCls} />
        </div>
        <div className="space-y-1.5 col-span-2 md:col-span-1">
          <label className={labelCls} htmlFor="f-wh">Kho</label>
          <select id="f-wh" name="warehouseId" defaultValue={searchParams.warehouseId ?? 'ALL'} className={fieldCls}>
            <option value="ALL">Tất cả các kho</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.code} · {w.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 col-span-2 md:col-span-1">
          <label className={labelCls} htmlFor="f-q">{partnerLabel}</label>
          <input id="f-q" type="search" name="q" defaultValue={searchParams.q ?? ''} placeholder="Gõ để tìm..." className={fieldCls} />
        </div>
        <div className="space-y-1.5 col-span-2 md:col-span-1">
          <label className={labelCls} htmlFor="f-product">Sản phẩm (SKU / tên / size)</label>
          <input id="f-product" type="search" name="product" defaultValue={searchParams.product ?? ''} placeholder="Phiếu có chứa SP..." className={fieldCls} />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 flex-wrap">
        {activeCount > 0 && (
          <Button variant="outline" asChild>
            <Link href={basePath}><RotateCcw className="w-4 h-4" />Xoá lọc</Link>
          </Button>
        )}
        <Button type="submit"><Search className="w-4 h-4" />Áp dụng lọc</Button>
      </div>
    </form>
  );
}
