/**
 * The canonical form of a handle, and the only form that reaches the database.
 * Case is not meaningful in a handle -- @Ada and @ada are one reader -- so it
 * is folded away on the way in, exactly as normalizeEmail does for addresses.
 */
export function normalizeHandle(handle: string): string {
  return handle.trim().toLowerCase();
}
