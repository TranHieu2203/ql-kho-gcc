'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { confirmArrival } from '../actions';

export function ConfirmArrivalButton({ receiptId }: { receiptId: string }) {
  const [pending, startTransition] = useTransition();
  const { push } = useToast();
  const router = useRouter();

  function onClick() {
    if (!confirm('Xác nhận đã nhận đủ hàng tại kho đến? Hành động này sẽ tăng tồn của kho đến.')) return;
    startTransition(async () => {
      const r = await confirmArrival(receiptId);
      if (r.error) push({ variant: 'danger', message: r.error });
      else {
        push({ variant: 'success', message: 'Đã xác nhận nhận hàng.' });
        router.refresh();
      }
    });
  }
  return (
    <Button onClick={onClick} disabled={pending}>
      {pending ? 'Đang xác nhận...' : 'Xác nhận đã nhận'}
    </Button>
  );
}
