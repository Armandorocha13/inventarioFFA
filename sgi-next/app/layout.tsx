import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Plataforma de Inventário — FFA Infraestrutura',
  description:
    'Sistema de Gestão de Inventário da FFA Infraestrutura. Realize contagens físicas, analise a Curva ABC e monitore divergências em tempo real.',
  keywords: ['inventário', 'almoxarifado', 'SGI', 'FFA', 'contagem física'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-br" data-tema="claro">
      <head>
        {/* Fontes Premium */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        {/* Ícones Font Awesome */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
        {/* XLSX para exportação */}
        <script
          src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"
          async
        ></script>
      </head>
      <body>{children}</body>
    </html>
  );
}
