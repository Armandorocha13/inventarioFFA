# CONTEXTO DO PROJETO — SGI v2.0
> Arquivo de referência para retomada rápida do contexto. Leia este arquivo sempre que precisar se situar no projeto.

---

## 🏢 O que é o SGI

**SGI (Sistema de Gestão de Inventário)** é uma aplicação web standalone (HTML + CSS + JS puro) para realizar contagem física de materiais em almoxarifados de distribuidoras de energia elétrica nos estados do **RJ** e **ES**.

---

## 🗂️ Estrutura de Arquivos

```
sistemaInventario/
├── CONTEXTO_PROJETO.md       ← este arquivo
├── index.html                ← interface principal (a criar)
├── package.json              ← npm + Vitest (ESM)
├── vitest.config.js          ← configuração dos testes
│
├── css/
│   └── estilos.css           ← design system completo (a criar)
│
├── js/
│   ├── dadosMock.js          ← dados mockados (estados, almoxarifados, materiais)
│   ├── filtros.js            ← filtro multi-coluna, ordenação, debounce
│   ├── validacao.js          ← validação de quantidades e observações
│   ├── historico.js          ← log de contagens (quem/quando/antes→depois)
│   ├── exportacao.js         ← preparação de dados limpos para Excel
│   ├── auxiliaresUI.js       ← funções puras de UI (formatação, badges, progresso)
│   └── aplicacao.js          ← orquestrador principal, integra todos os módulos (a criar)
│
└── tests/
    ├── dadosMock.test.js      ← 19 testes ✅
    ├── filtros.test.js        ← 17 testes ✅
    ├── validacao.test.js      ← 16 testes ✅
    ├── historico.test.js      ← 16 testes ✅
    ├── exportacao.test.js     ← 11 testes ✅
    └── auxiliaresUI.test.js   ← 15 testes ✅
```

**Total: 112 testes passando ✅**

---

## 🎯 Funcionalidades do Sistema

### Fluxo principal do usuário
1. Seleciona **Estado (UF)** → RJ ou ES
2. Seleciona **Almoxarifado** (código ex: RJO, VRD, CPS...)
3. Sistema carrega a **lista de materiais** com saldo atual
4. Usuário digita a **nova contagem** por item
5. Pode adicionar **observação** em cada item (divergências)
6. Visualiza a **barra de progresso** (X de Y itens contados)
7. Clica em **FINALIZAR** → modal de confirmação exibe resumo
8. Salva a contagem (atualiza dados mockados / futuramente Google Sheets)
9. Pode **exportar Excel** com dados limpos (sem HTML, com divergências calculadas)

### Funcionalidades confirmadas pelo usuário
- [x] Modo escuro / claro (toggle)
- [x] Histórico de contagens (quem contou, quando, valor anterior vs novo)
- [x] Campo de observação por item
- [x] Modal de confirmação antes de salvar
- [x] Toasts de notificação (sem `alert()`)
- [x] Busca multi-coluna com debounce (descrição + origem)
- [x] Ordenação de colunas clicável
- [x] Badges coloridos por saldo (zero/baixo/ok)
- [x] Barra de progresso da contagem
- [x] Export Excel limpo (sem elementos HTML)

---

## 🗃️ Estrutura dos Dados

### Material (objeto)
```js
{
  id: 'RJO-001',               // identificador único
  origem: 'RJO',               // código do almoxarifado
  descricao: 'CABO DE FORÇA',  // descrição do material
  unidade: 'M',                // unidade de medida
  saldoAtual: 350,             // saldo no sistema (número ≥ 0)
  ultimaAtualizacao: '2025-04-10' // ISO string ou null
}
```

### Contagem (objeto em memória durante a sessão)
```js
{
  id: 'RJO-001',   // referência ao material
  novaQtd: 340,    // quantidade contada fisicamente
  observacao: 'Faltando 10 unidades no setor B'
}
```

### Registro de Histórico
```js
{
  id: 'RJO-001',
  descricao: 'CABO DE FORÇA',
  valorAnterior: 350,
  valorNovo: 340,
  observacao: '...',
  timestamp: '2025-05-20T19:30:00.000Z'
}
```

---

## 🔧 Módulos e Responsabilidades

| Arquivo | Responsabilidade |
|---|---|
| `dadosMock.js` | Fonte de verdade dos dados. Simula Google Sheets. Exporta `getEstados`, `getAlmoxarifados`, `getMateriais` |
| `filtros.js` | `filtrarMateriais` (multi-coluna), `ordenarPor` (imutável, null-last), `debounce` |
| `validacao.js` | `validarQuantidade` (c/ opções), `validarContagens` (batch), `validarObservacao` |
| `historico.js` | State em memória. `adicionarRegistro`, `getHistorico`, `limparHistorico`, `getResumoContagem` |
| `exportacao.js` | `prepararDadosExport` (dados limpos), `gerarNomeArquivo` |
| `auxiliaresUI.js` | `formatarData`, `getBadgeClass`, `calcularProgresso`, `sanitizarTexto`, `truncarTexto` |
| `aplicacao.js` | Orquestrador: inicializa app, gerencia estado da sessão, coordena módulos |

---

## 🎨 Design System (a implementar em `estilos.css`)

- **Fonte**: Inter (Google Fonts)
- **Ícones**: Font Awesome 6 (CDN)
- **Paleta principal**: azul escuro (`#0f172a`) / azul elétrico (`#3b82f6`) / fundo (`#f8fafc`)
- **Modo escuro**: via `data-tema="escuro"` no `<html>`
- **Badges**: `badge-zero` (vermelho), `badge-low` (âmbar), `badge-ok` (verde)
- **Toasts**: posição top-right, auto-dismiss 4s, tipos: sucesso / erro / aviso / info

---

## 🔗 Dependências

- **Vitest** `^4.1.7` — framework de testes (dev)
- **XLSX.js** `0.18.5` — exportação Excel (CDN no HTML)
- **Font Awesome 6** — ícones (CDN)
- **Inter** — tipografia (Google Fonts CDN)

---

## ⚙️ Scripts npm

```bash
npm test          # roda todos os testes uma vez
npm run test:watch # modo watch (re-roda ao salvar)
```

---

## 📌 Contexto de Sessão Atual

- **Fase TDD**: GREEN ✅ — 112/112 testes passando
- **Próximo passo**: implementar `aplicacao.js`, `estilos.css` e `index.html`
- **Backend**: dados mockados por enquanto; futuramente Google Sheets via `google.script.run`
- **Almoxarifados RJ**: RJO, VRD, CPS, ROS
- **Almoxarifados ES**: VVA, CIM, CNA, LNS
