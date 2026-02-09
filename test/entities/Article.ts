import { Type } from "@sinclair/typebox";
import { defineReducer, defineSchema, Entity, mutation } from "../../src";
import { typebox } from "../../src/typebox0";

/**
 * Article entity schema definition using TypeBox0 (@sinclair/typebox + @sinclair/typemap)
 * Demonstrates the new TypeBox0 integration with Ventyd
 */
export const articleSchema = defineSchema("article", {
  schema: typebox({
    event: {
      created: Type.Object({
        title: Type.String({ minLength: 1, maxLength: 200 }),
        content: Type.String({ minLength: 1 }),
        author: Type.String(),
        tags: Type.Array(Type.String()),
      }),
      title_updated: Type.Object({
        title: Type.String({ minLength: 1, maxLength: 200 }),
      }),
      content_updated: Type.Object({
        content: Type.String({ minLength: 1 }),
      }),
      tags_updated: Type.Object({
        tags: Type.Array(Type.String()),
      }),
      published: Type.Object({
        publishedAt: Type.String(),
      }),
      unpublished: Type.Object({
        reason: Type.Optional(Type.String()),
      }),
      archived: Type.Object({
        reason: Type.String(),
      }),
      unarchived: Type.Object({}),
    },
    state: Type.Object({
      title: Type.String(),
      content: Type.String(),
      author: Type.String(),
      tags: Type.Array(Type.String()),
      isPublished: Type.Boolean(),
      publishedAt: Type.Optional(Type.String()),
      isArchived: Type.Boolean(),
      archivedReason: Type.Optional(Type.String()),
      archivedAt: Type.Optional(Type.String()),
    }),
  }),
  initialEventName: "article:created",
});

/**
 * Article entity reducer
 */
export const articleReducer = defineReducer(
  articleSchema,
  (prevState, event) => {
    switch (event.eventName) {
      case "article:created": {
        return {
          title: event.body.title,
          content: event.body.content,
          author: event.body.author,
          tags: event.body.tags,
          isPublished: false,
          publishedAt: undefined,
          isArchived: false,
          archivedReason: undefined,
          archivedAt: undefined,
        };
      }
      case "article:title_updated": {
        return {
          ...prevState,
          title: event.body.title,
        };
      }
      case "article:content_updated": {
        return {
          ...prevState,
          content: event.body.content,
        };
      }
      case "article:tags_updated": {
        return {
          ...prevState,
          tags: event.body.tags,
        };
      }
      case "article:published": {
        return {
          ...prevState,
          isPublished: true,
          publishedAt: event.body.publishedAt,
        };
      }
      case "article:unpublished": {
        return {
          ...prevState,
          isPublished: false,
          publishedAt: undefined,
        };
      }
      case "article:archived": {
        return {
          ...prevState,
          isArchived: true,
          archivedReason: event.body.reason,
          archivedAt: event.eventCreatedAt,
        };
      }
      case "article:unarchived": {
        return {
          ...prevState,
          isArchived: false,
          archivedReason: undefined,
          archivedAt: undefined,
        };
      }
      default: {
        return prevState;
      }
    }
  },
);

/**
 * Article entity class with business logic
 */
export class Article extends Entity(articleSchema, articleReducer) {
  // ----------------------
  // Getters
  // ----------------------
  get title() {
    return this.state.title;
  }

  get content() {
    return this.state.content;
  }

  get author() {
    return this.state.author;
  }

  get tags() {
    return this.state.tags;
  }

  get isPublished() {
    return this.state.isPublished;
  }

  get publishedAt() {
    return this.state.publishedAt;
  }

  get isArchived() {
    return this.state.isArchived;
  }

  get isDraft() {
    return !this.state.isPublished && !this.state.isArchived;
  }

  get canEdit() {
    return !this.state.isArchived;
  }

  get canPublish() {
    return !this.state.isPublished && !this.state.isArchived;
  }

  get canUnpublish() {
    return this.state.isPublished && !this.state.isArchived;
  }

  // ----------------------
  // Business methods
  // ----------------------
  updateTitle = mutation(this, (dispatch, title: string) => {
    if (!this.canEdit) {
      throw new Error("Cannot update title of archived article");
    }

    if (title.length === 0) {
      throw new Error("Title cannot be empty");
    }

    if (title.length > 200) {
      throw new Error("Title cannot exceed 200 characters");
    }

    dispatch("article:title_updated", { title });
  });

  updateContent = mutation(this, (dispatch, content: string) => {
    if (!this.canEdit) {
      throw new Error("Cannot update content of archived article");
    }

    if (content.length === 0) {
      throw new Error("Content cannot be empty");
    }

    dispatch("article:content_updated", { content });
  });

  updateTags = mutation(this, (dispatch, tags: string[]) => {
    if (!this.canEdit) {
      throw new Error("Cannot update tags of archived article");
    }

    dispatch("article:tags_updated", { tags });
  });

  publish = mutation(this, (dispatch) => {
    if (!this.canPublish) {
      if (this.state.isArchived) {
        throw new Error("Cannot publish archived article");
      }
      throw new Error("Article is already published");
    }

    dispatch("article:published", {
      publishedAt: new Date().toISOString(),
    });
  });

  unpublish = mutation(this, (dispatch, reason?: string) => {
    if (!this.canUnpublish) {
      if (this.state.isArchived) {
        throw new Error("Cannot unpublish archived article");
      }
      throw new Error("Article is not published");
    }

    dispatch("article:unpublished", { reason });
  });

  archive = mutation(this, (dispatch, reason: string) => {
    if (this.state.isArchived) {
      throw new Error("Article is already archived");
    }

    dispatch("article:archived", { reason });
  });

  unarchive = mutation(this, (dispatch) => {
    if (!this.state.isArchived) {
      throw new Error("Article is not archived");
    }

    dispatch("article:unarchived", {});
  });
}
