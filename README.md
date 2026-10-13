# Favo CRM

Um CRM de vendas multiempresa, inspirado na análise funcional do NectarCRM (`RELATORIO_NECTARCRM.md`). Ele foi reconstruído com uma stack moderna: **Next.js 16 (App Router) na Vercel** e **Supabase** (Postgres, Auth e Realtime).

## Funcionalidades

| Módulo | O que faz |
|---|---|
| **Início** | Indicadores do mês (pipeline, ponderado, ganhos, perdas), meta, tarefas de hoje e atrasadas, agenda do dia, funil e atividade recente. Alterna entre "meus números" e "equipe". |
| **Oportunidades** | Funil Kanban com arrastar e soltar e atualização em **tempo real**, além de uma lista paginada com filtros. Na ficha: etapas clicáveis, ganhar, perder (com motivo) e reabrir, itens de produto com desconto (o valor é recalculado no banco), propostas, tarefas e histórico. |
| **Contatos** | Empresas e pessoas (CPF e CNPJ, inclusive o alfanumérico), pessoas de contato, oportunidades, tarefas, compromissos e histórico com anotações. Importa e exporta CSV. |
| **Tarefas** | Filtros por em aberto, hoje, atrasadas, 7 dias e concluídas, por responsável e prioridade. Para concluir, basta um clique. |
| **Agenda** | Calendário mensal com os compromissos da equipe ou só os seus. |
| **Propostas** | Geradas com um *snapshot* dos itens da oportunidade, numeradas em sequência por empresa. O ciclo vai de rascunho a enviada e daí a aceita ou recusada. Prontas para imprimir ou salvar em PDF. |
| **Produtos** | Catálogo com preço, usado nos itens das oportunidades. |
| **Metas** | Metas mensais para a equipe e para cada vendedor, com o realizado calculado das vendas ganhas. |
| **Relatórios** | Vendas por mês, funil atual, conversão, ticket médio, motivos de perda, origem e desempenho por vendedor. |
| **Configurações** | Empresa, perfil, usuários (convites e papéis admin/membro), funis e etapas (com probabilidade), motivos de perda e campos personalizados (texto, número, data, lista). |
| **Multiempresa** | Uma pessoa pode pertencer a várias "bases" e trocar entre elas pelo seletor da barra lateral. |
| **Busca global** | Procura em empresas, pessoas de contato e oportunidades. |

### Como o relatório foi traduzido

| No NectarCRM (relatório) | No Favo CRM |
|---|---|
| Multi-tenant com `X-Tenant` e escolha de base no login | Tabela `organizations` e `memberships`, cookie `crm_org` validado no servidor e **RLS do Postgres** isolando cada base |
| Sessão `JSESSIONID` com 8 JWTs de longa duração em `APP_CONFIG` | Supabase Auth com cookies `@supabase/ssr` renovados no `proxy.ts`. Nenhum token extra fica exposto no `window` |
| Envelope `{sucesso, mensagem, logado}` com toasts | Server Actions que devolvem `{ok, error, message}`, com toasts e erros no próprio formulário |
| `NotificationService` (WebSocket `topico:base64`) | Supabase Realtime (`postgres_changes`) no Kanban |
| Constantes `TIMELINE_*` (auditoria) | Tabela `timeline_events` alimentada por **triggers** no banco |
| Cotas e feature gating por plano | Papéis admin/membro (planos e cotas ficam fora do escopo) |
| Sem CSP, cookie sem `Secure`, tokens em URL | Cabeçalhos de segurança no `next.config.ts`, cookies `HttpOnly`/`Secure`/`SameSite`, logout por POST e nenhum token em URL |

## Estrutura

```
supabase/migrations/   # schema, RLS, triggers e RPCs (um único arquivo SQL)
src/proxy.ts           # renovação da sessão e proteção das rotas
src/lib/               # clientes Supabase, sessão/contexto, formatação pt-BR
src/components/        # UI, formulários, timeline, tarefas, seletor de contato
src/app/(auth)/        # login, cadastro, recuperação de senha
src/app/(app)/         # módulos do CRM
src/app/api/exportar/  # exportação CSV
```

## Configuração

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com). A região `sa-east-1` (São Paulo) é a recomendada.
2. Abra **SQL Editor**, cole o conteúdo de `supabase/migrations/20261013000000_init.sql` e execute. Com a CLI, o caminho é `supabase link` seguido de `supabase db push`.
3. Em **Authentication › URL Configuration**:
   - **Site URL**: a URL da Vercel (por exemplo `https://seu-crm.vercel.app`).
   - **Redirect URLs**: adicione `https://seu-crm.vercel.app/auth/callback` e `http://localhost:3000/auth/callback`.
4. (Opcional) Para desenvolver sem confirmar e-mail, desligue **Authentication › Providers › Email › Confirm email**.
5. (Opcional) Para entrar com Google, habilite o provedor em **Authentication › Providers › Google** e defina `NEXT_PUBLIC_GOOGLE_AUTH=true`.

### 2. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

| Variável | Onde encontrar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings › API › Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings › API Keys › Publishable key (`sb_publishable_…`). A chave `anon` legada também funciona. |
| `NEXT_PUBLIC_SITE_URL` | URL pública do site, usada nos links dos e-mails |
| `NEXT_PUBLIC_GOOGLE_AUTH` | `true` para mostrar o botão "Entrar com Google" |

> A aplicação **não usa** a chave `service_role`. Todo acesso passa pela RLS com a sessão do usuário.

### 3. Rodar localmente

```bash
npm install
npm run dev
```

Abra http://localhost:3000, crie uma conta e depois a sua base (empresa). O sistema já cria um funil padrão e os motivos de perda.

### 4. Deploy na Vercel

1. Em [vercel.com/new](https://vercel.com/new), importe o repositório `qUb1t-0/CRM`. O framework Next.js é detectado sozinho.
2. Em **Environment Variables**, cadastre as mesmas variáveis do passo 2, com `NEXT_PUBLIC_SITE_URL` apontando para o domínio da Vercel.
3. Faça o deploy. Depois atualize **Site URL** e **Redirect URLs** no Supabase com o domínio final.

Cada `push` na branch `main` gera um novo deploy automaticamente.

## Convites de usuários

Um administrador cadastra o e-mail em **Configurações › Usuários**. Quando essa pessoa cria a conta ou faz login com o mesmo e-mail, o banco a adiciona à base (`accept_pending_invites`). O envio do e-mail de convite em si não é automático: avise a pessoa para se cadastrar.
