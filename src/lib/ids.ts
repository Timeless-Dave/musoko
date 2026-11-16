export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
export function newToken(): string {
  return crypto.randomUUID();
}
