// Skeleton shown while the shell layout fetches nav (the 22 modules).
export default function Loading() {
  return (
    <div className="grid h-dvh grid-cols-[auto_1fr_auto] bg-paper">
      <div className="flex w-60 flex-col gap-2 border-r border-line bg-panel p-4">
        <div className="h-6 w-24 rounded-btn bg-skeleton" />
        <div className="mt-2 h-8 w-full rounded-btn bg-skeleton" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-6 w-full rounded-btn bg-skeleton" />
        ))}
      </div>
      <div className="p-8">
        <div className="h-8 w-40 rounded-btn bg-skeleton" />
      </div>
      <div className="w-[340px] border-l border-line bg-panel" />
    </div>
  );
}
