export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
