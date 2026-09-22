// The catalog is deployed once per stack, so an absolute host on a bucket path
// is another deployment's data, not a deliberate cross-stack link.
// ponytail: `/b/` only -- `/search`, `/install`, `/` collide with ordinary
// sites the assistant cites. Other catalog routes stay relative via the prompt
// rule in GlobalContext/navigation.
const BUCKET_PATH = /^\/b\/[^/]/

/** Strip a foreign http(s) origin off a catalog bucket link; all else passes through. */
export function toCurrentStack(href: string, origin: string): string {
  let url: URL
  try {
    url = new URL(href, origin)
  } catch {
    return href
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return href
  if (url.origin === origin || !BUCKET_PATH.test(url.pathname)) return href
  return `${url.pathname}${url.search}${url.hash}`
}
