"use client";

interface FetchErrorBannerProps {
  message: string;
  onRetry: () => void;
}

export function FetchErrorBanner({ message, onRetry }: FetchErrorBannerProps) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4 rounded-card border border-danger-bg bg-danger-bg px-4 py-3">
      <p className="text-[13px] text-danger-text">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 rounded-pill border border-danger-text px-3 py-1.5 text-[12px] font-semibold text-danger-text"
      >
        Retry
      </button>
    </div>
  );
}
