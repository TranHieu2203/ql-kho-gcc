import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * containerClassName: class cho khung cuộn bao ngoài <table>.
 * Trang danh sách truyền "flex-1 min-h-0" để chỉ vùng dữ liệu cuộn,
 * còn header trang / bộ lọc / phân trang đứng yên.
 */
const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement> & { containerClassName?: string }
>(({ className, containerClassName, ...props }, ref) => (
  <div className={cn('relative w-full overflow-auto', containerClassName)}>
    <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
  </div>
));
Table.displayName = 'Table';

/**
 * Header dính khi cuộn. Border-collapse làm mất border của <th> khi sticky,
 * nên dùng inset shadow thay cho đường kẻ dưới, và nền đục để không lộ dòng chạy phía sau.
 */
const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead
      ref={ref}
      className={cn(
        '[&_tr]:border-b',
        '[&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-muted',
        '[&_th]:shadow-[inset_0_-1px_0_hsl(var(--border))]',
        className
      )}
      {...props}
    />
  )
);
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
);
TableBody.displayName = 'TableBody';

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'border-b transition-colors hover:bg-primary-soft data-[state=selected]:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
        className
      )}
      {...props}
    />
  )
);
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn('h-10 px-3 text-left align-middle font-semibold text-muted-foreground text-xs uppercase tracking-wide', className)}
      {...props}
    />
  )
);
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn('px-3 py-2.5 align-middle text-sm', className)} {...props} />
  )
);
TableCell.displayName = 'TableCell';

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
