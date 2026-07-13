'use client';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { updateSettings } from './actions';

export function SettingsForm({ settings }: { settings: Record<string, string> }) {
  const [pending, startTransition] = useTransition();
  const { push } = useToast();

  async function action(fd: FormData) {
    startTransition(async () => {
      const r = await updateSettings(fd);
      if (r?.error) push({ variant: 'danger', message: r.error });
      else push({ variant: 'success', message: 'Đã lưu cấu hình.' });
    });
  }

  return (
    <form action={action} className="space-y-6">
      <section className="space-y-2">
        <div className="text-sm font-medium">Chính sách xuất quá tồn</div>
        <div className="space-y-2">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="out_overstock_policy"
              value="warn"
              defaultChecked={(settings.out_overstock_policy ?? 'warn') === 'warn'}
              className="mt-1"
            />
            <div>
              <div className="text-sm font-medium">Cảnh báo (cho phép xuất)</div>
              <div className="text-xs text-muted-foreground">Hệ thống cảnh báo nhưng vẫn lưu phiếu khi xuất quá tồn.</div>
            </div>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="out_overstock_policy"
              value="block"
              defaultChecked={settings.out_overstock_policy === 'block'}
              className="mt-1"
            />
            <div>
              <div className="text-sm font-medium">Chặn cứng</div>
              <div className="text-xs text-muted-foreground">Từ chối lưu phiếu xuất nếu vượt tồn hiện tại.</div>
            </div>
          </label>
        </div>
      </section>

      <section className="space-y-3 pt-4 border-t">
        <div>
          <div className="text-sm font-semibold">Thông tin công ty (in trên phiếu xuất / biên bản giao hàng)</div>
          <p className="text-xs text-muted-foreground mt-1">Các trường này hiển thị ở phần đầu PDF phiếu xuất kho. Để trống nếu không in.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company_name">Tên công ty</Label>
          <Input
            id="company_name"
            name="company_name"
            defaultValue={settings.company_name ?? ''}
            placeholder="VD: CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ GCC"
            maxLength={256}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company_address">Địa chỉ công ty</Label>
          <Input
            id="company_address"
            name="company_address"
            defaultValue={settings.company_address ?? ''}
            placeholder="VD: Số 10, Đường DX3, KĐT Đặng Xá, Xã Thuận An, Thành phố Hà Nội"
            maxLength={512}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company_bank">Tài khoản ngân hàng</Label>
          <Input
            id="company_bank"
            name="company_bank"
            defaultValue={settings.company_bank ?? ''}
            placeholder="VD: 1159266668 Ngân hàng ACB - chi nhánh Gia Lâm, Hà Nội"
            maxLength={256}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company_phone">Số điện thoại (tuỳ chọn)</Label>
          <Input
            id="company_phone"
            name="company_phone"
            defaultValue={settings.company_phone ?? ''}
            placeholder="VD: 024 1234 5678"
            maxLength={64}
          />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="outbound_receipt_prefix">Tiền tố mã phiếu XUẤT khi in (tuỳ chọn)</Label>
            <Input
              id="outbound_receipt_prefix"
              name="outbound_receipt_prefix"
              defaultValue={settings.outbound_receipt_prefix ?? ''}
              placeholder="VD: PX"
              maxLength={8}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inbound_receipt_prefix">Tiền tố mã phiếu NHẬP khi in (tuỳ chọn)</Label>
            <Input
              id="inbound_receipt_prefix"
              name="inbound_receipt_prefix"
              defaultValue={settings.inbound_receipt_prefix ?? ''}
              placeholder="VD: PN"
              maxLength={8}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          Để trống → in mã gốc <code className="font-mono">OUT-YYYY-NNNN</code> / <code className="font-mono">IN-YYYY-NNNN</code>. Nếu nhập tiền tố (vd: <code className="font-mono">PX</code>, <code className="font-mono">PN</code>), mã in trên PDF sẽ thành <code className="font-mono">PXddmmyy</code> theo ngày phiếu.
        </p>
      </section>

      <Button type="submit" disabled={pending}>{pending ? 'Đang lưu...' : 'Lưu cấu hình'}</Button>
    </form>
  );
}
