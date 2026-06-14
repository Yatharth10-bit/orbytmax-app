export function TrackerSkeleton() {
  return (
    <div className="h-[min(70vh,560px)] w-full animate-pulse overflow-hidden rounded-[8px] border border-[var(--border)] bg-[#020408]">
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-24 w-24 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/5" />
          <p className="mt-4 text-sm text-[var(--muted)]">Starting globe...</p>
        </div>
      </div>
    </div>
  );
}
