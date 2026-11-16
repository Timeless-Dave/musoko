import type { Metadata } from 'next';
import { Hanken_Grotesk } from 'next/font/google';
import { Button } from '@/design-system/primitives';
import { themeScript } from '@/design-system/theme';
import { copy } from '@/content/copy';
import { DemoStrip } from '@/features/demo';
import { SiteHeader } from '@/features/shell';
import { Providers } from './providers';
import './globals.css';

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-hanken',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: `${copy.brand.name}: local food from Arkansas Delta farms`, template: `%s | ${copy.brand.name}` },
  description: copy.brand.tagline,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={hanken.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>
          <Button href="#main" className="skip-link">
            {copy.common.skip}
          </Button>
          <SiteHeader />
          <main id="main" tabIndex={-1}>
            <div className="scroll-sentinel" data-scroll-sentinel aria-hidden="true" />
            {children}
          </main>
          <DemoStrip />
        </Providers>
      </body>
    </html>
  );
}
