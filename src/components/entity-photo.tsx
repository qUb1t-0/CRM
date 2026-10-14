"use client";

import { useRef, useState, useTransition } from "react";
import { Building2, Camera, Loader2, User, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/components/ui";
import { ImageCropper } from "@/components/image-cropper";
import { toast } from "@/components/toast";
import { removeEntityPhoto, setEntityPhoto } from "@/app/(app)/contatos/actions";

const MAX_INPUT_BYTES = 10 * 1024 * 1024;

/**
 * Foto do cliente no topo do perfil: ao passar o cursor aparece a câmera;
 * clicar abre o mesmo mini editor de recorte do perfil de usuário.
 */
export function EntityPhoto({
  orgId,
  entityId,
  name,
  kind,
  url,
}: {
  orgId: string;
  entityId: string;
  name: string;
  kind: "empresa" | "pessoa";
  url: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [dragging, setDragging] = useState(false);
  const shown = preview ?? url;
  const Icon = kind === "pessoa" ? User : Building2;

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

  function upload(blob: Blob) {
    closeEditor();
    setPreview(URL.createObjectURL(blob));
    start(async () => {
      try {
        const supabase = createClient();
        const path = `${orgId}/${entityId}/${Date.now()}.webp`;
        const { error } = await supabase.storage.from("entity-photos").upload(path, blob, { contentType: "image/webp", upsert: false });
        if (error) throw new Error(error.message);
        const { data } = supabase.storage.from("entity-photos").getPublicUrl(path);
        const res = await setEntityPhoto(entityId, data.publicUrl);
        if (res?.error) throw new Error(res.error);
        toast(res?.message ?? "Foto atualizada.");
      } catch (e) {
        setPreview(null);
        toast(e instanceof Error ? e.message : "Não foi possível enviar a foto.", "error");
      }
    });
  }

  function remove() {
    start(async () => {
      const res = await removeEntityPhoto(entityId);
      if (res?.error) toast(res.error, "error");
      else {
        setPreview(null);
        toast(res?.message ?? "Foto removida.");
      }
    });
  }

  return (
    <div className="group/photo relative">
      <button
        type="button"
        disabled={pending}
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
        aria-label={shown ? "Trocar foto do cliente" : "Adicionar foto do cliente"}
        title={shown ? "Trocar foto" : "Adicionar foto"}
        className={cn(
          "relative flex size-16 items-center justify-center overflow-hidden rounded-2xl outline-offset-4 transition-shadow",
          shown ? "ring-1 ring-line" : "bg-brand-soft text-brand",
          dragging && "ring-4 ring-brand/40",
        )}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto do Supabase Storage, já redimensionada
          <img src={shown} alt={`Foto de ${name}`} className="size-full object-cover" />
        ) : (
          <Icon className="size-7" />
        )}
        {/* Efeito hover: câmera para escolher a foto */}
        <span
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/55 text-white transition-opacity",
            pending ? "opacity-100" : "opacity-0 group-hover/photo:opacity-100 group-focus-within/photo:opacity-100",
          )}
        >
          {pending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <>
              <Camera className="size-5" />
              <span className="text-[9px] font-semibold tracking-wide uppercase">{shown ? "Trocar" : "Foto"}</span>
            </>
          )}
        </span>
      </button>

      {shown && !pending && (
        <button
          type="button"
          onClick={remove}
          aria-label="Remover foto do cliente"
          title="Remover foto"
          className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border border-line bg-surface text-muted opacity-0 shadow-sm transition-opacity group-hover/photo:opacity-100 group-focus-within/photo:opacity-100 hover:text-danger"
        >
          <X className="size-3" />
        </button>
      )}

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
