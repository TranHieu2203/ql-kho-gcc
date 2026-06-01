'use client';
import Link from 'next/link';
import { MoreHorizontal, Pencil, EyeOff, Eye } from 'lucide-react';
import { useTransition } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { toggleProductActive } from './actions';
import { useToast } from '@/components/ui/toast';

export function ProductRowActions({ productId, active }: { productId: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  const { push } = useToast();

  const onToggle = () => {
    startTransition(async () => {
      const r = await toggleProductActive(productId);
      if (r.error) push({ variant: 'danger', message: r.error });
      else push({ variant: 'success', message: r.message ?? 'Đã cập nhật.' });
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="p-1.5 rounded-md hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label={`Tuỳ chọn cho sản phẩm`}
      >
        <MoreHorizontal className="w-4 h-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/danh-muc/${productId}`}>
            <Pencil className="w-4 h-4" />Sửa
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onToggle} disabled={pending}>
          {active ? (
            <>
              <EyeOff className="w-4 h-4" />Vô hiệu hoá
            </>
          ) : (
            <>
              <Eye className="w-4 h-4" />Kích hoạt
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
