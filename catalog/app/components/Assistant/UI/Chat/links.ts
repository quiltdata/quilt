// The catalog is deployed once per stack, so an absolute host on a bucket this
// stack serves is another deployment's copy, not a deliberate cross-stack link.
// ponytail: bucket routes only; other catalog routes rely on the prompt rule in
// GlobalContext/navigation.
const BUCKET_PATH = /^\/b\/([^/]+)/

/**
 * Strip a foreign http(s) origin off a link to a bucket this stack serves.
 * Everything else -- other hosts' `/b/` paths (Amazon and Blogger use them),
 * buckets absent here, other schemes, same-origin and relative hrefs -- is
 * passed through, so a working external link is never hijacked.
 */
export function toCurrentStack(
  href: string,
  origin: string,
  isInStack: (bucket: string) => boolean,
): string {
  let url: URL
  try {
    url = new URL(href, origin)
  } catch {
    return href
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return href
  if (url.origin === origin) return href
  const bucket = url.pathname.match(BUCKET_PATH)?.[1]
  if (!bucket || !isInStack(decodeURIComponent(bucket))) return href
  return `${url.pathname}${url.search}${url.hash}`
}
