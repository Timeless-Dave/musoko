import type { ReactNode } from 'react';
import { CaretLeft } from '@phosphor-icons/react/ssr';
import { Button } from '../primitives/Button';

/**
 * Back link, title, lead, actions. There is no eyebrow prop on purpose:
 * a small uppercase label above a heading is a banned pattern.
 */
export function PageHeader({
  title,
  lead,
  back,
  actions,
}: {
  title: string;
  lead?: string;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      {back ? (
        <Button variant="link" href={back.href} className="page-header__back">
          <CaretLeft size={20} weight="bold" aria-hidden="true" />
          {back.label}
        </Button>
      ) : null}
      <h1 className="page-header__title">{title}</h1>
      {lead ? <p className="page-header__lead">{lead}</p> : null}
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}
