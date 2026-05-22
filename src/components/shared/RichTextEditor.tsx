import { Editor } from '@tinymce/tinymce-react';
import { apiClient } from '../../lib/api';

type RichTextEditorProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isVietnamese: boolean;
  imageUploadPath?: string;
};

export default function RichTextEditor({
  label,
  value,
  onChange,
  isVietnamese,
  imageUploadPath = '/uploads/rich-text-images',
}: RichTextEditorProps) {
  async function uploadEditorImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const result = await apiClient.postForm<{ url: string }>(
      imageUploadPath,
      formData,
    );
    return result.url;
  }

  return (
    <label className="grid gap-2">
      <span className="text-[10px] font-black uppercase tracking-[0.24em] text-on-surface-variant/50">{label}</span>
      <div className="overflow-hidden rounded-2xl border border-on-surface/10 bg-white">
        <Editor
          tinymceScriptSrc="/node_modules/tinymce/tinymce.min.js"
          licenseKey="gpl"
          value={value}
          onEditorChange={onChange}
          init={{
            height: 320,
            menubar: false,
            branding: false,
            promotion: false,
            statusbar: false,
            plugins: 'lists link image table code autoresize',
            toolbar:
              'undo redo | blocks | bold italic underline | forecolor | alignleft aligncenter alignright | bullist numlist | link image table | removeformat code',
            file_picker_types: 'image',
            images_file_types: 'jpeg,jpg,png,gif,webp',
            images_reuse_filename: true,
            automatic_uploads: true,
            images_upload_handler: async (blobInfo) =>
              uploadEditorImage(blobInfo.blob()),
            file_picker_callback: (callback, _value, meta) => {
              if (meta.filetype !== 'image') {
                return;
              }

              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/png,image/jpeg,image/webp,image/gif';
              input.onchange = () => {
                const file = input.files?.[0];
                if (!file) {
                  return;
                }

                void uploadEditorImage(file)
                  .then((url) => callback(url, { alt: file.name }))
                  .catch((error) => {
                    const message =
                      error instanceof Error
                        ? error.message
                        : isVietnamese
                          ? 'Không thể tải ảnh lên.'
                          : 'Unable to upload image.';
                    window.alert(message);
                  });
              };
              input.click();
            },
            autoresize_bottom_margin: 16,
            content_style:
              "body { font-family: Inter, sans-serif; font-size: 14px; line-height: 1.6; padding: 12px; } img { max-width: 100%; height: auto; border-radius: 12px; }",
          }}
        />
      </div>
    </label>
  );
}
