export default function Loading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-4">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        กำลังโหลด...
      </div>
    </div>
  );
}
