/**
 * The catalog is deployed once per stack, and nothing in the chat pipeline binds
 * a link to the stack that produced it: the model writes hrefs from memory, and
 * MCP tool results carry URLs built against whatever deployment answered. So an
 * absolute host on a bucket path is the wrong stack, not a deliberate
 * cross-stack link -- following it hands the user another deployment's data.
 * Dropping the origin makes the link same-origin.
 */

// ponytail: `/b/` only. It is the one path namespace no non-Quilt host the
// assistant cites shares; `/search`, `/install` and `/` collide with ordinary
// sites, so rewriting those would break real external links. Those stay
// relative via the prompt rule in GlobalContext/navigation.
const BUCKET_PATH = /^\/b\/[^/]/

/**
 * Strip a foreign origin off a catalog bucket link. Same-origin links,
 * non-catalog links and unparseable hrefs pass through untouched.
 */
export function toCurrentStack(href: string, origin: string): string {
  let url: URL
  try {
    url = new URL(href, origin)
  } catch {
    return href
  }
  if (url.origin === origin || !BUCKET_PATH.test(url.pathname)) return href
  return `${url.pathname}${url.search}${url.hash}`
}
