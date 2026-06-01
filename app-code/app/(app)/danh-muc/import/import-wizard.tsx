'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { CheckCircle2, AlertTriangle, Upload, FileDown, FileText } from 'lucide-react';
import { importData, parseImportFile, type ValidatedRow, type ParsedSheetSummary } from './actions';

type Wh = { id: string; code: string; name: string };

export function ImportWizard({ warehouses }: { warehouses: Wh[] }) {
  const { push } = useToast();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [fileName, setFileName] = useState<string>('');
  const [sheets, setSheets] = useState<ParsedSheetSummary[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>(warehouses[0]?.id ?? '');
  const [validated, setValidated] = useState<ValidatedRow[]>([]);
  const [policy, setPolicy] = useState<'skip-errors' | 'cancel'>('skip-errors');
  const [updateExisting, setUpdateExisting] = useState<boolean>(false);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; errors: number } | null>(null);
  const [pending, startTransition] = useTransition();

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);

    // H2: Send file to SERVER for parse+validate (no client-side xlsx)
    const formData = new FormData();
    formData.append('file', f);
    startTransition(async () => {
      const r = await parseImportFile(formData);
      if ('error' in r) {
        push({ variant: 'danger', message: r.error });
        return;
      }
      setSheets(r.sheets);
      setValidated(r.rows);
      setStep(2);
    });
  }

  function downloadErrorReport() {
    // Use CSV instead of xlsx (no client xlsx dep). UTF-8 BOM for Excel VN.
    const errs = validated.filter((v) => !v.ok);
    const header = ['Sheet', 'Dòng', 'Loại', 'Lỗi', 'Dữ liệu'];
    const escape = (v: any) => {
      const s = String(v ?? '').replace(/"/g, '""');
      return /[,"\n\r]/.test(s) ? `"${s}"` : s;
    };
    const lines = [header.join(',')];
    for (const v of errs) {
      lines.push([
        escape(v.source.sheet),
        v.source.rowIndex,
        v.type,
        escape(v.errors.join('; ')),
        escape(JSON.stringify(v.data ?? {}))
      ].join(','));
    }
    const csv = '﻿' + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'loi-import.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function doImport() {
    if (!warehouseId) {
      push({ variant: 'danger', message: 'Chưa chọn kho đích cho phiếu lịch sử.' });
      return;
    }
    const validRows = validated.filter((v) => v.ok);
    if (policy === 'cancel' && validated.some((v) => !v.ok)) {
      push({ variant: 'danger', message: 'Có dòng lỗi — huỷ toàn bộ theo lựa chọn.' });
      return;
    }
    startTransition(async () => {
      const r = await importData({
        rows: validRows.map((v) => ({ type: v.type, data: v.data })),
        warehouseId,
        updateExisting
      });
      if ('error' in r && r.error) {
        push({ variant: 'danger', message: r.error });
      } else if ('summary' in r && r.summary) {
        setResult(r.summary);
        setStep(4);
      }
    });
  }

  // --- RENDER ---

  if (step === 1) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bước 1/3 — Chọn file Excel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-info-soft border border-info-soft rounded-lg p-4 flex items-start gap-3">
            <FileText className="w-5 h-5 text-info-strong flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium text-info-strong mb-1">Chưa có file?</div>
              <p className="text-xs text-info-strong/80 mb-2">
                Tải template chuẩn để xem cấu trúc 4 sheet (DANH MỤC, NHẬP KHO, XUẤT KHO, CHUYỂN KHO) và các cột bắt buộc.
                Template có sẵn 2 dòng ví dụ trong mỗi sheet — xoá trước khi điền dữ liệu thật.
              </p>
              <Button asChild variant="outline" size="sm">
                <a href="/api/import/template.xlsx">
                  <FileDown className="w-4 h-4" />Tải template (ql-kho-template.xlsx)
                </a>
              </Button>
            </div>
          </div>

          <label className="block border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/40 transition-colors">
            <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" strokeWidth={1.5} />
            <div className="text-sm font-medium mb-1">
              {pending ? 'Đang phân tích file...' : 'Kéo thả hoặc bấm để chọn file .xlsx'}
            </div>
            <div className="text-xs text-muted-foreground">
              Chấp nhận template ql-kho hoặc file Excel cũ (4 sheet: DANH MỤC, NHẬP KHO, XUẤT KHO, CHUYỂN KHO). Tối đa 8MB.
            </div>
            <input type="file" accept=".xlsx" className="hidden" onChange={onFileChange} disabled={pending} />
          </label>
        </CardContent>
      </Card>
    );
  }

  if (step === 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bước 2/3 — Preview &amp; chọn kho đích</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm">
            <span className="text-muted-foreground">File:</span> <span className="font-mono">{fileName}</span>
          </div>
          <div className="space-y-2">
            {sheets.filter((s) => s.rowCount > 0).map((s) => (
              <div key={s.name} className="text-sm flex items-center gap-2">
                <span className="badge badge-info">{s.name}</span>
                <span className="text-muted-foreground">{s.rowCount} dòng dữ liệu</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-4 space-y-2">
            <Label htmlFor="warehouseId">Kho mặc định cho phiếu Nhập / Xuất</Label>
            <select
              id="warehouseId"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="h-9 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Áp dụng cho sheet <strong>NHẬP KHO</strong> và <strong>XUẤT KHO</strong>.
              <br />Sheet <strong>CHUYỂN KHO</strong> dùng mã <strong>TỪ KHO</strong> + <strong>ĐẾN KHO</strong> trong từng dòng.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { setStep(1); setSheets([]); setFileName(''); setValidated([]); }}>Quay lại</Button>
            <Button onClick={() => setStep(3)} disabled={!warehouseId}>Tiếp tục</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 3) {
    const okCount = validated.filter((v) => v.ok).length;
    const errCount = validated.filter((v) => !v.ok).length;
    const byType = {
      PRODUCT: validated.filter((v) => v.type === 'PRODUCT').length,
      INBOUND: validated.filter((v) => v.type === 'INBOUND').length,
      OUTBOUND: validated.filter((v) => v.type === 'OUTBOUND').length,
      TRANSFER: validated.filter((v) => v.type === 'TRANSFER').length
    };
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bước 3/3 — Xác nhận import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="border rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Hợp lệ</div>
              <div className="text-2xl font-bold mono text-success-strong">{okCount}</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Có lỗi</div>
              <div className="text-2xl font-bold mono text-danger-strong">{errCount}</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Sản phẩm</div>
              <div className="text-2xl font-bold mono">{byType.PRODUCT}</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Nhập / Xuất</div>
              <div className="text-2xl font-bold mono">{byType.INBOUND + byType.OUTBOUND}</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Chuyển kho</div>
              <div className="text-2xl font-bold mono">{byType.TRANSFER}</div>
            </div>
          </div>

          {errCount > 0 && (
            <div className="border border-warning-soft rounded-lg p-3 bg-warning-soft text-warning-strong text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium mb-2">{errCount} dòng có lỗi.</p>
                  <details className="text-xs">
                    <summary className="cursor-pointer underline">Xem chi tiết</summary>
                    <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                      {validated.filter((v) => !v.ok).slice(0, 50).map((v, i) => (
                        <li key={i} className="font-mono">
                          {v.source.sheet} dòng {v.source.rowIndex}: {v.errors.join('; ')}
                        </li>
                      ))}
                      {errCount > 50 && <li className="italic">... và {errCount - 50} dòng khác</li>}
                    </ul>
                  </details>
                  <Button variant="outline" size="sm" className="mt-2" onClick={downloadErrorReport}>
                    <FileDown className="w-4 h-4" />Tải file lỗi (loi-import.csv)
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3 border-t pt-4">
            <div>
              <Label className="block mb-2">Chính sách khi có lỗi</Label>
              <div className="space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value="skip-errors" checked={policy === 'skip-errors'} onChange={() => setPolicy('skip-errors')} />
                  <span className="text-sm">Bỏ qua dòng lỗi, import {okCount} dòng hợp lệ</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value="cancel" checked={policy === 'cancel'} onChange={() => setPolicy('cancel')} />
                  <span className="text-sm">Huỷ toàn bộ nếu có lỗi</span>
                </label>
              </div>
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
              <span className="text-sm">Cập nhật sản phẩm đã tồn tại (nếu SKU trùng). Mặc định: bỏ qua.</span>
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" onClick={() => setStep(2)}>Quay lại</Button>
            <Button onClick={doImport} disabled={pending}>
              {pending ? 'Đang import...' : 'Bắt đầu import'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 4 && result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-success" />
            Hoàn tất import
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Đã tạo</div>
              <div className="text-2xl font-bold mono text-success-strong">{result.created}</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Đã cập nhật</div>
              <div className="text-2xl font-bold mono text-info-strong">{result.updated}</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Bỏ qua</div>
              <div className="text-2xl font-bold mono text-muted-foreground">{result.skipped}</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Lỗi (không import)</div>
              <div className="text-2xl font-bold mono text-danger-strong">{result.errors}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <a href="/danh-muc">Xem danh mục</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/ton-kho">Xem tồn kho</a>
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setStep(1);
                setFileName('');
                setSheets([]);
                setValidated([]);
                setResult(null);
              }}
            >
              Import file khác
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
