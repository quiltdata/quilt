import * as qs from 'querystring'

const takeFirstValues = (q: qs.ParsedUrlQuery) =>
  Object.fromEntries(Object.entries(q).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]))

function parseSearch(search: string, firstOnly?: false): qs.ParsedUrlQuery
function parseSearch(search: string, firstOnly: true): Record<string, string | undefined>
function parseSearch(search: string, firstOnly: boolean = false) {
  const parsed = qs.parse(search.replace(/^\?/, ''))
  return firstOnly ? takeFirstValues(parsed) : parsed
}

export default parseSearch
