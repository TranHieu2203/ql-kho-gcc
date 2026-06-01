'use client';
import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Printer, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { deleteReceipt } from '@/app/(app)/_actions/delete-receipt';

export function ReceiptActions({
  receiptId,
  receiptCode,
  type,
  canDelete = true,
  isAdmin = false
}: {
  receiptId: string;
  receiptCode: string;
  type: 'INBOUND' | 'OUTBOUND' | 'TRANSFER';
  canDelete?: boolean;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [confirmTyped, setConfirmTyped] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  function doDelete(forceCascade = false) {
    startTransition(async () => {
      const r = await deleteReceipt(receiptId, forceCascade);
      if (r.error) {
        push({ variant: 'danger', message: r.error });
      } else if (r.cascadeWarning && !forceCascade && isAdmin) {
        if (confirm(r.cascadeWarning + '\n\nBạn là admin — vẫn xoá vĩnh viễn?')) {
          doDelete(true);
        }
      } else if (r.cascadeWarning && !isAdmin) {
        push({ variant: 'danger', message: r.cascadeWarning + ' (Chỉ admin có thể xoá vĩnh viễn.)' });
      } else if (r.ok) {
        push({ variant: 'success', message: 'Đã xoá phiếu.' });
        const path = type === 'INBOUND' ? '/nhap-kho' : type === 'OUTBOUND' ? '/xuat-kho' : '/chuyen-kho';
        router.push(path);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex gap-2">
      <Button asChild variant="outline">
        <a href={`/api/receipts/${receiptId}/pdf`} target="_blank" rel="noopener noreferrer">
          <Printer className="w-4 h-4" />In PDF
        </a>
      </Button>
      {canDelete && (
        <>
          <Button
            variant="outline"
            className="text-danger hover:bg-danger-soft"
            onClick={() => setShowConfirm(true)}
            disabled={pending}
          >
            <Trash2 className="w-4 h-4" />Xoá
          </Button>
          {showConfirm && (
            <div
              className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
              onClick={() => setShowConfirm(false)}
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
            >
              <div
                className="bg-card border rounded-xl p-6 max-w-md w-full shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 id="confirm-title" className="text-lg font-semibold mb-2">Xoá phiếu {receiptCode}?</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Hành động này sẽ điều chỉnh tồn kho tự động bằng cách đảo các movement đã ghi.
                  Phiếu sẽ bị xoá vĩnh viễn (audit log vẫn giữ lại lịch sử thao tác).
                </p>
                <p className="text-sm mb-2">Để xác nhận, gõ mã phiếu <span className="font-mono font-semibold">{receiptCode}</span>:</p>
                <input
                  type="text"
                  value={confirmTyped}
                  onChange={(e) => setConfirmTyped(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border bg-background text-sm font-mono mb-4"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setShowConfirm(false)}>Huỷ</Button>
                  <Button
                    variant="destructive"
                    disabled={confirmTyped !== receiptCode || pending}
                    onClick={() => {
                      setShowConfirm(false);
                      doDelete();
                    }}
                  >
                    Xoá vĩnh viễn
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
