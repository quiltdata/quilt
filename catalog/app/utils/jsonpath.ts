import { JSONPath } from 'jsonpath-plus'

// Thin wrapper around jsonpath-plus.
//
// jsonpath-plus is more permissive than the Goessner spec
// (https://goessner.net/articles/JsonPath/), so we add guards
// to reject expressions that the spec considers invalid.

export function parse(expr: string) {
  if (!expr) throw new SyntaxError(`Invalid JSONPath: ${expr}`)
  const parts = JSONPath.toPathArray(expr)
  if (parts[0] !== '$') throw new SyntaxError(`Invalid JSONPath: ${expr}`)
  return parts
}
