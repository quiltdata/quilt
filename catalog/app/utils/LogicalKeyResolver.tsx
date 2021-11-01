import * as React from 'react'

interface S3Handle {
  bucket: string
  key: string
  version?: string
}

export interface LogicalKeyResolver {
  (logicalKey: string): S3Handle | Promise<S3Handle>
}

const Ctx = React.createContext<LogicalKeyResolver | null>(null)

export function useLogicalKeyResolver() {
  return React.useContext(Ctx)
}

export const use = useLogicalKeyResolver

export const { Provider } = Ctx
