"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Field, Input, Select, cn } from "@/components/ui";
import { EMAIL_RE, PHONE_RE, UFS, isValidCNPJ, isValidCPF, maskCNPJ, maskCPF, maskPhone, onlyDigits } from "@/lib/br";

type Kind = "empresa" | "pessoa";

export type EntityFieldValues = {
  kind?: Kind;
  name?: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  segment?: string | null;
  state?: string | null;
  city?: string | null;
};

// Cache das cidades por UF durante a sessão (evita refazer a consulta ao reabrir o formulário)
const cityCache = new Map<string, string[]>();

function FieldError({ id, children }: { id: string; children: string | null }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-xs text-danger">
      {children}
    </p>
  );
}

const invalidClass = "border-danger focus:border-danger focus:ring-danger/20";

/** Campos principais do cadastro de empresa/pessoa, com máscaras e validação em tempo real. */
export function EntityFields({ values = {} }: { values?: EntityFieldValues }) {
  const [kind, setKind] = useState<Kind>(values.kind ?? "empresa");
  const initialDoc = onlyDigits(values.document);
  const [doc, setDoc] = useState(
    initialDoc ? ((values.kind ?? "empresa") === "pessoa" ? maskCPF(initialDoc) : maskCNPJ(initialDoc)) : "",
  );
  const [email, setEmail] = useState(values.email ?? "");
  const [phone, setPhone] = useState(values.phone ? maskPhone(values.phone) : "");
  const [uf, setUf] = useState(values.state && UFS.some((u) => u.sigla === values.state) ? values.state : "");
  const [city, setCity] = useState(values.city ?? "");
  const [cities, setCities] = useState<{ uf: string; list: string[]; error?: string }>({ uf: "", list: [] });
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Carrega as cidades da UF escolhida (API do IBGE via /api/cidades)
  useEffect(() => {
    if (!uf) return;
    const cached = cityCache.get(uf);
    if (cached) {
      Promise.resolve().then(() => setCities({ uf, list: cached }));
      return;
    }
    let cancelled = false;
    fetch(`/api/cidades/${uf}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error ?? "Erro ao carregar cidades");
        return data as string[];
      })
      .then((list) => {
        cityCache.set(uf, list);
        if (!cancelled) setCities({ uf, list });
      })
      .catch((e: Error) => {
        if (!cancelled) setCities({ uf, list: [], error: e.message });
      });
    return () => {
      cancelled = true;
    };
  }, [uf]);

  const loadingCities = !!uf && cities.uf !== uf;
  const cityList = cities.uf === uf ? cities.list : [];
  // Mantém a cidade já salva visível mesmo que a grafia não esteja na lista do IBGE
  const cityOptions = city && !cityList.includes(city) ? [city, ...cityList] : cityList;

  // Validações
  const docDigits = onlyDigits(doc);
  const docError = !docDigits
    ? null
    : kind === "pessoa"
      ? docDigits.length !== 11
        ? "O CPF deve ter 11 dígitos."
        : !isValidCPF(docDigits)
          ? "CPF inválido. Confira os números."
          : null
      : docDigits.length !== 14
        ? "O CNPJ deve ter 14 dígitos."
        : !isValidCNPJ(docDigits)
          ? "CNPJ inválido. Confira os números."
          : null;
  const emailError = email && !EMAIL_RE.test(email) ? "Informe um e-mail válido, com @ (ex.: nome@empresa.com.br)." : null;
  const phoneError = phone && !PHONE_RE.test(phone) ? "Informe o telefone completo: (00) 0 0000-0000." : null;

  const show = (name: string, error: string | null) => (touched[name] ? error : null);
  const touch = (name: string) => setTouched((t) => ({ ...t, [name]: true }));

  return (
    <>
      <Field label="Tipo" htmlFor="kind">
        <Select
          id="kind"
          name="kind"
          value={kind}
          onChange={(e) => {
            const next = e.target.value as Kind;
            setKind(next);
            // Reaplica a máscara do novo tipo sobre os dígitos já digitados
            setDoc((d) => (next === "pessoa" ? maskCPF(d) : maskCNPJ(d)));
          }}
        >
          <option value="empresa">Empresa (pessoa jurídica)</option>
          <option value="pessoa">Pessoa física</option>
        </Select>
      </Field>

      <Field label={kind === "pessoa" ? "CPF" : "CNPJ"} htmlFor="document">
        <Input
          id="document"
          name="document"
          inputMode="numeric"
          autoComplete="off"
          value={doc}
          onChange={(e) => setDoc(kind === "pessoa" ? maskCPF(e.target.value) : maskCNPJ(e.target.value))}
          onBlur={() => touch("document")}
          placeholder={kind === "pessoa" ? "000.000.000-00" : "00.000.000/0000-00"}
          maxLength={kind === "pessoa" ? 14 : 18}
          aria-invalid={!!show("document", docError)}
          aria-describedby="document-error"
          className={cn(show("document", docError) && invalidClass)}
        />
        <FieldError id="document-error">{show("document", docError)}</FieldError>
      </Field>

      <Field label={kind === "pessoa" ? "Nome completo" : "Razão social"} htmlFor="name" className="sm:col-span-2">
        <Input id="name" name="name" required maxLength={200} defaultValue={values.name} />
      </Field>

      <Field label="E-mail" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value.trim())}
          onBlur={() => touch("email")}
          placeholder="nome@empresa.com.br"
          aria-invalid={!!show("email", emailError)}
          aria-describedby="email-error"
          className={cn(show("email", emailError) && invalidClass)}
        />
        <FieldError id="email-error">{show("email", emailError)}</FieldError>
      </Field>

      <Field label="Telefone" htmlFor="phone">
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          value={phone}
          onChange={(e) => setPhone(maskPhone(e.target.value))}
          onBlur={() => touch("phone")}
          placeholder="(00) 0 0000-0000"
          maxLength={16}
          aria-invalid={!!show("phone", phoneError)}
          aria-describedby="phone-error"
          className={cn(show("phone", phoneError) && invalidClass)}
        />
        <FieldError id="phone-error">{show("phone", phoneError)}</FieldError>
      </Field>

      <Field label="Site" htmlFor="website">
        <Input id="website" name="website" defaultValue={values.website ?? ""} placeholder="www.exemplo.com.br" />
      </Field>
      <Field label="Segmento" htmlFor="segment">
        <Input id="segment" name="segment" defaultValue={values.segment ?? ""} placeholder="Ex.: Varejo" />
      </Field>

      <Field label="UF" htmlFor="state">
        <Select
          id="state"
          name="state"
          value={uf}
          onChange={(e) => {
            setUf(e.target.value);
            setCity("");
          }}
        >
          <option value="">Selecione o estado…</option>
          {UFS.map((u) => (
            <option key={u.sigla} value={u.sigla}>
              {u.sigla} – {u.nome}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Cidade" htmlFor="city">
        <div className="relative">
          {/* Campo desabilitado não é enviado no formulário: garante que a cidade atual não se perca durante o carregamento */}
          {uf && loadingCities && <input type="hidden" name="city" value={city} />}
          <Select
            id="city"
            name="city"
            value={city}
            disabled={!uf || loadingCities}
            onChange={(e) => setCity(e.target.value)}
            aria-busy={loadingCities}
          >
            <option value="">{!uf ? "Selecione primeiro a UF" : loadingCities ? "Carregando cidades…" : "Selecione a cidade…"}</option>
            {cityOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          {loadingCities && <Loader2 className="absolute top-1/2 right-8 size-4 -translate-y-1/2 animate-spin text-muted" />}
        </div>
        {cities.uf === uf && cities.error && <FieldError id="city-error">{cities.error}</FieldError>}
      </Field>
    </>
  );
}
