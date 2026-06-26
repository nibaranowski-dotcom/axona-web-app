/** Cursor-based pagination helpers used by every list endpoint (build-spec §6). */

export interface PageArgs {
  cursor?: string | null;
  take?: number;
}

const MAX_TAKE = 200;
const DEFAULT_TAKE = 50;

/** Build the cursor args. Always over-fetch by 1 to detect a next page. */
export function paginateArgs({ cursor, take = DEFAULT_TAKE }: PageArgs) {
  const t = Math.min(Math.max(take, 1), MAX_TAKE);
  return {
    take: t + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  };
}

/** Split over-fetched rows into the page + the next cursor. */
export function pageResult<T extends { id: string }>(
  rows: T[],
  take = DEFAULT_TAKE,
): { items: T[]; nextCursor: string | null } {
  const t = Math.min(Math.max(take, 1), MAX_TAKE);
  const hasMore = rows.length > t;
  const items = hasMore ? rows.slice(0, t) : rows;
  return {
    items,
    nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
  };
}
