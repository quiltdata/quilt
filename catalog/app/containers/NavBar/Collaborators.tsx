import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import { Avatars, Popup } from 'components/Collaborators'
import * as style from 'constants/style'
import * as Model from 'model'

function stringToColor(str: string): string {
  let hash = 0
  let i

  /* eslint-disable no-bitwise */
  for (i = 0; i < str.length; i += 1) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }

  let color = '#'

  for (i = 0; i < 3; i += 1) {
    const value = (hash >> (i * 8)) & 0xff
    color += `00${value.toString(16)}`.substr(-2)
  }
  /* eslint-enable no-bitwise */

  return color
}

interface AvatarProps {
  avatarsLength: number
  children?: React.ReactNode
  className?: string
  email?: string
  hover: boolean
  index: number
}

const useAvatarStyles = M.makeStyles((t) => ({
  root: ({ email, hover, index, avatarsLength }: AvatarProps) => {
    const backgroundColor = email ? stringToColor(email) : undefined
    const color = backgroundColor ? t.palette.getContrastText(backgroundColor) : undefined
    return {
      backgroundColor,
      fontSize: '13px',
      color,
      transform: `translateX(${
        hover ? `${(index + 1) * 2}px` : `-${(index + 1) * 12}px`
      })`,
      transition: 'transform 0.3s ease',
      zIndex: (avatarsLength - index) * 10,
    }
  },
}))

function Avatar({ className, children, email, ...props }: AvatarProps) {
  const classes = useAvatarStyles({ email, ...props })
  return (
    <M.Tooltip title={email || 'Click to show more collaborators'}>
      {email ? (
        <M.Avatar className={cx(classes.root, className)}>
          {email.substring(0, 2)}
        </M.Avatar>
      ) : (
        <span className={cx(classes.root, className)}>{children}</span>
      )}
    </M.Tooltip>
  )
}

const useStyles = M.makeStyles((t) => ({
  avatars: {
    marginLeft: t.spacing(2),
    transition: 'opacity 0.3s ease',
  },
  hidden: {
    opacity: 0,
  },
}))

interface CollaboratorsProps {
  hidden: boolean
  collaborators: Model.GQLTypes.CollaboratorBucketConnection[]
}

export default function Collaborators({ collaborators, hidden }: CollaboratorsProps) {
  const classes = useStyles()
  const [open, setOpen] = React.useState(false)
  const handleOpen = React.useCallback(() => setOpen(true), [setOpen])
  const handleClose = React.useCallback(() => setOpen(false), [setOpen])
  return (
    <M.MuiThemeProvider theme={style.appTheme}>
      <Popup open={open} onClose={handleClose} collaborators={collaborators} />
      <Avatars
        onClick={handleOpen}
        className={cx(classes.avatars, { [classes.hidden]: hidden })}
        collaborators={collaborators}
      />
    </M.MuiThemeProvider>
  )
}
