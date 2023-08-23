import * as React from 'react'

import type * as Model from 'model'

export interface S3SummarizeHandle extends Model.S3.S3ObjectLocation {
  logicalKey?: string
}

export interface LogicalKeyResolver {
  (logicalKey: string): S3SummarizeHandle | Promise<S3SummarizeHandle>
}

const Ctx = React.createContext<LogicalKeyResolver | null>(null)

export function useLogicalKeyResolver() {
  return React.useContext(Ctx)
}

export const use = useLogicalKeyResolver

export const { Provider } = Ctx
