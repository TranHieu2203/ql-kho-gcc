import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { validateRequest } from '@/lib/auth/lucia';
import { AdjustStockForm } from './adjust-form';

export const dynamic = 'force-dynamic';

export default async function AdjustStockPage() {
  const { user } = await validateRequest();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN') redirect('/tong-quan');

  const [warehouses, products] = await Promise.all([
    prisma.warehouse.findMany({ where: { active: true }, orderBy: { code: 'asc' } }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: { sku: 'asc' },
      select: { id: true, sku: true, fullName: true, brand: true, size: true, pattern: true, defaultUnit: true }
    })
  ]);

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sửa tồn cuối (kiểm kê)</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Điều chỉnh tồn kho thực tế sau khi kiểm kê. Hệ thống tự tạo phiếu ADJ-* và bút toán bù chênh lệch, KHÔNG ghi đè lịch sử cũ.
        </p>
      </div>

      <div className="rounded-lg border border-warning bg-warning-soft p-4 text-sm">
        <div className="font-semibold text-warning-strong mb-1">⚠️ Lưu ý</div>
        <ul className="list-disc pl-5 space-y-1 text-foreground/90">
          <li>Chức năng này thay đổi tồn kho. Mọi điều chỉnh đều bị <strong>audit log</strong> và không thể undo trực tiếp (chỉ tạo phiếu điều chỉnh ngược).</li>
          <li>Phải có <strong>lý do</strong> cho mỗi dòng (ví dụ: "kiểm kê quý 2/2026", "hỏng do va đập", "phát hiện thiếu sau kiểm tra").</li>
          <li>Mỗi lần lưu sẽ tạo 1 phiếu kiểu <code className="bg-card px-1 rounded">ADJUSTMENT</code> hiển thị trong audit log nhưng KHÔNG xuất hiện trong danh sách Phiếu Nhập/Xuất.</li>
        </ul>
      </div>

      <AdjustStockForm warehouses={warehouses} products={products as any} />
    </div>
  );
}
