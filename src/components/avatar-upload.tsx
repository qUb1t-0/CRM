"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, buttonClass, cn } from "@/components/ui";
import { ActionButton } from "@/components/forms";
import { ImageCropper } from "@/components/image-cropper";
import { toast } from "@/components/toast";
import { removeAvatar, setAvatar } from "@/app/(app)/configuracoes/perfil/actions";

const MAX_INPUT_BYTES = 10 * 1024 * 1024;

export function AvatarUpload({ userId, name, url }: { userId: string; name: string; url: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // imagem aberta no editor
  const [pending, start] = useTransition();
  const [dragging, setDragging] = useState(false);
  const shown = preview ?? url;

  function choose(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return toast("Envie uma imagem PNG, JPG ou WebP.", "error");
    if (file.size > MAX_INPUT_BYTES) return toast("A imagem deve ter no máximo 10 MB.", "error");
    setEditing(URL.createObjectURL(file));
  }

  function closeEditor() {
    if (editing) URL.revokeObjectURL(editing);
    setEditing(null);
  }

  /** Recebe a foto já recortada pelo editor (WebP 320×320) e envia ao Storage. */
  function upload(blob: Blob) {
    closeEditor();
    setPreview(URL.createObjectURL(blob));
    start(async () => {
      try {
        const supabase = createClient();
        const path = `${userId}/${Date.now()}.webp`;
        const { error } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/webp", upsert: false });
        if (error) throw new Error(error.message);
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        const res = await setAvatar(data.publicUrl);
        if (res?.error) throw new Error(res.error);
        toast(res?.message ?? "Foto atualizada.");
      } catch (e) {
        setPreview(null);
        toast(e instanceof Error ? e.message : "Não foi possível enviar a foto.", "error");
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          choose(e.dataTransfer.files?.[0]);
        }}
        aria-label="Alterar foto de perfil"
        className={cn("group relative rounded-full outline-offset-4 transition-shadow", dragging && "ring-4 ring-brand/40")}
      >
        <Avatar name={name} src={shown} size="xl" />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Camera className="size-6" />
        </span>
        {pending && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white">
            <Loader2 className="size-6 animate-spin" />
          </span>
        )}
      </button>
      <div className="flex flex-col items-center gap-2 sm:items-start">
        <div className="flex gap-2">
          <button type="button" disabled={pending} onClick={() => inputRef.current?.click()} className={buttonClass("secondary", "sm")}>
            <Camera className="size-4" /> {url ? "Trocar foto" : "Enviar foto"}
          </button>
          {url && !pending && (
            <ActionButton
              action={async () => {
                const res = await removeAvatar();
                if (!res?.error) setPreview(null);
                return res;
              }}
              confirm="Remover sua foto de perfil?"
              confirmLabel="Remover"
              variant="danger"
              size="sm"
              title="Remover foto"
            >
              <Trash2 className="size-4" />
            </ActionButton>
          )}
        </div>
        <p className="text-xs text-muted">PNG, JPG ou WebP (até 10 MB). Você ajusta o enquadramento antes de salvar.</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => choose(e.target.files?.[0])}
      />
      {editing && <ImageCropper src={editing} onCancel={closeEditor} onApply={upload} />}
    </div>
  );
}
