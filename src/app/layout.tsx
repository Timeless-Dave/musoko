import type { Metadata } from 'next';
import { Hanken_Grotesk } from 'next/font/google';
import { Button } from '@/design-system/primitives';
import { themeScript } from '@/design-system/theme';
import { copy } from '@/content/copy';
import { AssistantFab } from '@/features/assistant';
import { DemoStrip } from '@/features/demo';
import { SiteFooter, SiteHeader } from '@/features/shell';
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
        <link rel="icon" href="/brand/favicon-yellow.svg" type="image/svg+xml" data-musoko-icon="" />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          <Button href="#main" className="skip-link">
            {copy.common.skip}
          </Button>
          <SiteHeader />
          <main id="main" tabIndex={-1}>
            <div className="scroll-sentinel" data-scroll-sentinel aria-hidden="true" />
            {children}
          </main>
          <SiteFooter />
          <DemoStrip />
          <AssistantFab />
        </Providers>
      </body>
    </html>
  );
}
