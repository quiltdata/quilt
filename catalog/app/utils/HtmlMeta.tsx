import * as React from 'react'
import { Helmet } from 'react-helmet'

const BASE = 'Quilt is a versioned data portal for AWS'

const DIVIDER = ' • '

interface MetaTitleProps {
  children?: string | string[]
  base?: string
}

export function getTitleSegments(base: string, children?: string | string[]) {
  if (!children) return [base]

  if (Array.isArray(children)) return [...children, base]

  return [children, base]
}

export function getTitle(base: string, children?: string | string[]) {
  return getTitleSegments(base, children).join(DIVIDER)
}

export function Meta({ children, base = BASE }: MetaTitleProps) {
  return <title>{getTitle(base, children)}</title>
}

export default function MetaTitle({ children, base }: MetaTitleProps) {
  return (
    <Helmet>
      <Meta base={base}>{children}</Meta>
    </Helmet>
  )
}
