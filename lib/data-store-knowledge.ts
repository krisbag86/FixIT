import "server-only";

import {
  buildAuditPayload,
  describeAuditChanges,
  getKnowledgeArticleAuditChanges
} from "@/lib/admin-utils";
import { appendAdminAuditLog } from "@/lib/data-store-audit";
import { getPrisma, id, readDatabase, shouldUsePrisma, withDatabase } from "@/lib/data-store-core";
import { mapKnowledgeArticle } from "@/lib/data-store-mappers";
import type { KnowledgeArticle } from "@/lib/types";

export async function findKnowledgeArticleBySlug(slug: string): Promise<KnowledgeArticle | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const article = await db.knowledgeArticle.findUnique({ where: { slug } });
    return article ? mapKnowledgeArticle(article) : undefined;
  }

  const database = await readDatabase();
  return database.knowledgeArticles.find((article) => article.slug === slug);
}

export async function findKnowledgeArticleById(id: string): Promise<KnowledgeArticle | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const article = await db.knowledgeArticle.findUnique({ where: { id } });
    return article ? mapKnowledgeArticle(article) : undefined;
  }

  const database = await readDatabase();
  return database.knowledgeArticles.find((article) => article.id === id);
}

export async function createKnowledgeArticle(input: {
  title: string;
  slug: string;
  body: string;
  categoryId?: string;
  isPublished: boolean;
  createdById: string;
  actorId?: string;
}): Promise<KnowledgeArticle> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const article = await db.$transaction(async (tx) => {
      const created = await tx.knowledgeArticle.create({
        data: {
          title: input.title,
          slug: input.slug,
          body: input.body,
          categoryId: input.categoryId,
          isPublished: input.isPublished,
          createdById: input.createdById
        }
      });

      if (input.actorId) {
        await tx.adminAuditLog.create({
          data: {
            actorId: input.actorId,
            action: "KNOWLEDGE_ARTICLE_CREATED",
            entityType: "KNOWLEDGE_ARTICLE",
            entityId: created.id,
            summary: `Artykuł ${created.title}: utworzono${created.isPublished ? " (opublikowany)" : " (szkic)"}`,
            payload: {
              tytulTo: created.title,
              slugTo: created.slug,
              opublikowanyTo: created.isPublished ? "tak" : "nie"
            }
          }
        });
      }

      return created;
    });

    return mapKnowledgeArticle(article);
  }

  return withDatabase((database) => {
    const article: KnowledgeArticle = {
      id: id("ka"),
      title: input.title,
      slug: input.slug,
      body: input.body,
      categoryId: input.categoryId,
      isPublished: input.isPublished
    };
    database.knowledgeArticles.push(article);

    if (input.actorId) {
      appendAdminAuditLog(database, {
        actorId: input.actorId,
        action: "KNOWLEDGE_ARTICLE_CREATED",
        entityType: "KNOWLEDGE_ARTICLE",
        entityId: article.id,
        summary: `Artykuł ${article.title}: utworzono${article.isPublished ? " (opublikowany)" : " (szkic)"}`,
        payload: {
          tytulTo: article.title,
          slugTo: article.slug,
          opublikowanyTo: article.isPublished ? "tak" : "nie"
        }
      });
    }

    return article;
  });
}

export async function updateKnowledgeArticle(input: {
  id: string;
  title: string;
  slug: string;
  body: string;
  categoryId?: string;
  isPublished: boolean;
  updatedById: string;
  actorId?: string;
}): Promise<KnowledgeArticle | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const article = await db.$transaction(async (tx) => {
      const existing = await tx.knowledgeArticle.findUnique({ where: { id: input.id } });
      if (!existing) {
        return undefined;
      }

      const updated = await tx.knowledgeArticle.update({
        where: { id: input.id },
        data: {
          title: input.title,
          slug: input.slug,
          body: input.body,
          categoryId: input.categoryId,
          isPublished: input.isPublished,
          updatedById: input.updatedById
        }
      });

      if (input.actorId) {
        const changes = getKnowledgeArticleAuditChanges(mapKnowledgeArticle(existing), mapKnowledgeArticle(updated));
        if (changes.length > 0) {
          await tx.adminAuditLog.create({
            data: {
              actorId: input.actorId,
              action: "KNOWLEDGE_ARTICLE_UPDATED",
              entityType: "KNOWLEDGE_ARTICLE",
              entityId: updated.id,
              summary: describeAuditChanges("Artykuł", updated.title, changes),
              payload: buildAuditPayload(changes)
            }
          });
        }
      }

      return updated;
    });

    return article ? mapKnowledgeArticle(article) : undefined;
  }

  return withDatabase((database) => {
    const article = database.knowledgeArticles.find((item) => item.id === input.id);
    if (!article) return undefined;

    const before: KnowledgeArticle = { ...article };
    article.title = input.title;
    article.slug = input.slug;
    article.body = input.body;
    article.categoryId = input.categoryId;
    article.isPublished = input.isPublished;

    if (input.actorId) {
      const changes = getKnowledgeArticleAuditChanges(before, article);
      if (changes.length > 0) {
        appendAdminAuditLog(database, {
          actorId: input.actorId,
          action: "KNOWLEDGE_ARTICLE_UPDATED",
          entityType: "KNOWLEDGE_ARTICLE",
          entityId: article.id,
          summary: describeAuditChanges("Artykuł", article.title, changes),
          payload: buildAuditPayload(changes)
        });
      }
    }

    return article;
  });
}

export async function deleteKnowledgeArticle(id: string, actorId?: string): Promise<boolean> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const article = await db.knowledgeArticle.findUnique({ where: { id } });
    if (!article) {
      return false;
    }

    await db.$transaction(async (tx) => {
      await tx.knowledgeArticle.delete({ where: { id } });
      if (actorId) {
        await tx.adminAuditLog.create({
          data: {
            actorId,
            action: "KNOWLEDGE_ARTICLE_DELETED",
            entityType: "KNOWLEDGE_ARTICLE",
            entityId: id,
            summary: `Artykuł ${article.title}: usunięto${article.isPublished ? " (opublikowany)" : " (szkic)"}`,
            payload: {
              tytul: article.title,
              slug: article.slug,
              opublikowany: article.isPublished ? "tak" : "nie"
            }
          }
        });
      }
    });

    return true;
  }

  return withDatabase((database) => {
    const index = database.knowledgeArticles.findIndex((article) => article.id === id);
    if (index === -1) return false;

    const [article] = database.knowledgeArticles.splice(index, 1);
    if (actorId) {
      appendAdminAuditLog(database, {
        actorId,
        action: "KNOWLEDGE_ARTICLE_DELETED",
        entityType: "KNOWLEDGE_ARTICLE",
        entityId: id,
        summary: `Artykuł ${article.title}: usunięto${article.isPublished ? " (opublikowany)" : " (szkic)"}`,
        payload: {
          tytul: article.title,
          slug: article.slug,
          opublikowany: article.isPublished ? "tak" : "nie"
        }
      });
    }

    return true;
  });
}
