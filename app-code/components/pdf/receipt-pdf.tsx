/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, Font, renderToBuffer } from '@react-pdf/renderer';
import path from 'path';

// M1: Self-hosted fonts thay vì CDN. File `.woff` đặt trong `public/fonts/` và đọc
// bằng filesystem path (server-side). Tránh CDN tampering + giảm latency render.
Font.register({
  family: 'Roboto',
  fonts: [
    { src: path.join(process.cwd(), 'public', 'fonts', 'roboto-vi-400.woff'), fontWeight: 400 },
    { src: path.join(process.cwd(), 'public', 'fonts', 'roboto-vi-700.woff'), fontWeight: 700 }
  ]
});

const styles = StyleSheet.create({
  page: { fontFamily: 'Roboto', fontSize: 10, padding: 40, paddingBottom: 60, color: '#1B1F26' },
  header: { marginBottom: 14, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#1E5FB4', borderBottomStyle: 'solid' },
  brand: { fontSize: 11, color: '#1E5FB4', fontWeight: 700 },
  title: { fontSize: 18, fontWeight: 700, marginTop: 4 },
  subtitle: { fontSize: 10, color: '#5A6473', marginTop: 2 },
  metaRow: { flexDirection: 'row', marginTop: 12, gap: 24 },
  metaCell: { flexDirection: 'column' },
  metaLabel: { color: '#5A6473', fontSize: 9 },
  metaValue: { fontSize: 11, fontWeight: 700, marginTop: 2 },
  table: { marginTop: 14, borderWidth: 1, borderColor: '#E2E5EB', borderStyle: 'solid' },
  thead: { flexDirection: 'row', backgroundColor: '#F1F2F5', borderBottomWidth: 1, borderBottomColor: '#E2E5EB', borderBottomStyle: 'solid' },
  th: { padding: 6, fontSize: 9, fontWeight: 700, color: '#5A6473', textTransform: 'uppercase' },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E2E5EB', borderBottomStyle: 'solid' },
  td: { padding: 6, fontSize: 10 },
  colStt: { width: '6%' },
  colSku: { width: '32%' },
  colName: { width: '36%' },
  colUnit: { width: '10%' },
  colQty: { width: '16%', textAlign: 'right' },
  noteBox: { marginTop: 14, padding: 8, backgroundColor: '#F7F8FA', borderRadius: 4 },
  noteLabel: { fontSize: 9, color: '#5A6473', marginBottom: 2 },
  noteValue: { fontSize: 10 },
  signRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 36 },
  signCell: { width: '45%', alignItems: 'center' },
  signLabel: { fontSize: 10, fontWeight: 700, marginBottom: 40 },
  signCaption: { fontSize: 9, color: '#5A6473' },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#8B95A4',
    borderTopWidth: 0.5,
    borderTopColor: '#E2E5EB',
    borderTopStyle: 'solid',
    paddingTop: 6
  }
});

const TYPE_LABEL: Record<string, string> = {
  INBOUND: 'PHIẾU NHẬP KHO',
  OUTBOUND: 'PHIẾU XUẤT KHO',
  TRANSFER: 'PHIẾU CHUYỂN KHO',
  ADJUSTMENT: 'PHIẾU ĐIỀU CHỈNH TỒN'
};

export type ReceiptPdfData = {
  code: string;
  type: string;
  date: Date;
  warehouseName: string;
  fromWarehouseName?: string;
  toWarehouseName?: string;
  customerOrPartner?: string | null;
  note?: string | null;
  createdByName: string;
  status: string;
  lines: { sku: string; productName: string; unit: string; quantity: number; lineNote?: string | null }[];
};

function formatDateVN(d: Date) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function ReceiptPdfDoc({ data }: { data: ReceiptPdfData }) {
  const total = data.lines.reduce((s, l) => s + l.quantity, 0);
  const titleLabel = TYPE_LABEL[data.type] ?? 'PHIẾU KHO';
  const isTransfer = data.type === 'TRANSFER';

  return (
    <Document title={`${data.code} — ${titleLabel}`} author="QL Kho Lốp">
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <Text style={styles.brand}>QL KHO LỐP</Text>
          <Text style={styles.title}>{titleLabel}</Text>
          <Text style={styles.subtitle}>Mã phiếu: {data.code}</Text>
        </View>

        <View style={styles.metaRow}>
          <View style={[styles.metaCell, { flex: 1 }]}>
            <Text style={styles.metaLabel}>Ngày</Text>
            <Text style={styles.metaValue}>{formatDateVN(data.date)}</Text>
          </View>
          {isTransfer ? (
            <>
              <View style={[styles.metaCell, { flex: 1 }]}>
                <Text style={styles.metaLabel}>Từ kho</Text>
                <Text style={styles.metaValue}>{data.fromWarehouseName ?? '—'}</Text>
              </View>
              <View style={[styles.metaCell, { flex: 1 }]}>
                <Text style={styles.metaLabel}>Đến kho</Text>
                <Text style={styles.metaValue}>{data.toWarehouseName ?? '—'}</Text>
              </View>
            </>
          ) : (
            <View style={[styles.metaCell, { flex: 1 }]}>
              <Text style={styles.metaLabel}>Kho</Text>
              <Text style={styles.metaValue}>{data.warehouseName}</Text>
            </View>
          )}
          <View style={[styles.metaCell, { flex: 1 }]}>
            <Text style={styles.metaLabel}>Người lập</Text>
            <Text style={styles.metaValue}>{data.createdByName}</Text>
          </View>
        </View>

        {data.customerOrPartner && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.metaLabel}>Khách hàng / Đối tác</Text>
            <Text style={styles.metaValue}>{data.customerOrPartner}</Text>
          </View>
        )}

        <View style={styles.table}>
          <View style={styles.thead} fixed>
            <Text style={[styles.th, styles.colStt]}>STT</Text>
            <Text style={[styles.th, styles.colSku]}>Mã SKU</Text>
            <Text style={[styles.th, styles.colName]}>Tên sản phẩm</Text>
            <Text style={[styles.th, styles.colUnit]}>ĐVT</Text>
            <Text style={[styles.th, styles.colQty]}>Số lượng</Text>
          </View>
          {data.lines.map((ln, i) => (
            <View key={i} style={styles.tr} wrap={false}>
              <Text style={[styles.td, styles.colStt]}>{i + 1}</Text>
              <Text style={[styles.td, styles.colSku]}>{ln.sku}</Text>
              <Text style={[styles.td, styles.colName]}>{ln.productName}</Text>
              <Text style={[styles.td, styles.colUnit]}>{ln.unit === 'BO' ? 'Bộ' : 'Chiếc'}</Text>
              <Text style={[styles.td, styles.colQty]}>{ln.quantity}</Text>
            </View>
          ))}
          <View style={[styles.tr, { backgroundColor: '#E8F0FB' }]}>
            <Text style={[styles.td, styles.colStt, { fontWeight: 700 }]}></Text>
            <Text style={[styles.td, styles.colSku, { fontWeight: 700 }]}>Tổng cộng</Text>
            <Text style={[styles.td, styles.colName]}>{data.lines.length} dòng</Text>
            <Text style={[styles.td, styles.colUnit]}></Text>
            <Text style={[styles.td, styles.colQty, { fontWeight: 700 }]}>{total}</Text>
          </View>
        </View>

        {data.note && (
          <View style={styles.noteBox} wrap={false}>
            <Text style={styles.noteLabel}>Ghi chú</Text>
            <Text style={styles.noteValue}>{data.note}</Text>
          </View>
        )}

        <View style={styles.signRow} wrap={false}>
          <View style={styles.signCell}>
            <Text style={styles.signLabel}>Người lập phiếu</Text>
            <Text style={styles.signCaption}>(Ký, ghi rõ họ tên)</Text>
          </View>
          <View style={styles.signCell}>
            <Text style={styles.signLabel}>{data.type === 'OUTBOUND' ? 'Người nhận hàng' : data.type === 'TRANSFER' ? 'Người nhận tại kho đến' : 'Thủ kho'}</Text>
            <Text style={styles.signCaption}>(Ký, ghi rõ họ tên)</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            QL Kho Lốp · {data.code} · In lúc {formatDateVN(new Date())}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) => `Trang ${pageNumber}/${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

export async function renderReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
  return await renderToBuffer(<ReceiptPdfDoc data={data} />);
}
