import Link from 'next/link';
import { redirect } from 'next/navigation';
import { validateRequest } from '@/lib/auth/lucia';
import { prisma } from '@/lib/db/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft } from 'lucide-react';
import { SettingsForm } from './settings-form';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { user } = await validateRequest();
  if (!user || user.role !== 'ADMIN') redirect('/tong-quan');

  const settings = await prisma.setting.findMany();
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-4">
      <Link href="/quan-tri" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="w-4 h-4" />Quay lại
      </Link>
      <h1 className="text-2xl font-bold">Cấu hình hệ thống</h1>
      <Card>
        <CardHeader>
          <CardTitle>Chính sách nghiệp vụ</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsForm settings={map} />
        </CardContent>
      </Card>
    </div>
  );
}
