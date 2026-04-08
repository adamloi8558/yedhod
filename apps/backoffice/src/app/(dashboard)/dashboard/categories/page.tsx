import { db } from "@kodhom/db";
import { categories } from "@kodhom/db/schema";
import { asc } from "drizzle-orm";
import { CategoryList } from "@/components/category-list";

export default async function CategoriesPage() {
  const allCategories = await db
    .select()
    .from(categories)
    .orderBy(asc(categories.sortOrder));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">จัดการหมวดหมู่</h1>
        <p className="mt-1 text-sm text-muted-foreground">Categories Management</p>
      </div>
      <CategoryList categories={allCategories} />
    </div>
  );
}
