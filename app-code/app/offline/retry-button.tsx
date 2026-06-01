'use client';

export function OfflineRetryButton() {
  return (
    <button
      onClick={() => window.location.reload()}
      className="inline-flex items-center justify-center h-9 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium"
    >
      Thử lại
    </button>
  );
}
