'use client';

import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { ArrowUpRight } from '@phosphor-icons/react';

const URL_RE = /(https?:\/\/[^\s)]+)/g;
const SITE_HOSTS = new Set(['getmusoko.vercel.app', 'localhost:3000']);

/** A short human label for a link the guide gives, so answers never show raw URLs. */
function labelFor(url: URL): string {
  if (url.hostname.includes('google.') && url.pathname.includes('/maps')) return 'Open directions';
  const path = url.pathname;
  if (path.startsWith('/inquiry/new')) return 'Contact the farmer';
  if (path.startsWith('/farmers-markets')) return 'See farmers markets';
  if (path.startsWith('/farmers/')) return 'View farm profile';
  if (path === '/farmers') return 'See all farmers';
  if (path.startsWith('/food')) return 'Browse food';
  if (path.startsWith('/map')) return 'Open the map';
  if (path.startsWith('/join')) return 'Join as a farmer';
  return url.hostname.replace(/^www\./, '');
}

function LinkChip({ href }: { href: string }) {
  let url: URL;
  try {
    url = new URL(href.replace(/[.,;:]+$/, ''));
  } catch {
    return <>{href}</>;
  }
  const label = labelFor(url);
  if (SITE_HOSTS.has(url.host)) {
    return (
      <Link href={`${url.pathname}${url.search}${url.hash}`} className="guide-link">
        {label}
        <ArrowUpRight size={14} weight="bold" aria-hidden="true" />
      </Link>
    );
  }
  return (
    <a href={url.toString()} target="_blank" rel="noreferrer" className="guide-link">
      {label}
      <ArrowUpRight size={14} weight="bold" aria-hidden="true" />
    </a>
  );
}

/** Text with any URLs turned into labelled links. */
function Inline({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) =>
        URL_RE.test(part) ? <LinkChip key={i} href={part} /> : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  );
}

/**
 * The guide's plain-text answer, laid out: paragraphs, bullet lists from lines
 * starting with "- ", and links shown as labelled chips at the end of a line.
 */
export function GuideMessage({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, '').split('\n');
  let list: string[] = [];
  let para: string[] = [];
  const links: string[] = [];

  const flushPara = () => {
    if (para.length) blocks.push(<p key={`p${blocks.length}`}><Inline text={para.join(' ')} /></p>);
    para = [];
  };
  const flushList = () => {
    if (list.length) {
      blocks.push(
        <ul key={`u${blocks.length}`}>
          {list.map((item, i) => (
            <li key={i}>
              <Inline text={item} />
            </li>
          ))}
        </ul>,
      );
    }
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    // A line that is only a link becomes a chip in the row at the bottom.
    if (/^https?:\/\/\S+$/.test(line)) {
      links.push(line);
      continue;
    }
    const bullet = line.match(/^[-•*]\s+(.*)$/);
    if (bullet) {
      flushPara();
      list.push(bullet[1]);
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();

  return (
    <div className="guide-message">
      {blocks}
      {links.length ? (
        <div className="guide-message__links">
          {[...new Set(links)].map((href) => (
            <LinkChip key={href} href={href} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
