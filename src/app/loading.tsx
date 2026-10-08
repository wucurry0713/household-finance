export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-label="正在載入財務資料"
      className="min-h-screen bg-[#f4f7f3] px-4 py-12 sm:px-8"
    >
      <div className="mx-auto max-w-6xl animate-pulse space-y-8">
        <div className="h-14 rounded-xl bg-white" />
        <div className="h-16 rounded-xl bg-white" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="h-28 rounded-xl bg-white" />
          <div className="h-28 rounded-xl bg-white" />
          <div className="h-28 rounded-xl bg-white" />
        </div>
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="h-80 rounded-xl bg-white" />
          <div className="h-80 rounded-xl bg-white" />
        </div>
      </div>
    </main>
  );
}
