import * as R from 'ramda'
import React from 'react'

export function printObject(obj: unknown) {
  return JSON.stringify(obj, null, '  ')
}

const suffixes = ['', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y']

const splitNumber = (n: number) => {
  const exp = n === 0 ? 0 : Math.log10(n)
  const index = Math.min(Math.floor(exp / 3), suffixes.length - 1)
  const coeff = (n / 10 ** (index * 3)).toFixed(1)
  return [coeff, suffixes[index]]
}

const numberFormat = new Intl.NumberFormat('en-US')

interface FormatQuantityOptions {
  fallback?: React.ReactNode | ((q: any) => React.ReactNode)
  renderValue?: (v: string) => React.ReactNode
  renderSuffix?: (s: string) => React.ReactNode
  Component?: React.ElementType
}

export function formatQuantity(
  q?: number | null,
  {
    fallback,
    renderValue = R.identity,
    renderSuffix = R.identity,
    Component = React.Fragment,
  }: FormatQuantityOptions = {},
) {
  if (!Number.isInteger(q)) {
    return typeof fallback === 'function' ? fallback(q) : fallback
  }
  const [coeff, suffix] = splitNumber(q as number)
  return (
    <Component>
      {renderValue(numberFormat.format(Number(coeff)).toString())}
      {renderSuffix(suffix)}
    </Component>
  )
}

export const mkFormatQuantity = (opts: FormatQuantityOptions) => (q?: number | null) =>
  formatQuantity(q, opts)

export const readableQuantity = mkFormatQuantity({ fallback: '?', Component: 'span' })

export const readableBytes = (bytes?: number | null, extra?: React.ReactNode) =>
  formatQuantity(bytes, {
    fallback: '?',
    renderSuffix: (suffix) => (
      <>
        {extra} & nbsp;{suffix}B
      </>
    ),
    Component: 'span',
  })

export const trimCenter = (str: string, maxLength: number) => {
  if (str.length <= maxLength) return str
  const divider = ' … '
  const to = (maxLength - divider.length) / 2
  const from = str.length - (maxLength - divider.length) / 2
  return str.substring(0, to) + divider + str.substring(from, str.length)
}
