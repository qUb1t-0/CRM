import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, PageHeader, inputClass } from "@/components/ui";
import { importEntities } from "../actions";

export const metadata: Metadata = { title: "Importar contatos" };

export default function ImportPage() {
  return (
    <>
      <Link href="/contatos" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Contatos
      </Link>
      <PageHeader title="Importar contatos" description="Traga sua base de empresas e pessoas a partir de uma planilha CSV." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card className="p-5">
          <ActionForm action={importEntities} className="space-y-4">
            <Field label="Arquivo CSV" htmlFor="file" hint="Até 2.000 linhas e 2 MB. Separador ponto e vírgula ou vírgula, codificação UTF-8.">
              <input id="file" name="file" type="file" accept=".csv,text/csv" required className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-surface-2 file:px-2 file:py-1 file:text-sm`} />
            </Field>
            <SubmitButton pendingText="Importando…">Importar</SubmitButton>
          </ActionForm>
        </Card>
        <Card className="p-5 text-sm">
          <h2 className="font-semibold">Formato esperado</h2>
          <p className="mt-2 text-muted">A primeira linha deve conter os nomes das colunas. Apenas &quot;nome&quot; é obrigatória:</p>
          <ul className="mt-3 space-y-1 text-muted">
            <li><code className="text-fg">nome</code>: razão social ou nome da pessoa</li>
            <li><code className="text-fg">tipo</code>: empresa ou pessoa</li>
            <li><code className="text-fg">documento</code>: CNPJ ou CPF</li>
            <li><code className="text-fg">email</code>, <code className="text-fg">telefone</code>, <code className="text-fg">site</code></li>
            <li><code className="text-fg">cidade</code>, <code className="text-fg">estado</code>, <code className="text-fg">segmento</code></li>
          </ul>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-surface-2 p-3 text-xs">
{`nome;tipo;documento;email;telefone;cidade;estado
Acme Ltda;empresa;12345678000190;contato@acme.com;11 4000-0000;São Paulo;SP
Maria Silva;pessoa;12345678901;maria@email.com;;Recife;PE`}
          </pre>
        </Card>
      </div>
    </>
  );
}
