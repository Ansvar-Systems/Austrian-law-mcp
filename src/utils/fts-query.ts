/**
 * FTS5 query builder for Austrian Law MCP.
 *
 * Handles user input sanitization to prevent FTS5 syntax errors from
 * malformed queries (unbalanced quotes, invalid operators, etc.).
 */

const EXPLICIT_FTS_SYNTAX = /["""]|(\bAND\b)|(\bOR\b)|(\bNOT\b)|\*$/;

/**
 * Characters and patterns that are special in FTS5 query syntax.
 * These must be stripped when building sanitized token-based queries.
 */
const FTS5_SPECIAL_CHARS = /["""(){}^:+\-~]/g;

export interface FtsQueryVariants {
  primary: string;
  fallback?: string;
}

/**
 * Strip FTS5 special characters from a single token, keeping only
 * word characters, hyphens (already handled), and Unicode letters.
 */
function sanitizeToken(token: string): string {
  return token.replace(/[^\p{L}\p{N}_-]/gu, '');
}

/**
 * Build a safe fallback query from raw input by extracting and quoting tokens.
 * This is used when explicit-syntax input causes an FTS5 parse error.
 */
export function buildSanitizedFallback(query: string): string | null {
  const tokens = query
    .replace(FTS5_SPECIAL_CHARS, ' ')
    .split(/\s+/)
    .map(t => sanitizeToken(t))
    .filter(t => t.length > 0);

  if (tokens.length === 0) return null;
  return tokens.map(t => `"${t}"*`).join(' OR ');
}

export function buildFtsQueryVariants(query: string): FtsQueryVariants {
  const trimmed = query.trim();

  if (EXPLICIT_FTS_SYNTAX.test(trimmed)) {
    // User is using FTS5 syntax intentionally. Pass through as primary,
    // but provide a sanitized fallback in case the syntax is malformed.
    const fallback = buildSanitizedFallback(trimmed);
    return {
      primary: trimmed,
      ...(fallback && { fallback }),
    };
  }

  const tokens = trimmed
    .split(/\s+/)
    .filter(t => t.length > 0)
    .map(t => sanitizeToken(t))
    .filter(t => t.length > 0);

  if (tokens.length === 0) {
    return { primary: trimmed };
  }

  const primary = tokens.map(t => `"${t}"*`).join(' ');
  const fallback = tokens.map(t => `${t}*`).join(' OR ');

  return { primary, fallback };
}
