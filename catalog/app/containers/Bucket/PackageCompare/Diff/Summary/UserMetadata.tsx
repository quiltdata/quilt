import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'

import * as JSONPointer from 'utils/JSONPointer'
import assertNever from 'utils/assertNever'

import type { Change } from '../compareJsons'
import useColors from '../useColors'

interface MetaKeyProps {
  className: string
  change: Change
}

function MetaKey({ className, change }: MetaKeyProps) {
  const colors = useColors()
  const tooltip = React.useMemo(() => {
    switch (change._tag) {
      case 'modified':
        return `${JSON.stringify(change.oldValue)} → ${JSON.stringify(change.newValue)}`
      case 'added':
        return JSON.stringify(change.newValue)
      case 'removed':
        return JSON.stringify(change.oldValue)
      default:
        assertNever(change)
    }
  }, [change])
  return (
    <M.Tooltip title={tooltip}>
      <span className={className}>
        <span className={cx(colors[change._tag], colors.inline)}>
          {change.pointer.reduce(
            (memo, key, index) =>
              memo.length
                ? [
                    ...memo,
                    <Icons.ArrowRight key={`separator_${index}`} fontSize="inherit" />,
                    key,
                  ]
                : [key],
            [] as React.ReactNode[],
          )}
        </span>
      </span>
    </M.Tooltip>
  )
}

const useStyles = M.makeStyles((t) => ({
  keys: {
    display: 'inline-flex',
    flexWrap: 'wrap',
    gap: t.spacing(0.75),
  },
  key: {
    '&::after': {
      content: '", "',
    },
    '&:last-child::after': {
      content: '""',
    },
  },
}))

interface UserMetadataProps {
  changes: Change[]
}

export default function UserMetadata({ changes }: UserMetadataProps) {
  const classes = useStyles()
  return (
    <>
      Changed keys:{' '}
      <span className={classes.keys}>
        {changes.map((change) => (
          <MetaKey
            key={JSONPointer.stringify(change.pointer)}
            change={change}
            className={classes.key}
          />
        ))}
      </span>
    </>
  )
}
