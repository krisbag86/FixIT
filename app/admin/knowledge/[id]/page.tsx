import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ArticleFormFields } from "@/components/knowledge/article-form";
import { requireUser } from "@/lib/auth";
import { findKnowledgeArticleById, readDatabase } from "@/lib/data-store";
import { can } from "@/lib/permissions";
import { updateKnowledgeArticleAction } from "@/app/actions";

export default async function EditKnowledgeArticlePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();

  if (!can(user, "admin:manage-faq")) {
    redirect("/admin/knowledge");
  }

  const { id } = await params;
  const [article, database] = await Promise.all([findKnowledgeArticleById(id), readDatabase()]);

  if (!article) {
    notFound();
  }

  const categories = database.categories.filter((c) => c.isActive);

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <h1 className="text-3xl font-black">Edytuj artykuł</h1>
        <p className="mt-2 text-ink/65 dark:text-paper/65">Edycja: {article.title}</p>
      </div>
      <form action={updateKnowledgeArticleAction} className="grid gap-5 rounded-md border border-black/10 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-white/10">
        <input type="hidden" name="id" value={article.id} />
        <ArticleFormFields article={article} categories={categories} />
      </form>
    </AppShell>
  );
}
