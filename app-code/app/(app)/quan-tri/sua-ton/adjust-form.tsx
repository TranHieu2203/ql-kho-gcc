'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, ArrowRight } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { ProductCombobox, type ProductOption } from '@/components/forms/product-combobox';
import { adjustStock, getCurrentStockServer } from './actions';
import { formatNumber } from '@/lib/utils';

type Warehouse = { id: string; code: string; name: string };

type Line = {
  productId: string;
  unit: 'BO' | 'CHIEC';
  currentQty: number | null;     // null = chưa load
  newQty: number;
  reason: string;
  loading: boolean;
};

const emptyLine = (): Line => ({
  productId: '',
  unit: 'BO',
  currentQty: null,
  newQty: 0,
  reason: '',
  loading: false
});

export function AdjustStockForm({
  warehouses,
  products
}: {
  warehouses: Warehouse[];
  products: ProductOption[];
}) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const [warehouseId, setWarehouseId] = useState<string>(warehouses[0]?.id ?? '');
  const [date, setDate] = useState<string>(today);
  const [note, setNote] = useState<string>('');
  const [lines, setLines] = useState<Line[]>([emptyLine()]);

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx: number) =>
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  const updateLine = (idx: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  // Khi đổi warehouse, reset currentQty của tất cả các dòng đã chọn SP
  useEffect(() => {
    setLines((prev) => prev.map((l) => (l.productId ? { ...l, currentQty: null } : l)));
  }, [warehouseId]);

  // Khi (warehouse, product) đã đầy đủ thì fetch tồn hiện tại
  useEffect(() => {
    if (!warehouseId) return;
    lines.forEach((l, idx) => {
      if (l.productId && l.currentQty === null && !l.loading) {
        updateLine(idx, { loading: true });
        getCurrentStockServer(warehouseId, l.productId).then((r) => {
          if ('ok' in r && r.ok) {
            updateLine(idx, { currentQty: r.qty, newQty: r.qty, loading: false });
          } else {
            updateLine(idx, { currentQty: 0, newQty: 0, loading: false });
          }
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.map((l) => l.productId).join(','), warehouseId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!warehouseId) { setError('Chưa chọn kho.'); return; }
    if (lines.some((l) => !l.productId)) { setError('Có dòng chưa chọn sản phẩm.'); return; }
    if (lines.some((l) => l.reason.trim().length < 3)) { setError('Mỗi dòng phải có lý do (≥3 ký tự).'); return; }
    if (lines.some((l) => !Number.isInteger(l.newQty) || l.newQty < 0 || l.newQty > 999999)) {
      setError('Số lượng mới phải là số nguyên ≥ 0.'); return;
    }
    if (lines.some((l) => l.currentQty === null)) { setError('Đang tải tồn hiện tại, vui lòng đợi.'); return; }

    const noChange = lines.every((l) => l.newQty === l.currentQty);
    if (noChange) { setError('Tất cả số lượng mới đều bằng tồn hiện tại — không có gì để điều chỉnh.'); return; }

    // Cảnh báo lệch lớn
    const bigDeltas = lines.filter((l) => Math.abs(l.newQty - (l.currentQty ?? 0)) > 100);
    if (bigDeltas.length > 0) {
      const msg = bigDeltas.map((l) => {
        const p = products.find((p) => p.id === l.productId);
        return `  • ${p?.sku ?? '?'}: ${l.currentQty} → ${l.newQty} (Δ=${l.newQty - (l.currentQty ?? 0)})`;
      }).join('\n');
      if (!confirm(`Có ${bigDeltas.length} dòng lệch > 100. Xác nhận?\n${msg}`)) return;
    }

    // Final confirm
    if (!confirm('Xác nhận lưu điều chỉnh tồn? Thao tác sẽ được audit log.')) return;

    startTransition(async () => {
      const r = await adjustStock({
        warehouseId,
        date,
        note: note.trim() || undefined,
        lines: lines.map((l) => ({
          productId: l.productId,
          unit: l.unit,
          newQty: l.newQty,
          reason: l.reason.trim()
        }))
      });
      if (r?.error) {
        setError(r.error);
      } else {
        push({ variant: 'success', message: `Đã lưu điều chỉnh ${r.receiptCode ?? ''}. ${r.adjustments?.length ?? 0} dòng.` });
        router.push('/ton-kho');
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="warehouseId">Kho <span className="text-danger">*</span></Label>
          <select
            id="warehouseId"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            required
          >
            <option value="">— Chọn kho —</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.code} · {w.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">Ngày kiểm kê <span className="text-danger">*</span></Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="space-y-1.5 md:col-span-3">
          <Label htmlFor="note">Ghi chú chung (tuỳ chọn)</Label>
          <Input
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="VD: Kiểm kê định kỳ quý 2/2026"
            maxLength={500}
          />
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b">
          <div className="font-semibold text-sm">Danh sách điều chỉnh ({lines.length})</div>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="w-4 h-4" />Thêm dòng
          </Button>
        </div>
        <div className="divide-y">
          {lines.map((l, idx) => {
            const delta = l.currentQty !== null ? l.newQty - l.currentQty : 0;
            const deltaSign = delta > 0 ? '+' : '';
            const deltaCls = delta > 0 ? 'text-success' : delta < 0 ? 'text-danger' : 'text-muted-foreground';
            return (
              <div key={idx} className="p-4 grid md:grid-cols-[1.4fr_110px_110px_110px_1.2fr_auto] gap-3 items-end">
                <div className="space-y-1.5">
                  <Label htmlFor={`product-${idx}`}>Sản phẩm <span className="text-danger">*</span></Label>
                  <ProductCombobox
                    inputId={`product-${idx}`}
                    products={products}
                    value={l.productId}
                    onChange={(id, p) => updateLine(idx, {
                      productId: id,
                      unit: (p?.defaultUnit as 'BO' | 'CHIEC') ?? l.unit,
                      currentQty: null,
                      newQty: 0
                    })}
                    required
                    ariaLabel={`Sản phẩm dòng ${idx + 1}`}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tồn hiện tại</Label>
                  <div className="h-9 px-3 rounded-md border bg-muted/40 grid items-center font-mono text-sm text-right">
                    {!l.productId ? <span className="text-muted-foreground">—</span> :
                      l.loading || l.currentQty === null ? <span className="text-muted-foreground text-xs">...</span> :
                      <span>{formatNumber(l.currentQty)}</span>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`new-${idx}`}>Tồn mới <span className="text-danger">*</span></Label>
                  <Input
                    id={`new-${idx}`}
                    type="number"
                    min={0}
                    max={999999}
                    value={l.newQty}
                    onChange={(e) => updateLine(idx, { newQty: parseInt(e.target.value || '0', 10) })}
                    className="font-mono text-right"
                    required
                    disabled={!l.productId || l.loading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Chênh lệch</Label>
                  <div className={`h-9 px-3 rounded-md border bg-background grid items-center font-mono text-sm text-right ${deltaCls}`}>
                    {l.productId && l.currentQty !== null ? (
                      <span className="flex items-center justify-end gap-1">
                        <ArrowRight className="w-3 h-3" />
                        {deltaSign}{formatNumber(delta)}
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`reason-${idx}`}>Lý do <span className="text-danger">*</span></Label>
                  <Input
                    id={`reason-${idx}`}
                    value={l.reason}
                    onChange={(e) => updateLine(idx, { reason: e.target.value })}
                    placeholder="VD: Kiểm kê thực tế, hỏng do va đập..."
                    maxLength={500}
                    required
                  />
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
            );
          })}
        </div>
      </div>

      {error && <div role="alert" className="text-sm text-danger-strong bg-danger-soft rounded-md p-3">{error}</div>}

      <div className="flex items-center gap-2 sticky bottom-0 bg-background border-t -mx-4 md:-mx-6 px-4 md:px-6 py-3">
        <Button type="submit" variant="default" disabled={pending}>
          {pending ? 'Đang lưu...' : 'Lưu điều chỉnh tồn'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>Huỷ</Button>
      </div>
    </form>
  );
}
