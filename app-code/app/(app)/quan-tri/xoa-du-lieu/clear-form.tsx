'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { clearData } from './actions';
import { formatNumber } from '@/lib/utils';
import { Database, FileText, Package, Warehouse as WhIcon, Users, ShieldAlert } from 'lucide-react';

type Scope = 'movements' | 'products' | 'warehouses' | 'all';

type Counts = {
  movements: number;
  receipts: number;
  receiptLines: number;
  products: number;
  warehouses: number;
  users: number;
  sessions: number;
  audits: number;
  settings: number;
};

const SCOPES: { value: Scope; title: string; desc: string; willDelete: string[]; willKeep: string[]; icon: any; tone: string }[] = [
  {
    value: 'movements',
    title: 'Mức 1 — Xoá phiếu & tồn kho',
    desc: 'Reset toàn bộ tồn kho về 0. Giữ nguyên danh mục SP, kho, người dùng, cấu hình.',
    willDelete: ['Tất cả phiếu Nhập/Xuất/Chuyển/Điều chỉnh', 'Lịch sử nhập-xuất-tồn (StockMovement)'],
    willKeep: ['Sản phẩm', 'Kho', 'Người dùng + phân quyền', 'Cấu hình backup'],
    icon: FileText,
    tone: 'text-warning'
  },
  {
    value: 'products',
    title: 'Mức 2 — Xoá thêm danh mục sản phẩm',
    desc: 'Như Mức 1 + xoá toàn bộ sản phẩm. Hữu ích khi import lại từ Excel.',
    willDelete: ['Mọi thứ ở Mức 1', 'Danh mục sản phẩm'],
    willKeep: ['Kho', 'Người dùng + phân quyền', 'Cấu hình backup'],
    icon: Package,
    tone: 'text-warning-strong'
  },
  {
    value: 'warehouses',
    title: 'Mức 3 — Xoá thêm kho',
    desc: 'Như Mức 2 + xoá toàn bộ kho. Giữ tài khoản người dùng và cấu hình.',
    willDelete: ['Mọi thứ ở Mức 2', 'Kho', 'Phân quyền user-kho'],
    willKeep: ['Người dùng', 'Cấu hình backup'],
    icon: WhIcon,
    tone: 'text-danger'
  },
  {
    value: 'all',
    title: 'Mức 4 — Reset toàn bộ (CỰC KỲ NGUY HIỂM)',
    desc: 'Reset về trạng thái mới cài. Giữ duy nhất tài khoản admin đang đăng nhập.',
    willDelete: ['Mọi thứ ở Mức 3', 'Toàn bộ user khác (kể cả admin khác!)', 'Phiên đăng nhập của user khác', 'Cấu hình backup + cài đặt'],
    willKeep: ['Audit log (để có dấu vết)', 'Tài khoản của bạn'],
    icon: ShieldAlert,
    tone: 'text-danger-strong'
  }
];

const CONFIRM_TEXT = 'XOA DU LIEU';

export function ClearDataForm({ counts, adminUsername }: { counts: Counts; adminUsername: string }) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [scope, setScope] = useState<Scope | ''>('');
  const [confirm, setConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ before: Counts; after: Counts } | null>(null);

  const selected = SCOPES.find((s) => s.value === scope);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!scope) { setError('Chưa chọn phạm vi xoá.'); return; }
    if (confirm.trim() !== CONFIRM_TEXT) {
      setError(`Phải gõ chính xác cụm "${CONFIRM_TEXT}".`);
      return;
    }
    if (!password) { setError('Nhập mật khẩu admin.'); return; }

    // Triple confirm cho mức all
    if (scope === 'all') {
      if (!confirm.endsWith(CONFIRM_TEXT)) return;
      if (!window.confirm('LẦN CUỐI: Reset toàn bộ hệ thống về trạng thái mới cài?\nThao tác này không thể hoàn tác!')) return;
      if (!window.confirm('Bạn đã backup chưa? Nếu chưa, BẤM HỦY và backup trước.')) return;
    } else {
      if (!window.confirm(`Xác nhận xoá ${selected?.title.toLowerCase()}?`)) return;
    }

    startTransition(async () => {
      const r = await clearData({ scope, confirm: confirm.trim(), password });
      if (r?.error) {
        setError(r.error);
      } else if (r?.ok) {
        setResult({ before: r.before!, after: r.after! });
        setConfirm('');
        setPassword('');
        setScope('');
        push({ variant: 'success', message: 'Đã xoá dữ liệu theo phạm vi đã chọn.' });
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="space-y-2">
        <div className="text-sm font-medium flex items-center gap-2">
          <Database className="w-4 h-4 text-muted-foreground" />Dữ liệu hiện tại
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <StatCard label="Phiếu" value={counts.receipts} />
          <StatCard label="Dòng phiếu" value={counts.receiptLines} />
          <StatCard label="Bút toán tồn" value={counts.movements} />
          <StatCard label="Sản phẩm" value={counts.products} />
          <StatCard label="Kho" value={counts.warehouses} />
          <StatCard label="Người dùng" value={counts.users} icon={Users} />
          <StatCard label="Phiên ĐN" value={counts.sessions} />
          <StatCard label="Cài đặt" value={counts.settings} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="text-sm font-medium">Chọn phạm vi xoá <span className="text-danger">*</span></div>
        <div className="grid gap-3">
          {SCOPES.map((s) => {
            const Icon = s.icon;
            const checked = scope === s.value;
            return (
              <label
                key={s.value}
                className={`rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                  checked
                    ? 'border-danger bg-danger-soft'
                    : 'border-border hover:border-muted-foreground'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="scope"
                    value={s.value}
                    checked={checked}
                    onChange={() => setScope(s.value)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${s.tone}`} />
                      <div className="font-semibold text-sm">{s.title}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{s.desc}</div>
                    {checked && (
                      <div className="grid md:grid-cols-2 gap-3 pt-2 text-xs">
                        <div>
                          <div className="font-semibold text-danger-strong mb-1">Sẽ xoá</div>
                          <ul className="list-disc pl-4 space-y-0.5">
                            {s.willDelete.map((d) => <li key={d}>{d}</li>)}
                          </ul>
                        </div>
                        <div>
                          <div className="font-semibold text-success mb-1">Sẽ giữ</div>
                          <ul className="list-disc pl-4 space-y-0.5">
                            {s.willKeep.map((d) => <li key={d}>{d}</li>)}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </section>

      {scope && (
        <section className="space-y-3 rounded-lg border-2 border-danger p-4 bg-danger-soft">
          <div className="text-sm font-semibold text-danger-strong">Xác nhận cuối cùng</div>
          <div className="space-y-2">
            <Label htmlFor="confirm">
              Gõ chính xác cụm <code className="bg-card px-1.5 py-0.5 rounded font-mono">{CONFIRM_TEXT}</code>:
            </Label>
            <Input
              id="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              placeholder={CONFIRM_TEXT}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu của bạn (<code className="font-mono">{adminUsername}</code>):</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
        </section>
      )}

      {error && <div role="alert" className="text-sm text-danger-strong bg-danger-soft rounded-md p-3">{error}</div>}

      {result && (
        <div className="rounded-lg border border-success bg-success-soft p-4 text-sm space-y-2">
          <div className="font-semibold text-success">✓ Đã xoá xong</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <DiffCell label="Phiếu" before={result.before.receipts} after={result.after.receipts} />
            <DiffCell label="Bút toán tồn" before={result.before.movements} after={result.after.movements} />
            <DiffCell label="Sản phẩm" before={result.before.products} after={result.after.products} />
            <DiffCell label="Kho" before={result.before.warehouses} after={result.after.warehouses} />
            <DiffCell label="Người dùng" before={result.before.users} after={result.after.users} />
            <DiffCell label="Cài đặt" before={result.before.settings} after={result.after.settings} />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 sticky bottom-0 bg-background border-t -mx-4 md:-mx-6 px-4 md:px-6 py-3">
        <Button
          type="submit"
          variant="destructive"
          disabled={pending || !scope || confirm.trim() !== CONFIRM_TEXT || !password}
        >
          {pending ? 'Đang xoá...' : 'Xác nhận XOÁ'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>Huỷ</Button>
      </div>
    </form>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon?: any }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}{label}
      </div>
      <div className="font-mono font-semibold text-lg">{formatNumber(value)}</div>
    </div>
  );
}

function DiffCell({ label, before, after }: { label: string; before: number; after: number }) {
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-mono">
        <span className="text-muted-foreground">{formatNumber(before)}</span>
        <span className="mx-1">→</span>
        <span className="font-bold">{formatNumber(after)}</span>
      </div>
    </div>
  );
}
