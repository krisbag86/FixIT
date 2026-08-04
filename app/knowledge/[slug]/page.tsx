import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ArticleDetail } from "@/components/knowledge/article-detail";
import { requireUser } from "@/lib/auth";
import { findCategoryById, findKnowledgeArticleBySlug } from "@/lib/data-store";

export default async function KnowledgeArticlePage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;
  const article = await findKnowledgeArticleBySlug(slug);

  if (!article || !article.isPublished) {
    notFound();
  }

  const category = article.categoryId ? await findCategoryById(article.categoryId) : undefined;

  return (
    <AppShell user={user}>
      <ArticleDetail article={article} category={category} />
    </AppShell>
  );
}
