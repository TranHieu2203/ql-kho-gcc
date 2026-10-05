'use client';
import { ReceiptForm } from '@/components/forms/receipt-form';
import { updateInboundReceipt } from '../../actions';

type Product = { id: string; sku: string; fullName: string; brand: string; size: string; pattern: string; defaultUnit: string };
type Warehouse = { id: string; code: string; name: string };

export function EditInboundClient({
  receiptId,
  version,
  products,
  warehouses,
  initial
}: {
  receiptId: string;
  version: number;
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
    const { type: _t, clientRequestId: _c, ...rest } = payload;
    return await updateInboundReceipt(receiptId, { ...rest, expectedVersion: version });
  }

  return (
    <ReceiptForm
      type="INBOUND"
      products={products}
      warehouses={warehouses}
      action={action}
      initial={initial}
      submitLabelOverride="Lưu thay đổi"
      redirectAfterPath={`/nhap-kho/${receiptId}`}
    />
  );
}
