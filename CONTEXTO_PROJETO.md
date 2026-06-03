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
| SP | São Paulo | 31 | 31 |
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
│   └── api/                  ← endpoints REST integrados
│       ├── filtros/route.ts  ← busca UFs e Almoxarifados ativos
│       ├── materiais/route.ts← lista materiais filtrados
│       ├── contagem/route.ts ← salva contagem e atualiza saldos
│       └── historico/route.ts← consulta histórico de auditorias
│
├── components/               ← componentes reutilizáveis React (UI e modal)
│   ├── ui/                   ← componentes base de UI
│   ├── ConfirmModal.tsx      ← modal de confirmação de contagem
│   ├── InventoryTable.tsx    ← tabela interativa com busca/ordenação
│   └── HistoryTab.tsx        ← aba de monitoramento do histórico
│
├── hooks/                    ← hooks personalizados para estado e lógica
│   └── useInventario.ts      ← gerencia filtros, paginação, busca e mutações
│
├── lib/                      ← utilitários globais de conexão e dados
│   ├── db.ts                 ← pool de conexões com o Neon DB
│   └── utils.ts              ← funções auxiliares e helpers de estilo
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

## ⚙️ Scripts npm

```bash
npm run dev       # inicia o servidor de desenvolvimento do Next.js
npm run build     # compila o app para produção
npm run start     # executa o app Next.js compilado
npm test          # roda todos os testes com Vitest
```

---

## 📌 Contexto de Sessão Atual

- **Fase**: Integração Concluída ✅
- **Estado**: O projeto foi unificado para conter exclusivamente a aplicação moderna em Next.js na raiz, evitando conflitos de pastas e arquivos legados.
