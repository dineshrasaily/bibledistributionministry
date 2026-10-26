"use server";

import { redirect } from "next/navigation";
import { byIdSchema } from "@/lib/validation/common";
import {
  postSchema,
  postStatusSchema,
  updatePostSchema,
} from "@/lib/validation/posts";
import {
  createPost,
  deletePost,
  setPostStatus,
  updatePost,
} from "@/server/services/posts";
import {
  type ActionResult,
  formDataToObject,
  runAdminAction,
} from "./run-admin-action";

const ARRAY_FIELDS = ["categoryIds", "scriptureRefs"];

export async function createPostAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAdminAction(
    {
      name: "post.create",
      role: "ADMIN",
      schema: postSchema,
      entityType: "Post",
      revalidate: ["public", "admin"],
      successMessage: "Post created.",
      run: createPost,
    },
    formDataToObject(formData, { arrays: ARRAY_FIELDS }),
  );
  // Redirect only after the transaction committed (never inside run).
  if (result.ok && result.data?.id) {
    redirect(`/admin/posts/${result.data.id}?toast=created`);
  }
  return result;
}

export async function updatePostAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      name: "post.update",
      role: "ADMIN",
      schema: updatePostSchema,
      entityType: "Post",
      revalidate: ["public", "admin"],
      successMessage:
        formData.get("intent") === "publish"
          ? "Post saved and published."
          : "Draft saved.",
      run: updatePost,
    },
    formDataToObject(formData, { arrays: ARRAY_FIELDS }),
  );
}

export async function setPostStatusAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    {
      name: "post.status",
      role: "ADMIN",
      schema: postStatusSchema,
      entityType: "Post",
      revalidate: ["public", "admin"],
      successMessage:
        formData.get("status") === "PUBLISHED"
          ? "Post published."
          : "Post unpublished.",
      run: setPostStatus,
    },
    formDataToObject(formData),
  );
}

export async function deletePostAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const result = await runAdminAction(
    {
      name: "post.delete",
      role: "ADMIN",
      schema: byIdSchema,
      entityType: "Post",
      revalidate: ["public", "admin"],
      successMessage: "Post deleted.",
      run: deletePost,
    },
    formDataToObject(formData),
  );
  if (result.ok) redirect("/admin/posts?toast=deleted");
  return result;
}
