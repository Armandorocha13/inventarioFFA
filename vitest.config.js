import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Ambiente Node puro (sem browser DOM) para os módulos de lógica
    environment: 'node',
    // Mostra cada teste individualmente no relatório
    reporter: 'verbose',
    // Arquivos de teste
    include: ['tests/**/*.test.js'],
    // Cobertura (opcional, ativar com --coverage)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['js/**/*.js'],
      exclude: ['js/app.js'], // app.js depende do DOM
    },
  },
});
