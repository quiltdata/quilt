// The catalog is deployed once per stack, so an absolute host on a bucket this
// stack serves is another deployment's copy, not a deliberate cross-stack link.
// ponytail: bucket routes only; other catalog routes rely on the prompt rule in
// GlobalContext/navigation.
const BUCKET_PATH = /^\/b\/([^/]+)/

// An S3 object key may itself begin with `b/`, so a presigned or direct S3 URL
// can look like a catalog bucket route. Dropping its host voids the signature
// and leaves a dead link, so AWS hosts and signed URLs are never rewritten.
const AWS_HOST = /(^|\.)amazonaws\.com(\.cn)?$/
// Compared lowercased: a non-AWS signer may spell the parameter `signature`,
// and `searchParams.has` would miss it.
const SIGNATURE_PARAMS = ['x-amz-signature', 'signature']
const isSigned = (url: URL) =>
  Array.from(url.searchParams.keys()).some((k) =>
    SIGNATURE_PARAMS.includes(k.toLowerCase()),
  )

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
  if (AWS_HOST.test(url.hostname)) return href
  if (isSigned(url)) return href
  const bucket = url.pathname.match(BUCKET_PATH)?.[1]
  if (!bucket || !isInStack(decodeBucket(bucket))) return href
  return `${url.pathname}${url.search}${url.hash}`
}

// Markdown's handleLink drops the href when a link processor throws, so a
// malformed escape would cost the user a working link.
function decodeBucket(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}
