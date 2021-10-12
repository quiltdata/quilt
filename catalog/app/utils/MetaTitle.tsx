import * as React from 'react'
import { Helmet } from 'react-helmet'

const BASE = 'Quilt is a versioned data hub for AWS'

const DIVIDER = ' • '

interface MetaTitleProps {
  children?: string | string[]
  base?: string
}

function getTitleSegments(base: string, children?: string | string[]) {
  if (!children) return [base]

  if (Array.isArray(children)) return [...children, base]

  return [children, base]
}

export function getTitle(base: string, children?: string | string[]) {
  return getTitleSegments(base, children).join(DIVIDER)
}

export default function MetaTitle({ children, base = BASE }: MetaTitleProps) {
  return (
    <Helmet>
      <title>{getTitle(base, children)}</title>
    </Helmet>
  )
}
