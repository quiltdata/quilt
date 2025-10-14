import cx from 'classnames'
import * as React from 'react'

import useColors from '../useColors'

interface FromToProps {
  changes: [React.ReactNode, React.ReactNode]
}

export default function FromTo({ changes: [base, other] }: FromToProps) {
  const colors = useColors()
  return (
    <span>
      <span className={cx(colors.removed, colors.inline)}>{base}</span> →{' '}
      <span className={cx(colors.added, colors.inline)}>{other}</span>
    </span>
  )
}
