/**
 * The slice of `bun:test` this suite uses.
 *
 * Declared here rather than pulled in as `@types/bun`, because the tests need
 * six matchers and the package would put a whole runtime's typings — and a
 * lockfile change — into a project that has none of it otherwise.
 */
declare module "bun:test" {
  export function describe(label: string, fn: () => void): void;
  export function test(label: string, fn: () => void | Promise<void>): void;

  type Matchers = {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeCloseTo(expected: number, digits?: number): void;
    toBeGreaterThan(expected: number): void;
    toBeGreaterThanOrEqual(expected: number): void;
    toBeLessThan(expected: number): void;
    toBeLessThanOrEqual(expected: number): void;
    toContain(expected: unknown): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeUndefined(): void;
    toMatch(expected: string | RegExp): void;
  };

  export function expect(value: unknown): Matchers;
}
