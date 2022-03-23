import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

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
    const backgroundColor = !email
      ? undefined
      : index % 2
      ? t.palette.info.main
      : t.palette.info.light
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
  root: {
    display: 'flex',
    height: '24px',
    position: 'relative',
    cursor: 'pointer',
  },
  more: {
    position: 'relative',
    color: t.palette.common.white,
    lineHeight: '24px',
    marginLeft: t.spacing(0.5),
    background: '#2a2d69', // should be the same as NavBar bg
    padding: t.spacing(0, 2, 0, 0),
  },
  userpic: {
    height: '24px',
    position: 'relative',
    width: '24px',
    textTransform: 'uppercase',
  },
  icon: {
    backgroundColor: t.palette.info.main,
    fontSize: '16px',
    color: t.palette.common.white,
    zIndex: ({ avatarsLength }: { avatarsLength: number }) => (avatarsLength + 1) * 10,
  },
}))

interface AvatarsProps {
  className?: string
  collaborators: Model.GQLTypes.CollaboratorBucketConnection[]
  onClick: () => void
}

export default function Avatars({ className, collaborators, onClick }: AvatarsProps) {
  const avatars = collaborators.slice(0, 5)
  const avatarsLength = avatars.length

  const classes = useStyles({ avatarsLength })
  const [hover, setHover] = React.useState(false)
  return (
    <div
      className={cx(classes.root, className)}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <M.Avatar className={cx(classes.userpic, classes.icon)}>
        <M.Icon color="inherit" fontSize="inherit">
          visibility
        </M.Icon>
      </M.Avatar>
      {avatars.map(({ collaborator: { email } }, index) => (
        <Avatar
          className={classes.userpic}
          avatarsLength={avatarsLength}
          email={email}
          index={index}
          hover={hover}
        />
      ))}
      {collaborators.length > avatarsLength && (
        <Avatar
          className={classes.more}
          avatarsLength={avatarsLength}
          index={avatarsLength - 1}
          hover={hover}
        >
          {collaborators.length - avatarsLength} more
        </Avatar>
      )}
    </div>
  )
}
