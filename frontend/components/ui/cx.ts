/**
 * Joins class names, dropping falsy entries so conditional classes read cleanly:
 *   cx('base', isActive && 'active', className)
 *
 * Deliberately not `clsx` or `classnames`: this is the whole of what the primitives need,
 * and a dependency for eight lines would be hard to justify in a codebase that runs on ten
 * backend runtime dependencies after nine sprints.
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
