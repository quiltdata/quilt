import * as React from 'react'
import invariant from 'invariant'
import { useParams } from 'react-router-dom'

export interface BucketConfig {
  region?: string
}

export interface BucketContextValue {
  name: string
  config: BucketConfig
}

interface BucketContextProviderProps {
  bucket?: string
  config?: BucketConfig
  children: React.ReactNode
}

const Context = React.createContext<BucketContextValue | undefined>(undefined)

export function BucketContextProvider({
  bucket: bucketProp,
  config = {},
  children,
}: BucketContextProviderProps) {
  if (bucketProp) {
    return (
      <BucketContextValueProvider name={bucketProp} config={config}>
        {children}
      </BucketContextValueProvider>
    )
  }

  return (
    <BucketRouteContextProvider config={config}>{children}</BucketRouteContextProvider>
  )
}

function BucketRouteContextProvider({
  config,
  children,
}: Required<Pick<BucketContextProviderProps, 'config' | 'children'>>) {
  const { bucket: routeBucket } = useParams<{ bucket?: string }>()
  invariant(!!routeBucket, '`bucket` must be defined')

  return (
    <BucketContextValueProvider name={routeBucket} config={config}>
      {children}
    </BucketContextValueProvider>
  )
}

function BucketContextValueProvider({
  name,
  config,
  children,
}: BucketContextValue & { children: React.ReactNode }) {
  const value = React.useMemo(() => ({ name, config }), [name, config])

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useBucketContext() {
  const context = React.useContext(Context)
  if (!context)
    throw new Error('useBucketContext must be used inside BucketContextProvider')
  return context
}
