import Link from 'next/link';
import { copy } from '@/content/copy';
import { Logo } from '@/design-system/brand/Logo';
import { Section } from '@/design-system/primitives';
import { NAV } from '../nav';

export function SiteFooter() {
  return (
    <Section as="footer" tone="inverse" pad="tight" className="site-footer">
      <div className="site-footer__grid">
        <div>
          <p className="site-footer__brand">
            <Logo size={36} />
            <span>{copy.brand.name}</span>
          </p>
          <p>{copy.brand.tagline}</p>
          <p>{copy.brand.initiative}</p>
        </div>
        <nav aria-label={copy.footer.explore}>
          <ul className="site-footer__links">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
            <li>
              <Link href="/credits">{copy.nav.credits}</Link>
            </li>
          </ul>
        </nav>
        <div>
          <nav aria-label={copy.footer.farmers}>
            <ul className="site-footer__links">
              <li>
                <Link href="/join">{copy.footer.join}</Link>
              </li>
              <li>
                <Link href="/dashboard">{copy.footer.dashboard}</Link>
              </li>
            </ul>
          </nav>
          <nav aria-label={copy.footer.team}>
            <ul className="site-footer__links">
              <li>
                <Link href="/admin">{copy.footer.admin}</Link>
              </li>
            </ul>
          </nav>
        </div>
        <p className="site-footer__statement">{copy.transaction.statement}</p>
      </div>
    </Section>
  );
}
