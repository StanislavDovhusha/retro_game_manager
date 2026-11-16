/** Text of an unknown thrown value. */
export const toErrorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));
