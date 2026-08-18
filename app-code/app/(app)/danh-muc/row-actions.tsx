'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Pencil, History, Ban, RotateCcw, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { discontinueProduct, restoreProduct, deleteProductPermanently } from './actions';
import { useToast } from '@/components/ui/toast';

type Props = {
  productId: string;
  sku: string;
  active: boolean;
  isAdmin: boolean;
  /** Số dòng phiếu + biến động tồn đang tham chiếu tới mặt hàng này. */
  usageCount: number;
};

export function ProductRowActions({ productId, sku, active, isAdmin, usageCount }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<null | 'discontinue' | 'delete'>(null);
  const [confirmSku, setConfirmSku] = useState('');
  const { push } = useToast();

  const canHardDelete = isAdmin && usageCount === 0;

  function run(fn: () => Promise<{ error?: string; message?: string }>) {
    startTransition(async () => {
      const r = await fn();
      if (r.error) push({ variant: 'danger', message: r.error });
      else {
        push({ variant: 'success', message: r.message ?? 'Đã cập nhật.' });
        router.refresh();
      }
    });
  }

  function closeDialog() {
    setDialog(null);
    setConfirmSku('');
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="p-1.5 rounded-md hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label={`Tuỳ chọn cho sản phẩm ${sku}`}
        >
          <MoreHorizontal className="w-4 h-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/danh-muc/${productId}`}>
              <Pencil className="w-4 h-4" />Sửa
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/ton-kho/${encodeURIComponent(sku)}`}>
              <History className="w-4 h-4" />Lịch sử nhập xuất
            </Link>
          </DropdownMenuItem>

          {isAdmin && active && (
            <DropdownMenuItem onSelect={() => setDialog('discontinue')} disabled={pending}>
              <Ban className="w-4 h-4" />Ngừng áp dụng
            </DropdownMenuItem>
          )}
          {isAdmin && !active && (
            <DropdownMenuItem onSelect={() => run(() => restoreProduct(productId))} disabled={pending}>
              <RotateCcw className="w-4 h-4" />Áp dụng lại
            </DropdownMenuItem>
          )}
          {canHardDelete && (
            <DropdownMenuItem
              onSelect={() => setDialog('delete')}
              disabled={pending}
              className="text-danger focus:text-danger"
            >
              <Trash2 className="w-4 h-4" />Xoá vĩnh viễn
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog && (
        <div
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
          onClick={closeDialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-confirm-title"
        >
          <div className="bg-card border rounded-xl p-6 max-w-md w-full shadow-lg" onClick={(e) => e.stopPropagation()}>
            {dialog === 'discontinue' ? (
              <>
                <h2 id="product-confirm-title" className="text-lg font-semibold mb-2">
                  Ngừng áp dụng <span className="font-mono">{sku}</span>?
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Mặt hàng sẽ bị ẩn khỏi danh mục, tồn kho, ô chọn sản phẩm khi lập phiếu, điều chỉnh tồn và báo cáo NXT.
                  {usageCount > 0 && (
                    <> Phiếu cũ ({usageCount} tham chiếu) và lịch sử nhập xuất vẫn được giữ nguyên.</>
                  )}
                  {' '}Chỉ admin mới thấy và áp dụng lại được.
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={closeDialog}>Huỷ</Button>
                  <Button
                    variant="destructive"
                    disabled={pending}
                    onClick={() => {
                      closeDialog();
                      run(() => discontinueProduct(productId));
                    }}
                  >
                    Ngừng áp dụng
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 id="product-confirm-title" className="text-lg font-semibold mb-2">
                  Xoá vĩnh viễn <span className="font-mono">{sku}</span>?
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Mặt hàng này chưa phát sinh phiếu hay biến động tồn nào nên có thể xoá hẳn khỏi CSDL. Không khôi phục
                  được (audit log vẫn giữ dấu vết thao tác).
                </p>
                <p className="text-sm mb-2">
                  Để xác nhận, gõ mã SKU <span className="font-mono font-semibold">{sku}</span>:
                </p>
                <input
                  type="text"
                  value={confirmSku}
                  onChange={(e) => setConfirmSku(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border bg-background text-sm font-mono mb-4"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={closeDialog}>Huỷ</Button>
                  <Button
                    variant="destructive"
                    disabled={confirmSku !== sku || pending}
                    onClick={() => {
                      const typed = confirmSku;
                      closeDialog();
                      run(() => deleteProductPermanently(productId, typed));
                    }}
                  >
                    Xoá vĩnh viễn
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
