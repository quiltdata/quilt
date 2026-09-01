/* eslint-disable no-console */
// Dev-only registry proxy: lets the meta-sort catalog (Wave-2 `ordering`
// contract, quilt#5164) run against a stack whose registry still speaks the
// legacy SDL (pre enterprise#1114) -- e.g. nightly.
//
// What it does, per GraphQL request:
//   1. `sortable` (new field on PackageUserMetaFacet) is stripped from the
//      document and synthesized in the response: every facet except Text is
//      reported sortable. APPROXIMATION -- the real flag comes from the
//      registry's MNFST sort-locus rules.
//   2. `firstPage(ordering: PackageOrdering)` is rewritten to the legacy
//      `firstPage(order: SearchResultOrder)`: the union result wrapper is
//      unwrapped (the legacy concrete type name equals the new union arm name,
//      so `__typename` discrimination in the client keeps working), and the
//      ordering expression is mapped to the legacy enum. LOSSY -- the five
//      presets map faithfully; a user-meta (column) sort maps to BEST_MATCH,
//      so clicking a metadata column exercises the UI but the server cannot
//      actually reorder by it.
//
// Everything else (auth, REST, other GraphQL ops) passes through untouched.
//
// Usage:
//   node internals/dev/legacy-registry-shim.js [upstream] [port]
//   # then point static-dev/config.js registryUrl at http://localhost:5556

const http = require('http')

const { parse, print, visit } = require('graphql')

const UPSTREAM = process.argv[2] || 'https://nightly-registry.quilttest.com'
const PORT = Number(process.argv[3]) || 5556

// The same lossy preset map the catalog itself uses at the objects boundary
// (orderingToResultOrder in containers/Search/model.ts).
const ORDERING_TO_ENUM = {
  'sys:modified:desc': 'NEWEST',
  'sys:modified:asc': 'OLDEST',
  'sys:name:asc': 'LEX_ASC',
  'sys:name:desc': 'LEX_DESC',
}
const toEnum = (expr) => (expr && ORDERING_TO_ENUM[expr]) || 'BEST_MATCH'

// Document rewrite: new contract -> legacy contract.
function transformQuery(query, variables) {
  if (!/sortable|ordering|PackageOrdering/.test(query)) return { query, variables }

  let vars = variables
  const ast = visit(parse(query), {
    // $ordering: PackageOrdering -> $order: SearchResultOrder
    VariableDefinition(node) {
      if (node.variable.name.value !== 'ordering') return undefined
      return {
        ...node,
        variable: { ...node.variable, name: { kind: 'Name', value: 'order' } },
        type: { kind: 'NamedType', name: { kind: 'Name', value: 'SearchResultOrder' } },
      }
    },
    Argument(node) {
      if (node.name.value !== 'ordering') return undefined
      const name = { kind: 'Name', value: 'order' }
      if (node.value.kind === 'Variable') {
        if (vars && 'ordering' in vars) {
          const { ordering, ...rest } = vars
          vars = { ...rest, order: toEnum(ordering) }
        }
        return {
          ...node,
          name,
          value: { kind: 'Variable', name: { kind: 'Name', value: 'order' } },
        }
      }
      // literal ordering expression (e.g. WorkflowPackages)
      const expr = node.value.kind === 'StringValue' ? node.value.value : null
      return { ...node, name, value: { kind: 'EnumValue', value: toEnum(expr) } }
    },
    Field: {
      leave(node) {
        // strip the new `sortable` facet field (synthesized in the response)
        if (node.name.value === 'sortable' && !node.selectionSet) return null
        // unwrap the union selection under firstPage: hoist the page arm's
        // fields, drop the error arms (legacy firstPage returns the page
        // type directly, under the same __typename)
        if (node.name.value === 'firstPage' && node.selectionSet) {
          const pageArm = node.selectionSet.selections.find(
            (s) =>
              s.kind === 'InlineFragment' &&
              s.typeCondition?.name.value === 'PackagesSearchResultSetPage',
          )
          if (!pageArm) return undefined
          const typename = node.selectionSet.selections.find(
            (s) => s.kind === 'Field' && s.name.value === '__typename',
          )
          return {
            ...node,
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                ...(typename ? [typename] : []),
                ...pageArm.selectionSet.selections.filter(
                  (s) => !(s.kind === 'Field' && s.name.value === '__typename'),
                ),
              ],
            },
          }
        }
        return undefined
      },
    },
  })
  return { query: print(ast), variables: vars }
}

// Response patch: synthesize `sortable` on every facet object.
function patchData(node) {
  if (Array.isArray(node)) {
    node.forEach(patchData)
  } else if (node && typeof node === 'object') {
    if (
      typeof node.__typename === 'string' &&
      node.__typename.endsWith('PackageUserMetaFacet')
    ) {
      node.sortable = node.__typename !== 'TextPackageUserMetaFacet'
    }
    Object.values(node).forEach(patchData)
  }
  return node
}

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })

const cors = (req) => ({
  'access-control-allow-origin': req.headers.origin || '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers':
    req.headers['access-control-request-headers'] || 'authorization,content-type',
  'access-control-max-age': '600',
})

http
  .createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors(req))
      res.end()
      return
    }
    try {
      let body = await readBody(req)
      const isGraphql = req.method === 'POST' && req.url.startsWith('/graphql')

      if (isGraphql && body.length) {
        try {
          const payload = JSON.parse(body.toString('utf8'))
          const before = payload.query
          const out = transformQuery(payload.query, payload.variables)
          if (out.query !== before) {
            console.log(`[shim] translated op (${new Date().toISOString()})`)
            body = Buffer.from(
              JSON.stringify({ ...payload, query: out.query, variables: out.variables }),
            )
          }
        } catch (e) {
          console.error('[shim] transform failed, passing through:', e.message)
        }
      }

      const headers = { ...req.headers }
      delete headers.host
      delete headers['content-length']
      headers['accept-encoding'] = 'identity' // keep responses patchable

      const upstream = await fetch(UPSTREAM + req.url, {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
        redirect: 'manual',
      })

      let respBody = Buffer.from(await upstream.arrayBuffer())
      const respHeaders = {}
      upstream.headers.forEach((v, k) => {
        if (
          !['content-length', 'content-encoding', 'transfer-encoding'].includes(k) &&
          !k.startsWith('access-control-')
        )
          respHeaders[k] = v
      })

      if (isGraphql && respBody.length) {
        try {
          const payload = JSON.parse(respBody.toString('utf8'))
          if (payload.data) patchData(payload.data)
          respBody = Buffer.from(JSON.stringify(payload))
        } catch {
          /* non-JSON graphql response: pass through */
        }
      }

      res.writeHead(upstream.status, { ...respHeaders, ...cors(req) })
      res.end(respBody)
    } catch (e) {
      console.error('[shim] proxy error:', e.message)
      res.writeHead(502, { 'content-type': 'application/json', ...cors(req) })
      res.end(JSON.stringify({ error: `shim proxy error: ${e.message}` }))
    }
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`[shim] legacy-registry shim on http://localhost:${PORT} -> ${UPSTREAM}`)
  })
