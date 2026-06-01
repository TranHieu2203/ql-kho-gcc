---
title: "Sprint Plan & Implementation Readiness — ql-kho-gcc"
status: ready
created: 2026-05-31
language: vi
---

# Implementation Readiness Check

| Item | Status | Note |
|---|---|---|
| Brief approved | ✅ | `/_bmad-output/planning-artifacts/briefs/brief-ql-kho-gcc-2026-05-31/` |
| UX (DESIGN + EXPERIENCE) final | ✅ | `/_bmad-output/planning-artifacts/ux-designs/ux-ql-kho-gcc-2026-05-31/` |
| Architecture final | ✅ | `/_bmad-output/planning-artifacts/architecture/ARCHITECTURE.md` |
| Tech stack chốt | ✅ | Next.js + shadcn + Prisma + SQLite + Lucia + Serwist |
| Data model schema | ✅ | Trong ARCHITECTURE §4 |
| Epics & Stories | ✅ | `EPICS.md` — 7 epics, ~32 stories |
| Open questions | ⚠ 6 còn lại | AQ-1..6 trong ARCHITECTURE §10 — không block Sprint 1-2 |
| Đủ điều kiện code | ✅ | Bắt đầu được |

# Sprint Plan

## Sprint 1 — Nền tảng + Auth + Catalog (E1 + E2 + E3)

**Mục tiêu**: User đăng nhập được, thấy app shell, quản trị products + warehouses + users.

Stories: S1.1, S1.2, S1.3, S1.4, S1.5, S2.1, S2.2, S2.3, S2.4, S3.1, S3.2, S3.3, S3.4, S3.5

**Demo end-of-sprint**: Admin đăng nhập, tạo 2 kho, tạo 8 sản phẩm seed, tạo user thủ kho, gán kho cho user, xem audit log.

## Sprint 2 — Phiếu Nhập/Xuất/Chuyển + Tồn kho (E4 + E5)

**Mục tiêu**: Đầy đủ lõi nghiệp vụ. Tồn realtime đúng, race-safe, transfer 2-step.

Stories: S4.1 – S4.6, S5.1 – S5.3

**Demo end-of-sprint**: Thủ kho nhập 30 lốp → tồn tăng. Tạo phiếu xuất 10 → tồn giảm. Tạo phiếu chuyển HN→BN → tồn HN giảm, status IN_TRANSIT; BN confirm → tồn BN tăng, status CONFIRMED. Race test: 2 phiên xuất cùng SKU → 1 success, 1 conflict.

## Sprint 3 — Reports + PDF + Excel + Offline/PWA (E6 + E7)

**Mục tiêu**: Hoàn thiện báo cáo, in ấn, import, và offline-first.

Stories: S6.1 – S6.4, S7.1 – S7.5

**Demo end-of-sprint**: Xuất báo cáo NXT Excel. In phiếu PDF tiếng Việt đẹp. Import file Excel cũ 2117 dòng → xử lý 12 lỗi + dedupe. Tắt mạng → vẫn tạo phiếu được; bật lại → sync.

# Order of execution trong session này

Code theo Sprint 1 → 2 → 3 sequential. Trong mỗi sprint, ưu tiên các story foundation (data model, types, shared utils) trước UI.
