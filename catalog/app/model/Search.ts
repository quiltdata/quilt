import * as Types from 'utils/types'

// model of faceted search domain

export type FacetPath = readonly string[]

// eslint-disable-next-line @typescript-eslint/no-redeclare
function FacetPath(...segments: string[]): FacetPath {
  return segments
}

export function Predicate(op: string, arg: Types.Json) {
  return { op, arg }
}

interface WorkflowExtents {
  // TODO
}

interface NumberExtents {
  min: number
  max: number
}

interface DateExtents {
  min: number
  max: number
}

// TODO
export type FacetExtents = WorkflowExtents | NumberExtents | DateExtents
