/** Active nav item without treating /farmers-markets as part of /farmers. */
export function isNavActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  if (href === '/farmers') {
    return pathname.startsWith('/farmers/') && !pathname.startsWith('/farmers-markets');
  }
  if (href === '/compare') return pathname.startsWith('/compare');
  return pathname.startsWith(`${href}/`);
}