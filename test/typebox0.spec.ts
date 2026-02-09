/** biome-ignore-all lint/style/noNonNullAssertion: for testing */
/** biome-ignore-all lint/suspicious/noExplicitAny: for testing */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { type Adapter, createRepository } from "../src";
import { getAllAdapterFactories } from "./adapters";
import { Article } from "./entities/Article";

/**
 * TypeBox0 Integration Tests
 *
 * This test suite validates the TypeBox0 (@sinclair/typebox + @sinclair/typemap)
 * schema provider integration with Ventyd.
 * It ensures that:
 * - TypeBox0 schemas are properly validated using Compile from @sinclair/typemap
 * - Type inference works correctly with Static from @sinclair/typebox
 * - All CRUD operations work with TypeBox0 entities
 * - Validation constraints (minLength, maxLength, array types) are enforced
 */
getAllAdapterFactories().forEach((factory) => {
  describe(`TypeBox0 Integration with ${factory.type.toUpperCase()} Adapter`, () => {
    let adapter: Adapter;

    beforeEach(async () => {
      adapter = await factory.create();
    });

    afterEach(async () => {
      if (factory.cleanup) {
        await factory.cleanup();
      }
    });

    describe("Basic Operations", () => {
      test("should create and retrieve article with TypeBox0 schema", async () => {
        const repository = createRepository(Article, { adapter });

        const article = Article.create({
          body: {
            title: "Getting Started with Ventyd",
            content:
              "Ventyd is an event sourcing library that makes it easy to build scalable applications...",
            author: "Jane Doe",
            tags: ["event-sourcing", "typescript", "ventyd"],
          },
        });

        await repository.commit(article);

        const retrieved = await repository.findOne({
          entityId: article.entityId,
        });

        expect(retrieved).not.toBeNull();
        expect(retrieved?.title).toBe("Getting Started with Ventyd");
        expect(retrieved?.author).toBe("Jane Doe");
        expect(retrieved?.tags).toEqual([
          "event-sourcing",
          "typescript",
          "ventyd",
        ]);
        expect(retrieved?.isDraft).toBe(true);
        expect(retrieved?.isPublished).toBe(false);
        expect(retrieved?.isArchived).toBe(false);
      });

      test("should update article title", async () => {
        const repository = createRepository(Article, { adapter });

        const article = Article.create({
          body: {
            title: "Original Title",
            content: "Some content here",
            author: "John Doe",
            tags: ["test"],
          },
        });

        article.updateTitle("Updated Title");

        await repository.commit(article);

        const retrieved = await repository.findOne({
          entityId: article.entityId,
        });

        expect(retrieved?.title).toBe("Updated Title");
      });

      test("should update article content", async () => {
        const repository = createRepository(Article, { adapter });

        const article = Article.create({
          body: {
            title: "Test Article",
            content: "Original content",
            author: "Author",
            tags: [],
          },
        });

        article.updateContent("Updated content with more details");

        await repository.commit(article);

        const retrieved = await repository.findOne({
          entityId: article.entityId,
        });

        expect(retrieved?.content).toBe("Updated content with more details");
      });

      test("should update article tags", async () => {
        const repository = createRepository(Article, { adapter });

        const article = Article.create({
          body: {
            title: "Test Article",
            content: "Content",
            author: "Author",
            tags: ["tag1", "tag2"],
          },
        });

        article.updateTags(["tag3", "tag4", "tag5"]);

        await repository.commit(article);

        const retrieved = await repository.findOne({
          entityId: article.entityId,
        });

        expect(retrieved?.tags).toEqual(["tag3", "tag4", "tag5"]);
      });
    });

    describe("Publishing Workflow", () => {
      test("should publish article", async () => {
        const repository = createRepository(Article, { adapter });

        const article = Article.create({
          body: {
            title: "Ready to Publish",
            content: "This article is ready",
            author: "Publisher",
            tags: ["ready"],
          },
        });

        expect(article.isDraft).toBe(true);
        expect(article.canPublish).toBe(true);

        article.publish();

        await repository.commit(article);

        const retrieved = await repository.findOne({
          entityId: article.entityId,
        });

        expect(retrieved?.isPublished).toBe(true);
        expect(retrieved?.publishedAt).toBeDefined();
        expect(retrieved?.isDraft).toBe(false);
        expect(retrieved?.canPublish).toBe(false);
      });

      test("should unpublish article", async () => {
        const repository = createRepository(Article, { adapter });

        const article = Article.create({
          body: {
            title: "Article",
            content: "Content",
            author: "Author",
            tags: [],
          },
        });

        article.publish();
        article.unpublish("Needs revision");

        await repository.commit(article);

        const retrieved = await repository.findOne({
          entityId: article.entityId,
        });

        expect(retrieved?.isPublished).toBe(false);
        expect(retrieved?.publishedAt).toBeUndefined();
        expect(retrieved?.isDraft).toBe(true);
      });

      test("should prevent publishing already published article", () => {
        const article = Article.create({
          body: {
            title: "Article",
            content: "Content",
            author: "Author",
            tags: [],
          },
        });

        article.publish();

        expect(() => {
          article.publish();
        }).toThrow("Article is already published");
      });

      test("should prevent unpublishing draft article", () => {
        const article = Article.create({
          body: {
            title: "Article",
            content: "Content",
            author: "Author",
            tags: [],
          },
        });

        expect(() => {
          article.unpublish();
        }).toThrow("Article is not published");
      });
    });

    describe("Archiving Workflow", () => {
      test("should archive article", async () => {
        const repository = createRepository(Article, { adapter });

        const article = Article.create({
          body: {
            title: "Old Article",
            content: "Outdated content",
            author: "Author",
            tags: ["old"],
          },
        });

        article.archive("Content is outdated");

        await repository.commit(article);

        const retrieved = await repository.findOne({
          entityId: article.entityId,
        });

        expect(retrieved?.isArchived).toBe(true);
        expect(retrieved?.state.archivedReason).toBe("Content is outdated");
        expect(retrieved?.state.archivedAt).toBeDefined();
        expect(retrieved?.canEdit).toBe(false);
      });

      test("should unarchive article", async () => {
        const repository = createRepository(Article, { adapter });

        const article = Article.create({
          body: {
            title: "Article",
            content: "Content",
            author: "Author",
            tags: [],
          },
        });

        article.archive("Test");
        article.unarchive();

        await repository.commit(article);

        const retrieved = await repository.findOne({
          entityId: article.entityId,
        });

        expect(retrieved?.isArchived).toBe(false);
        expect(retrieved?.state.archivedReason).toBeUndefined();
        expect(retrieved?.canEdit).toBe(true);
      });

      test("should prevent editing archived article", () => {
        const article = Article.create({
          body: {
            title: "Article",
            content: "Content",
            author: "Author",
            tags: [],
          },
        });

        article.archive("Archived");

        expect(() => {
          article.updateTitle("New Title");
        }).toThrow("Cannot update title of archived article");

        expect(() => {
          article.updateContent("New Content");
        }).toThrow("Cannot update content of archived article");

        expect(() => {
          article.updateTags(["new"]);
        }).toThrow("Cannot update tags of archived article");
      });

      test("should prevent publishing archived article", () => {
        const article = Article.create({
          body: {
            title: "Article",
            content: "Content",
            author: "Author",
            tags: [],
          },
        });

        article.archive("Archived");

        expect(() => {
          article.publish();
        }).toThrow("Cannot publish archived article");
      });

      test("should prevent unpublishing archived article", () => {
        const article = Article.create({
          body: {
            title: "Article",
            content: "Content",
            author: "Author",
            tags: [],
          },
        });

        article.publish();
        article.archive("Archived");

        expect(() => {
          article.unpublish();
        }).toThrow("Cannot unpublish archived article");
      });
    });

    describe("Business Logic Validation", () => {
      test("should enforce non-empty title", () => {
        const article = Article.create({
          body: {
            title: "Original",
            content: "Content",
            author: "Author",
            tags: [],
          },
        });

        expect(() => {
          article.updateTitle("");
        }).toThrow("Title cannot be empty");
      });

      test("should enforce title length limit", () => {
        const article = Article.create({
          body: {
            title: "Original",
            content: "Content",
            author: "Author",
            tags: [],
          },
        });

        const longTitle = "a".repeat(201);
        expect(() => {
          article.updateTitle(longTitle);
        }).toThrow("Title cannot exceed 200 characters");
      });

      test("should enforce non-empty content", () => {
        const article = Article.create({
          body: {
            title: "Title",
            content: "Original content",
            author: "Author",
            tags: [],
          },
        });

        expect(() => {
          article.updateContent("");
        }).toThrow("Content cannot be empty");
      });
    });

    describe("Event Sourcing Features", () => {
      test("should maintain complete event history", async () => {
        const repository = createRepository(Article, { adapter });

        const articleId = "article-history-test";

        const article = Article.create({
          entityId: articleId,
          body: {
            title: "Evolving Article",
            content: "Initial content",
            author: "Author",
            tags: ["initial"],
          },
        });

        // Perform multiple operations
        article.updateTitle("Updated Title");
        article.updateContent("Updated content");
        article.updateTags(["updated", "tags"]);
        article.publish();
        article.unpublish("Needs revision");
        article.updateContent("Final content");
        article.publish();

        await repository.commit(article);

        // Verify event history
        const events = await adapter.getEventsByEntityId({
          entityName: "article",
          entityId: articleId,
        });

        expect(events.length).toBe(8);
        expect(events.map((e) => (e as any).eventName)).toEqual([
          "article:created",
          "article:title_updated",
          "article:content_updated",
          "article:tags_updated",
          "article:published",
          "article:unpublished",
          "article:content_updated",
          "article:published",
        ]);

        // Verify final state
        const retrieved = await repository.findOne({ entityId: articleId });
        expect(retrieved?.title).toBe("Updated Title");
        expect(retrieved?.content).toBe("Final content");
        expect(retrieved?.tags).toEqual(["updated", "tags"]);
        expect(retrieved?.isPublished).toBe(true);
      });

      test("should reconstruct state from events", async () => {
        const repository = createRepository(Article, { adapter });

        const articleId = "article-reconstruct";

        // Create and modify article
        const article = Article.create({
          entityId: articleId,
          body: {
            title: "Original Title",
            content: "Original content",
            author: "Original Author",
            tags: ["original"],
          },
        });

        article.updateTitle("New Title");
        article.updateContent("New content");
        article.updateTags(["new", "tags"]);
        article.publish();

        await repository.commit(article);

        // Retrieve and verify state is reconstructed correctly
        const retrieved = await repository.findOne({ entityId: articleId });

        expect(retrieved?.title).toBe("New Title");
        expect(retrieved?.content).toBe("New content");
        expect(retrieved?.author).toBe("Original Author");
        expect(retrieved?.tags).toEqual(["new", "tags"]);
        expect(retrieved?.isPublished).toBe(true);
      });
    });

    describe("TypeBox0-Specific Features", () => {
      test("should work with TypeBox0 validation constraints", () => {
        // TypeBox0's string length constraints (title: minLength 1, maxLength 200)
        // TypeBox0's array type validation
        // TypeBox0's content minLength constraint

        const article = Article.create({
          body: {
            title: "Valid Title",
            content: "Valid content",
            author: "Author",
            tags: [],
          },
        });

        expect(article.title).toBe("Valid Title");
        expect(article.tags).toEqual([]);
      });

      test("should handle array fields correctly", async () => {
        const repository = createRepository(Article, { adapter });

        const article = Article.create({
          body: {
            title: "Article with Tags",
            content: "Content",
            author: "Author",
            tags: ["tag1", "tag2", "tag3"],
          },
        });

        // Update to empty array
        article.updateTags([]);
        expect(article.tags).toEqual([]);

        // Update back to non-empty array
        article.updateTags(["newtag1", "newtag2"]);

        await repository.commit(article);

        const retrieved = await repository.findOne({
          entityId: article.entityId,
        });

        expect(retrieved?.tags).toEqual(["newtag1", "newtag2"]);
      });

      test("should handle optional fields correctly", async () => {
        const repository = createRepository(Article, { adapter });

        const article = Article.create({
          body: {
            title: "Article",
            content: "Content",
            author: "Author",
            tags: [],
          },
        });

        // publishedAt and archivedReason are optional and should be undefined initially
        expect(article.publishedAt).toBeUndefined();
        expect(article.state.archivedReason).toBeUndefined();

        article.publish();

        // After publishing, publishedAt should be defined
        expect(article.publishedAt).toBeDefined();

        await repository.commit(article);

        const retrieved = await repository.findOne({
          entityId: article.entityId,
        });

        // Optional publishedAt should be defined after publishing
        expect(retrieved?.publishedAt).toBeDefined();

        // Optional archivedReason should still be undefined
        expect(retrieved?.state.archivedReason).toBeUndefined();

        // Archive with reason
        retrieved?.archive("Test archiving");

        await repository.commit(retrieved!);

        const archived = await repository.findOne({
          entityId: article.entityId,
        });

        // Optional archivedReason should now be defined
        expect(archived?.state.archivedReason).toBe("Test archiving");
      });

      test("should work with boolean state fields", async () => {
        const repository = createRepository(Article, { adapter });

        const article = Article.create({
          body: {
            title: "Article",
            content: "Content",
            author: "Author",
            tags: [],
          },
        });

        expect(article.isPublished).toBe(false);
        expect(article.isArchived).toBe(false);

        article.publish();
        expect(article.isPublished).toBe(true);

        article.archive("Test");
        expect(article.isArchived).toBe(true);

        await repository.commit(article);

        const retrieved = await repository.findOne({
          entityId: article.entityId,
        });

        expect(retrieved?.isPublished).toBe(true);
        expect(retrieved?.isArchived).toBe(true);
      });
    });

    describe("Concurrent Operations", () => {
      test("should handle multiple articles concurrently", async () => {
        const repository = createRepository(Article, { adapter });

        const articles = await Promise.all(
          Array.from({ length: 5 }, async (_, i) => {
            const article = Article.create({
              body: {
                title: `Article ${i}`,
                content: `Content for article ${i}`,
                author: `Author ${i}`,
                tags: [`tag${i}`],
              },
            });

            await repository.commit(article);
            return article.entityId;
          }),
        );

        // Verify all articles were created
        expect(articles.length).toBe(5);

        const retrieved = await Promise.all(
          articles.map((id) => repository.findOne({ entityId: id })),
        );

        retrieved.forEach((article, i) => {
          expect(article).not.toBeNull();
          expect(article?.title).toBe(`Article ${i}`);
          expect(article?.author).toBe(`Author ${i}`);
          expect(article?.tags).toEqual([`tag${i}`]);
        });
      });
    });

    describe("Complex Workflows", () => {
      test("should handle full article lifecycle", async () => {
        const repository = createRepository(Article, { adapter });

        // Create draft
        const article = Article.create({
          body: {
            title: "My First Article",
            content: "This is my first article",
            author: "New Author",
            tags: ["first", "intro"],
          },
        });

        expect(article.isDraft).toBe(true);

        // Edit draft
        article.updateTitle("My Awesome First Article");
        article.updateContent("This is my awesome first article with more details");
        article.updateTags(["first", "intro", "awesome"]);

        // Publish
        article.publish();
        expect(article.isPublished).toBe(true);
        expect(article.isDraft).toBe(false);

        // Unpublish for editing
        article.unpublish("Found typos");
        expect(article.isDraft).toBe(true);

        // Edit again
        article.updateContent(
          "This is my awesome first article with corrected details",
        );

        // Republish
        article.publish();

        // Archive after some time
        article.archive("Content is no longer relevant");
        expect(article.isArchived).toBe(true);
        expect(article.canEdit).toBe(false);

        await repository.commit(article);

        const retrieved = await repository.findOne({
          entityId: article.entityId,
        });

        expect(retrieved?.title).toBe("My Awesome First Article");
        expect(retrieved?.content).toBe(
          "This is my awesome first article with corrected details",
        );
        expect(retrieved?.isPublished).toBe(true);
        expect(retrieved?.isArchived).toBe(true);
      });
    });
  });
});
