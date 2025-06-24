import type { Metadata } from 'next';
import './globals.css';
import { AppHeader } from '@/components/layout/app-header';
import { Toaster } from "@/components/ui/toaster";
import { Inter, Space_Grotesk, Source_Code_Pro } from 'next/font/google';
import { AblyProvider } from '@/components/AblyContext';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const sourceCodePro = Source_Code_Pro({
  subsets: ['latin'],
  variable: '--font-source-code-pro',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'LOLympics',
  description: 'A crazy multiplayer meme competition for the gold medal of comedy!',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${sourceCodePro.variable} dark`}>
      <head>
        {/* Font links removed, next/font handles this now */}
      </head>
      <body className="font-body antialiased min-h-screen bg-background text-foreground">
        <AblyProvider>
          <AppHeader />
          <main className="flex-1 container mx-auto py-8 px-4">
            {children}
          </main>
          <Toaster />
        </AblyProvider>
      </body>
    </html>
  );
}
