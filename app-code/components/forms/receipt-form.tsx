'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Trash2, Plus } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

type Product = { id: string; sku: string; fullName: string; defaultUnit: string };
type Warehouse = { id: string; code: string; name: string };
type Line = { productId: string; unit: 'BO' | 'CHIEC'; quantity: number; lineNote?: string };

type Props = {
  type: 'INBOUND' | 'OUTBOUND' | 'TRANSFER';
  products: Product[];
  warehouses: Warehouse[];
  defaultWarehouseId?: string | null;
  action: (payload: any) => Promise<{ ok?: boolean; error?: string; receiptId?: string; receiptCode?: string; backdateWarning?: string }>;
};

function randomClientRequestId(): string {
  // tiny UUID4-ish
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const labels = {
  INBOUND: { title: 'Tạo phiếu nhập', save: 'Lưu phiếu nhập', warehouseLabel: 'Kho nhận hàng' },
  OUTBOUND: { title: 'Tạo phiếu xuất', save: 'Lưu phiếu xuất', warehouseLabel: 'Kho xuất hàng' },
  TRANSFER: { title: 'Tạo phiếu chuyển kho', save: 'Lưu phiếu chuyển', warehouseLabel: 'Kho nguồn (từ)' }
};

export function ReceiptForm({ type, products, warehouses, defaultWarehouseId, action }: Props) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const [warehouseId, setWarehouseId] = useState<string>(defaultWarehouseId ?? warehouses[0]?.id ?? '');
  const [toWarehouseId, setToWarehouseId] = useState<string>('');
  const [date, setDate] = useState<string>(today);
  const [customerOrPartner, setCustomerOrPartner] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [lines, setLines] = useState<Line[]>([{ productId: '', unit: 'BO', quantity: 1 }]);

  const lbl = labels[type];

  const addLine = () =>
    setLines((prev) => [...prev, { productId: '', unit: 'BO', quantity: 1 }]);
  const removeLine = (idx: number) =>
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  const updateLine = (idx: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  function onSelectProduct(idx: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    updateLine(idx, { productId, unit: (p?.defaultUnit as 'BO' | 'CHIEC') ?? 'BO' });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Local validate
    if (!warehouseId) {
      setError('Chưa chọn kho.');
      return;
    }
    if (type === 'TRANSFER') {
      if (!toWarehouseId) { setError('Chưa chọn kho đến.'); return; }
      if (toWarehouseId === warehouseId) { setError('Kho đến phải khác kho nguồn.'); return; }
    }
    if (lines.some((l) => !l.productId)) { setError('Có dòng chưa chọn sản phẩm.'); return; }
    if (lines.some((l) => !Number.isInteger(l.quantity) || l.quantity <= 0)) {
      setError('Số lượng phải là số nguyên dương.');
      return;
    }
    if (lines.some((l) => l.quantity > 9999)) { setError('Số lượng tối đa 9999.'); return; }
    if (lines.some((l) => l.quantity > 500)) {
      if (!confirm('Có dòng số lượng > 500. Xác nhận?')) return;
    }

    const basePayload = {
      type,
      warehouseId,
      toWarehouseId: type === 'TRANSFER' ? toWarehouseId : undefined,
      date,
      customerOrPartner: customerOrPartner.trim() || undefined,
      note: note.trim() || undefined,
      lines,
      clientRequestId: randomClientRequestId()
    };

    const submit = (forceBackdate = false) =>
      startTransition(async () => {
        const r = await action({ ...basePayload, forceBackdate });
        if (r?.backdateWarning) {
          if (confirm(r.backdateWarning)) submit(true);
          return;
        }
        if (r?.error) {
          setError(r.error);
        } else {
          push({ variant: 'success', message: `Đã lưu phiếu ${r.receiptCode ?? ''}.` });
          const path = type === 'INBOUND' ? '/nhap-kho' : type === 'OUTBOUND' ? '/xuat-kho' : '/chuyen-kho';
          router.push(path);
          router.refresh();
        }
      });
    submit();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="warehouseId">{lbl.warehouseLabel} <span className="text-danger">*</span></Label>
          <select
            id="warehouseId"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            required
          >
            <option value="">— Chọn kho —</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        {type === 'TRANSFER' && (
          <div className="space-y-1.5">
            <Label htmlFor="toWarehouseId">Kho đến <span className="text-danger">*</span></Label>
            <select
              id="toWarehouseId"
              value={toWarehouseId}
              onChange={(e) => setToWarehouseId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              required
            >
              <option value="">— Chọn kho đến —</option>
              {warehouses.filter((w) => w.id !== warehouseId).map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="date">Ngày <span className="text-danger">*</span></Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        {type === 'OUTBOUND' && (
          <div className="space-y-1.5 md:col-span-3">
            <Label htmlFor="customerOrPartner">Khách hàng / Người nhận (tự do)</Label>
            <Input
              id="customerOrPartner"
              value={customerOrPartner}
              onChange={(e) => setCustomerOrPartner(e.target.value)}
              placeholder="VD: Hải - Nghệ An"
              maxLength={256}
            />
          </div>
        )}
        <div className="space-y-1.5 md:col-span-3">
          <Label htmlFor="note">Ghi chú phiếu</Label>
          <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b">
          <div className="font-semibold text-sm">Danh sách sản phẩm ({lines.length})</div>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="w-4 h-4" />Thêm dòng
          </Button>
        </div>
        <div className="divide-y">
          {lines.map((l, idx) => (
            <div key={idx} className="p-4 grid md:grid-cols-[1fr_120px_120px_auto] gap-3 items-end">
              <div className="space-y-1.5">
                <Label htmlFor={`product-${idx}`}>Sản phẩm <span className="text-danger">*</span></Label>
                <select
                  id={`product-${idx}`}
                  value={l.productId}
                  onChange={(e) => onSelectProduct(idx, e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-mono"
                  required
                >
                  <option value="">— Chọn —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.sku}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`qty-${idx}`}>Số lượng <span className="text-danger">*</span></Label>
                <Input
                  id={`qty-${idx}`}
                  type="number"
                  min={1}
                  max={9999}
                  value={l.quantity}
                  onChange={(e) => updateLine(idx, { quantity: parseInt(e.target.value || '0', 10) })}
                  className="font-mono text-right"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`unit-${idx}`}>ĐVT</Label>
                <select
                  id={`unit-${idx}`}
                  value={l.unit}
                  onChange={(e) => updateLine(idx, { unit: e.target.value as 'BO' | 'CHIEC' })}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="BO">Bộ</option>
                  <option value="CHIEC">Chiếc</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => removeLine(idx)}
                disabled={lines.length === 1}
                className="h-9 w-9 grid place-items-center rounded-md border hover:bg-muted disabled:opacity-30"
                aria-label="Xoá dòng"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && <div role="alert" className="text-sm text-danger-strong bg-danger-soft rounded-md p-3">{error}</div>}

      <div className="flex items-center gap-2 sticky bottom-0 bg-background border-t -mx-4 md:-mx-6 px-4 md:px-6 py-3">
        <Button type="submit" disabled={pending}>{pending ? 'Đang lưu...' : lbl.save}</Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>Huỷ</Button>
      </div>
    </form>
  );
}
