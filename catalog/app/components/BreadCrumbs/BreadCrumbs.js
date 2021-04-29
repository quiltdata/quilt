import * as R from 'ramda'
import * as React from 'react'

import Link from 'utils/StyledLink'
import tagged from 'utils/tagged'

const EMPTY = <i>{'<EMPTY>'}</i>

export const Crumb = tagged([
  'Segment', // { label, to }
  'Sep', // value
])

export const Segment = ({ label, to, getLinkProps = R.identity }) =>
  to != null ? <Link {...getLinkProps({ to })}>{label || EMPTY}</Link> : label || EMPTY

export const render = (items, { getLinkProps = undefined } = {}) =>
  items.map(
    Crumb.case({
      Segment: (s, i) => (
        <Segment key={`${i}:${s.label}`} getLinkProps={getLinkProps} {...s} />
      ),
      Sep: (s, i) => <React.Fragment key={`__sep${i}`}>{s}</React.Fragment>,
    }),
  )

export function copyWithoutSpaces(e) {
  if (typeof document === 'undefined') return
  e.clipboardData.setData(
    'text/plain',
    document
      .getSelection()
      .toString()
      .replace('<EMPTY>', '')
      .replace('ROOT', '')
      .replace(/\s*\/\s*/g, '/'),
  )
  e.preventDefault()
}
