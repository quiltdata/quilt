import * as React from 'react'
import { Helmet } from 'react-helmet'

interface MetaTitleProps {
  subtitle?: string
}

function MetaTitle({ subtitle }: MetaTitleProps) {
  return (
    <Helmet>
      <title>
        {subtitle ? `${subtitle} • ` : ''}
        Quilt is a versioned data portal for AWS
      </title>
    </Helmet>
  )
}

interface SearchProps {
  query?: string
}

export function Search({ query }: SearchProps) {
  const subtitle = query || 'Search'
  return <MetaTitle subtitle={subtitle} />
}

export function UriResolver() {
  return <MetaTitle subtitle="Resolve a Quilt package URI" />
}
