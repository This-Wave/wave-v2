export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-8 py-7">
      <h1 className="mb-1 text-[22px] font-extrabold tracking-tight text-ink">{title}</h1>
      <p className="mb-8 text-[13px] text-muted">{description}</p>
      <div className="flex h-[240px] items-center justify-center rounded-[14px] border border-dashed border-border text-[13px] text-muted">
        Not built yet — see design-import-spec.md
      </div>
    </div>
  );
}
