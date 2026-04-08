import jsonpath from 'jsonpath'

export function parse(expr: string) {
  return jsonpath.parse(expr)
}
