import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ArticleFormFields } from "@/components/knowledge/article-form";
import { requireUser } from "@/lib/auth";
import { readDatabase } from "@/lib/data-store";
import { can } from "@/lib/permissions";
import { createKnowledgeArticleAction } from "@/app/actions";

export default async function NewKnowledgeArticlePage() {
  const user = await requireUser();

  if (!can(user, "admin:manage-faq")) {
    redirect("/admin/knowledge");
  }

  const database = await readDatabase();
  const categories = database.categories.filter((c) => c.isActive);

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <h1 className="text-3xl font-black">Nowy artykuł</h1>
        <p className="mt-2 text-ink/65 dark:text-paper/65">
          Dodaj nowy artykuł do bazy wiedzy.
        </p>
      </div>
      <form action={createKnowledgeArticleAction} className="grid gap-5 rounded-md border border-black/10 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-white/10">
        <ArticleFormFields categories={categories} />
      </form>
    </AppShell>
  );
}
