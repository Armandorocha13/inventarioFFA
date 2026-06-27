# CONTEXTO DO PROJETO — SGI v2.0
> Arquivo de referência para retomada rápida do contexto. Leia este arquivo sempre que precisar se situar no projeto.

---

## 🏢 O que é o SGI

**SGI (Sistema de Gestão de Inventário)** é uma aplicação web baseada em Next.js (React + TypeScript) para realizar contagem física de materiais em almoxarifados de distribuidoras de energia elétrica nos estados do **RJ, ES, SP, MG e PR**, conectada a um banco de dados relacional PostgreSQL (Neon DB).

### Contratos ativos por UF

| UF | Estado | Ferramentaria | SSO |
|----|--------|:---:|:---:|
| RJ | Rio de Janeiro | 21 | 41 |
| ES | Espírito Santo | 61 | 62 |
| SP | São Paulo | 1 | 31 |
| MG | Minas Gerais | 58 | 59 |
| PR | Paraná | 71 | 72 |

---

## 🗂️ Estrutura de Arquivos

```
sistemaInventario/
├── CONTEXTO_PROJETO.md       ← este arquivo
├── README.md                 ← guia de início do Next.js
├── package.json              ← scripts do Next.js e Vitest
├── tsconfig.json             ← configuração do TypeScript
├── next.config.mjs           ← configuração do Next.js
├── eslint.config.mjs         ← regras de linting
├── vitest.config.ts          ← configuração dos testes do Next.js
├── vitest.setup.ts           ← setup do ambiente de testes (JSDOM)
├── schema.js                 ← definição de schema do banco
├── run-migration.js          ← migração para tabelas do banco
├── deploy.bat                ← script auxiliar de deploy
├── logo.png                  ← logo da aplicação
│
├── app/                      ← páginas e rotas da API (App Router)
│   ├── page.tsx              ← tela principal do inventário
│   ├── layout.tsx            ← layout global com tema
│   └── api/                  ← endpoints REST (handlers HTTP finos)
│       ├── filtros/route.ts  ← delega → filtros.service
│       ├── materiais/route.ts← delega → materiais.service
│       ├── contagem/route.ts ← delega → contagem.service
│       ├── historico/route.ts← delega → historico.service
│       └── upload-saldo/route.ts ← delega → upload.service
│
├── components/               ← componentes reutilizáveis React (UI e modal)
│   ├── ui/                   ← componentes base de UI
│   ├── ModalConfirmacao.tsx  ← modal de confirmação de contagem
│   ├── TabContagem.tsx       ← tabela interativa com busca/ordenação
│   └── TabMonitoramento.tsx  ← aba de monitoramento do histórico
│
├── hooks/                    ← hooks personalizados para estado e lógica
│   └── useInventario.ts      ← gerencia filtros, paginação, busca e mutações
│
├── lib/                      ← núcleo de domínio, dados e utilitários
│   ├── domain/types.ts       ← fonte única dos tipos de domínio
│   ├── db/                   ← camada de acesso a dados
│   │   ├── adapter.ts        ← contrato Db (query/transaction)
│   │   ├── pg.ts             ← implementação Postgres (Neon)
│   │   └── index.ts          ← seleciona a implementação ativa
│   ├── services/            ← regras de negócio (SQL isolado das rotas)
│   │   ├── filtros.service.ts
│   │   ├── materiais.service.ts
│   │   ├── contagem.service.ts
│   │   ├── historico.service.ts
│   │   └── upload.service.ts
│   ├── auxiliaresUI.ts       ← funções puras de UI (formatação, ABC, acuracidade)
│   ├── filtros.ts            ← filtro/ordenação e padronização de cidades
│   ├── exportacao.ts         ← preparação de dados para Excel
│   └── utils.ts              ← helpers de estilo (cn)
│
├── docs/                     ← Documentação e Planilhas
│   └── planilhas/            ← Arquivos Excel (.xlsx)
│
├── public/                   ← arquivos estáticos (logo, ícones)
│
└── __tests__/                ← testes unitários e de integração (Vitest + Testing Library)
```

---

## 🎯 Funcionalidades do Sistema

### Fluxo principal do usuário
1. Seleciona **Estado (UF)** → RJ ou ES
2. Seleciona **Almoxarifado** (cidade e contrato)
3. Sistema carrega a **lista de materiais** com saldo atual direto do banco de dados
4. Usuário digita a **nova contagem** por item
5. Pode adicionar **observação** em cada item (divergências)
6. Visualiza a **barra de progresso** (X de Y itens contados)
7. Clica em **FINALIZAR** → modal de confirmação exibe resumo
8. Salva a contagem (persistência relacional com transação que atualiza o estoque e insere no histórico)
9. Pode **exportar Excel** com dados limpos e desvios calculados

### Funcionalidades integradas
- [x] Modo escuro / claro (toggle) com classes baseadas em tema
- [x] Histórico de contagens persistente no banco Neon
- [x] Campo de observação por item
- [x] Modal de confirmação antes de salvar
- [x] Toasts e alertas visuais de notificação
- [x] Busca multi-coluna com debounce na tabela
- [x] Ordenação de colunas clicável
- [x] Badges dinâmicos de status baseados no saldo
- [x] Barra de progresso da contagem por almoxarifado
- [x] Exportação de planilha Excel limpa

---

## 🗃️ Estrutura dos Dados

### Material
```typescript
interface Material {
  id: string;               // ID único no banco
  origem: string;           // Cidade do almoxarifado
  codmat: string;           // Código do material
  descricao: string;        // Descrição detalhada
  unidade: string;          // Unidade (M, UN, etc.)
  saldoAtual: number;       // Saldo de estoque físico
  precoUnitario: number;    // Preço do material
  ultimaAtualizacao: string;// ISO Timestamp
}
```

### Registro de Histórico
```typescript
interface HistoricoRegistro {
  id: number;
  codmat: string;
  descricao: string;
  valorAnterior: number;
  valorNovo: number;
  desvio: number;
  observacao: string | null;
  timestamp: string;
}
```

---

## 🗄️ Camada de Banco de Dados

O acesso a dados é abstraído por um **adapter** (`lib/db/adapter.ts`) com duas
implementações selecionadas em runtime (`lib/db/index.ts`):

| Driver | Quando | Arquivo |
|--------|--------|---------|
| **SQLite** | desenvolvimento (sem `DATABASE_URL`) | `lib/db/sqlite.ts` |
| **Postgres** | produção / `DATABASE_URL` presente | `lib/db/pg.ts` |

Seleção: `DB_DRIVER=sqlite|pg` força explicitamente; sem ele, usa Postgres se
`DATABASE_URL` existir, senão SQLite. Os *services* emitem SQL no dialeto
Postgres; o adapter SQLite traduz os Postgres-ismos (`$N`, `ILIKE`, casts,
`TRANSLATE`) para que o mesmo SQL rode nos dois bancos.

**Schema** (canônico em `lib/db/migrations/*.sql`):
`de_para_projeto`, `de_para_itens`, `saldo_estoque`, `progresso_contagem`,
`historico_contagem` (tabela de auditoria real) e a view `vw_estoque_contagem`.

## ⚙️ Scripts npm

```bash
npm run dev        # servidor de desenvolvimento do Next.js
npm run build      # compila o app para produção
npm run start      # executa o app compilado
npm test           # roda os testes com Vitest

npm run db:migrate # aplica as migrations no banco SQLite (dev)
npm run db:seed    # popula o banco a partir de docs/planilhas/
npm run db:reset   # recria o banco do zero (migrate + seed)
```

> O banco SQLite de dev fica em `data/sgi-dev.sqlite` (gitignored). Rode
> `npm run db:reset` após clonar para ter dados locais.

---

## 📌 Contexto de Sessão Atual

- **Fase**: Refatoração arquitetural + recriação do banco ✅
- **Estado**: Arquitetura em camadas (rotas finas → services → adapter de
  banco). Banco recriado em SQLite para desenvolvimento, com schema versionado
  em migrations e replicável para Postgres em produção. Histórico de contagens
  passou a ser persistido em tabela própria (`historico_contagem`).
