/** Active nav item without treating /farmers-markets as part of /farmers. */
export function isNavActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href.includes('#')) return false;
  if (href === '/') return pathname === '/';
  if (pathname === href) return true;
  if (href === '/farmers') {
    return pathname.startsWith('/farmers/') && !pathname.startsWith('/farmers-markets');
  }
  return pathname.startsWith(`${href}/`);
}
