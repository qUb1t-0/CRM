import type { Metadata } from "next";
import { Box, Pencil, Plus, Trash2 } from "lucide-react";
import { ActionButton, ActionForm, FormActions, Modal, SubmitButton } from "@/components/forms";
import { Badge, Card, EmptyState, Field, Input, PageHeader, Table } from "@/components/ui";
import { getContext } from "@/lib/session";
import { money } from "@/lib/format";
import { deleteProduct, saveProduct } from "./actions";

export const metadata: Metadata = { title: "Produtos" };

type Product = { id: string; name: string; code: string | null; price: number; active: boolean };

function ProductForm({ product }: { product?: Product }) {
  return (
    <ActionForm action={saveProduct.bind(null, product?.id ?? null)} className="space-y-4">
      <Field label="Nome" htmlFor="p-name">
        <Input id="p-name" name="name" required defaultValue={product?.name} maxLength={200} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Código / SKU" htmlFor="p-code">
          <Input id="p-code" name="code" defaultValue={product?.code ?? ""} />
        </Field>
        <Field label="Preço (R$)" htmlFor="p-price">
          <Input id="p-price" name="price" inputMode="decimal" defaultValue={product ? String(product.price).replace(".", ",") : ""} placeholder="0,00" />
        </Field>
      </div>
      {product && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={product.active} className="size-4 accent-[var(--brand)]" />
          Disponível para novas oportunidades
        </label>
      )}
      <FormActions>
        <SubmitButton>Salvar</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}

export default async function ProductsPage() {
  const ctx = await getContext();
  const { data } = await ctx.supabase.from("products").select("id, name, code, price, active").eq("org_id", ctx.org.id).order("active", { ascending: false }).order("name");
  const products = (data ?? []) as Product[];

  return (
    <>
      <PageHeader
        title="Produtos e serviços"
        description="Catálogo usado nos itens das oportunidades e nas propostas."
        actions={
          <Modal title="Novo produto" triggerVariant="primary" trigger={<><Plus className="size-4" /> Novo produto</>}>
            <ProductForm />
          </Modal>
        }
      />
      <Card>
        {products.length === 0 ? (
          <EmptyState icon={<Box className="size-8" />} title="Nenhum produto cadastrado">
            Cadastre produtos para adicioná-los rapidamente às oportunidades.
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Código</th>
                <th className="text-right!">Preço</th>
                <th>Situação</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.name}</td>
                  <td className="text-muted">{p.code ?? "—"}</td>
                  <td className="tabular text-right">{money(p.price)}</td>
                  <td>{p.active ? <Badge tone="ok">Ativo</Badge> : <Badge>Inativo</Badge>}</td>
                  <td>
                    <div className="flex justify-end">
                      <Modal title="Editar produto" triggerVariant="ghost" triggerSize="sm" trigger={<Pencil className="size-3.5" />}>
                        <ProductForm product={p} />
                      </Modal>
                      <ActionButton action={deleteProduct.bind(null, p.id)} confirm={`Mover ${p.name} para a lixeira? Você pode recuperar em Configurações › Lixeira por até 60 dias.`} confirmLabel="Mover para a lixeira" variant="ghost" title="Excluir">
                        <Trash2 className="size-3.5" />
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
