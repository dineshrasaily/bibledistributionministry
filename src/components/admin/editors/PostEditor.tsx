import { BilingualField } from "@/components/admin/BilingualField";
import { DateTimeField } from "@/components/admin/DateTimeField";
import {
  CheckboxField,
  GroupError,
  SelectField,
  TextAreaField,
} from "@/components/admin/fields";
import { FormShell } from "@/components/admin/FormShell";
import { optionsOf, POST_TYPE_LABELS } from "@/components/admin/labels";
import { MarkdownEditor } from "@/components/admin/MarkdownEditor";
import { PublishControls } from "@/components/admin/PublishControls";
import { SlugField } from "@/components/admin/SlugField";
import { IMAGE_FIELD_HINT } from "@/components/admin/UploadHint";
import { MediaPickerField } from "@/components/admin/MediaPickerField";
import { getStorageMode } from "@/server/storage";
import { EditorSection as Section } from "@/components/admin/EditorSection";
import { Checkbox } from "@/components/ui/Checkbox";
import { createPostAction, updatePostAction } from "@/server/actions/posts";
import type { getPost } from "@/server/services/posts";
import { listAllCategories } from "@/server/services/categories";

type Post = NonNullable<Awaited<ReturnType<typeof getPost>>>;

/** Create / edit form for a post (server component; loads the categories). */
export async function PostEditor({ post }: { post?: Post }) {
  const categories = await listAllCategories();
  const selected = new Set(post?.categoryIds ?? []);

  return (
    <FormShell
      action={post ? updatePostAction : createPostAction}
      label={post ? "Edit post" : "New post"}
    >
      {post ? <input type="hidden" name="id" value={post.id} /> : null}

      <Section title="Basics">
        <SelectField
          name="type"
          label="Type"
          options={optionsOf(POST_TYPE_LABELS)}
          defaultValue={post?.type ?? "DEVOTIONAL"}
          required
        />
        <BilingualField
          name="title"
          label="Title"
          required
          maxLength={160}
          defaultEn={post?.titleEn}
          defaultNe={post?.titleNe}
        />
        <SlugField defaultValue={post?.slug} />
        <BilingualField
          name="excerpt"
          label="Short summary"
          multiline
          rows={3}
          required
          maxLength={400}
          defaultEn={post?.excerptEn}
          defaultNe={post?.excerptNe}
          hint="Shown on cards on the home page."
        />
      </Section>

      <Section title="Body">
        <MarkdownEditor
          name="bodyEn"
          label="Body (English)"
          lang="en"
          defaultValue={post?.bodyEn}
        />
        <MarkdownEditor
          name="bodyNe"
          label="Body (नेपाली, Nepali)"
          lang="ne"
          defaultValue={post?.bodyNe}
          hint="Leave empty to show the English text."
        />
      </Section>

      <Section title="Scripture & categories">
        <TextAreaField
          name="scriptureRefs"
          label="Scripture references"
          rows={3}
          defaultValue={post?.scriptureRefs.join("\n") ?? ""}
          hint="One per line, for example John 3:16."
        />
        {/* id matches fieldId("categoryIds") so the error summary link lands here. */}
        <fieldset
          id="f-categoryIds"
          tabIndex={-1}
          className="flex flex-col gap-3"
        >
          <legend className="text-sm font-medium text-navy">Categories</legend>
          {categories.length === 0 ? (
            <p className="text-sm text-navy/75">
              No categories yet. Add them under Categories.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {categories.map((c) => (
                <Checkbox
                  key={c.id}
                  id={`category-${c.id}`}
                  name="categoryIds"
                  label={c.nameEn}
                  value={c.id}
                  defaultChecked={selected.has(c.id)}
                />
              ))}
            </div>
          )}
          <GroupError name="categoryIds" />
        </fieldset>
      </Section>

      <Section title="Display">
        <CheckboxField
          name="isFeatured"
          label="Feature on the home page"
          defaultChecked={post?.isFeatured ?? false}
        />
        <MediaPickerField
          name="coverImageUrl"
          label="Cover picture"
          defaultValue={post?.coverImageUrl}
          hint={IMAGE_FIELD_HINT}
          mode={getStorageMode()}
        />
        <DateTimeField
          name="publishedAt"
          label="Publish date"
          defaultValue={post?.publishedAt?.toISOString() ?? null}
          hint="Leave empty to use the time you publish."
        />
      </Section>

      <details className="rounded-lg border border-beige bg-white p-6">
        <summary className="cursor-pointer font-serif text-xl font-semibold text-navy">
          Search engine details (optional)
        </summary>
        <div className="mt-5 flex flex-col gap-5">
          <BilingualField
            name="seoTitle"
            label="Search title"
            maxLength={70}
            defaultEn={post?.seoTitleEn}
            defaultNe={post?.seoTitleNe}
          />
          <BilingualField
            name="seoDescription"
            label="Search description"
            multiline
            rows={2}
            maxLength={160}
            defaultEn={post?.seoDescriptionEn}
            defaultNe={post?.seoDescriptionNe}
          />
        </div>
      </details>

      <PublishControls status={post?.status ?? null} />
    </FormShell>
  );
}
