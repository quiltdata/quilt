import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Model from 'model'

interface AvatarProps {
  avatarsLength: number // TODO: Avatar shouldn't know about `avatarsLength`
  children?: React.ReactNode
  className?: string
  email?: string
  hover: boolean
  index: number // TODO: Avatar shouldn't know about `index`
}

const useAvatarStyles = M.makeStyles((t) => ({
  root: ({ email, hover, index, avatarsLength }: AvatarProps) => {
    // eslint-disable-next-line no-nested-ternary
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
    height: '36px',
    position: 'relative',
    cursor: 'pointer',
  },
  more: {
    position: 'relative',
    color: t.palette.common.white,
    lineHeight: '36px',
    marginLeft: '4px',
    // NOTE: base background color should be the same as NavBar bg
    background:
      'linear-gradient(to left, rgba(42,25,105, 0) 0, #2a2d69 32px, #2a2d69 100%)', // should be the same as NavBar bg
    padding: '0 16px 0 0',
  },
  userpic: {
    height: '24px',
    marginTop: '6px',
    position: 'relative',
    width: '24px',
    textTransform: 'uppercase',
  },
}))

interface AvatarsProps {
  className?: string
  collaborators: ReadonlyArray<Model.GQLTypes.CollaboratorBucketConnection>
  potentialCollaborators: ReadonlyArray<Model.GQLTypes.PotentialCollaboratorBucketConnection>
  onClick: () => void
}

export default function Avatars({
  className,
  collaborators,
  potentialCollaborators,
  onClick,
}: AvatarsProps) {
  const avatars = collaborators.slice(0, 5)
  const avatarsLength = avatars.length

  const classes = useStyles()
  const [hover, setHover] = React.useState(false)
  const more = React.useMemo(() => {
    const num = collaborators.length - avatarsLength
    return !!potentialCollaborators ? `${num}+ more` : `${num} more`
  }, [avatarsLength, collaborators, potentialCollaborators])

  const handleMouseEnter = React.useCallback(() => {
    if (avatarsLength > 1) setHover(true)
  }, [avatarsLength])
  const handleMouseLeave = React.useCallback(() => {
    if (avatarsLength > 1) setHover(false)
  }, [avatarsLength])

  return (
    <div
      className={cx(classes.root, className)}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {avatars.map(({ collaborator: { email } }, index) => (
        <Avatar
          key={`${email}_${index}`}
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
          {more}
        </Avatar>
      )}
    </div>
  )
}
