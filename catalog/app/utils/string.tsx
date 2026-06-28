/* String utils */
import * as R from 'ramda'
import * as React from 'react'

export function printObject(obj: unknown): string {
  return JSON.stringify(obj, null, '  ')
}

const defaultSuffixes = ['', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y']

const splitNumber = (n: number, suffixes: readonly string[]): [string, string] => {
  const exp = n === 0 ? 0 : Math.log10(n)
  const index = Math.min(Math.floor(exp / 3), suffixes.length - 1)
  const coeff = (n / 10 ** (index * 3)).toFixed(1)
  return [coeff, suffixes[index]]
}

const numberFormat = new Intl.NumberFormat('en-US')

export interface FormatQuantityOptions {
  fallback?: React.ReactNode | ((q: number) => React.ReactNode)
  renderValue?: (value: string) => React.ReactNode
  renderSuffix?: (suffix: string) => React.ReactNode
  Component?: React.ElementType
  suffixes?: readonly string[]
}

export function formatQuantity(
  q: number | null | undefined,
  {
    fallback,
    renderValue = R.identity,
    renderSuffix = R.identity,
    Component = React.Fragment,
    suffixes = defaultSuffixes,
  }: FormatQuantityOptions = {},
): React.ReactNode {
  // Tolerant by design: anything that isn't a finite integer (incl. null /
  // undefined / floats) renders the fallback. Callers rely on this for missing data.
  if (typeof q !== 'number' || !Number.isInteger(q)) {
    return typeof fallback === 'function' ? fallback(q as number) : fallback
  }
  const [coeff, suffix] = splitNumber(q, suffixes)
  return (
    <Component>
      {renderValue(numberFormat.format(Number(coeff)).toString())}
      {renderSuffix(suffix)}
    </Component>
  )
}

export const mkFormatQuantity =
  (opts?: FormatQuantityOptions) =>
  (q: number | null | undefined): React.ReactNode =>
    formatQuantity(q, opts)

export const readableQuantity = mkFormatQuantity({ fallback: '?', Component: 'span' })

export const readableBytes = (
  bytes: number | null | undefined,
  extra?: React.ReactNode,
): React.ReactNode =>
  formatQuantity(bytes, {
    fallback: '?',
    renderSuffix: (suffix: string) => (
      <>
        {extra}&nbsp;{suffix}B
      </>
    ),
    Component: 'span',
  })

export const trimCenter = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str
  const divider = ' … '
  const to = (maxLength - divider.length) / 2
  const from = str.length - (maxLength - divider.length) / 2
  return str.substring(0, to) + divider + str.substring(from, str.length)
}
