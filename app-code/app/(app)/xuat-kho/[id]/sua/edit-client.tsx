'use client';
import { ReceiptForm } from '@/components/forms/receipt-form';
import { updateOutboundReceipt } from '../../actions';

type Product = { id: string; sku: string; fullName: string; brand: string; size: string; pattern: string; defaultUnit: string };
type Warehouse = { id: string; code: string; name: string };

export function EditOutboundClient({
  receiptId,
  products,
  warehouses,
  initial
}: {
  receiptId: string;
  products: Product[];
  warehouses: Warehouse[];
  initial: {
    warehouseId: string;
    date: string;
    customerOrPartner: string | null;
    customerAddress: string | null;
    customerPhone: string | null;
    note: string | null;
    lines: { productId: string; unit: 'BO' | 'CHIEC'; quantity: number; lineNote?: string }[];
  };
}) {
  async function action(payload: any) {
    // Loại bỏ field type khỏi payload (update action không cần)
    const { type: _t, clientRequestId: _c, ...rest } = payload;
    return await updateOutboundReceipt(receiptId, rest);
  }

  return (
    <ReceiptForm
      type="OUTBOUND"
      products={products}
      warehouses={warehouses}
      action={action}
      initial={initial}
      submitLabelOverride="Lưu thay đổi"
      redirectAfterPath={`/xuat-kho/${receiptId}`}
    />
  );
}
