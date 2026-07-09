import NewTenantForm from "./new-tenant-form";

export default function NewTenantPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">เพิ่มเว็บใหม่</h1>
      <NewTenantForm />
    </div>
  );
}
