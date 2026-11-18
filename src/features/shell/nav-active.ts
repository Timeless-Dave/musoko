/** Active nav item without treating /farmers-markets as part of /farmers. */
export function isNavActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href.includes('#')) return false;
  if (href === '/') return pathname === '/';
  if (pathname === href) return true;
  if (href === '/farmers') {
    return pathname.startsWith('/farmers/') && !pathname.startsWith('/farmers-markets');
  }
  if (href === '/compare') return pathname.startsWith('/compare');
  if (href === '/admin') return pathname === '/admin' || pathname.startsWith('/admin/');
  if (href === '/dashboard') return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  return pathname.startsWith(`${href}/`);
}
