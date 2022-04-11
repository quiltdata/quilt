import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Model from 'model'

interface AvatarProps {
  className: string
  email: string
  index: number
}

const useAvatarStyles = M.makeStyles((t) => ({
  root: ({ index }: { index: number }) => {
    const backgroundColor = index % 2 ? t.palette.info.main : t.palette.info.light
    const color = backgroundColor ? t.palette.getContrastText(backgroundColor) : undefined
    return {
      backgroundColor,
      color,
      fontSize: '13px',
      height: '24px',
      textTransform: 'uppercase',
      width: '24px',
    }
  },
}))

function Avatar({ className, email, index }: AvatarProps) {
  const classes = useAvatarStyles({ index })
  const title =
    email === '?'
      ? 'User with a role not managed by Quilt who can potentially access this bucket'
      : email
  return (
    <M.Tooltip title={title}>
      <M.Avatar className={cx(classes.root, className)}>{email.substring(0, 2)}</M.Avatar>
    </M.Tooltip>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    cursor: 'pointer',
    display: 'flex',
    height: '36px',
    position: 'relative',
  },
  more: {
    color: t.palette.common.white,
    // NOTE: base background color should be the same as NavBar bg
    background:
      'linear-gradient(to left, rgba(42,25,105, 0) 0, #2a2d69 32px, #2a2d69 100%)', // should be the same as NavBar bg
    lineHeight: '36px',
    marginLeft: '12px',
    padding: '0 16px 0 0',
    position: 'relative',
    transition: 'margin 0.3s ease',
  },
  userpic: {
    marginTop: '6px',
  },
  avatarWrapper: {
    display: 'flex',
    flexDirection: 'row-reverse', // workaround for z-index
    transition: 'margin 0.3s ease',
    '& &': {
      margin: '0 0 0 -8px',
    },
    '&:hover &': {
      margin: '0 0 0 2px',
    },
    '&:hover $more': {
      marginLeft: '4px',
    },
  },
}))

interface AvatarsProps {
  className?: string
  collaborators: Model.Collaborators
  onClick: () => void
}

export default function Avatars({ className, collaborators, onClick }: AvatarsProps) {
  const knownCollaborators = collaborators.filter(
    ({ permissionLevel }) => !!permissionLevel,
  )
  const potentialCollaborators = collaborators.filter(
    ({ permissionLevel }) => !permissionLevel,
  )
  const hasUnmanagedRole = !!potentialCollaborators.length

  const avatars = React.useMemo(() => {
    if (!potentialCollaborators.length) return knownCollaborators.slice(0, 5)
    return [potentialCollaborators[0], ...knownCollaborators.slice(0, 4)]
  }, [knownCollaborators, potentialCollaborators])
  const avatarsLength = avatars.length

  const classes = useStyles()
  const more = React.useMemo(() => {
    const num = collaborators.length - avatarsLength
    return hasUnmanagedRole ? `${num}+ more` : `${num} more`
  }, [avatarsLength, collaborators, hasUnmanagedRole])

  return (
    <div className={cx(classes.root, className)} onClick={onClick}>
      {avatars.reduce(
        (memo, { collaborator: { email }, permissionLevel }, index) => (
          <div className={classes.avatarWrapper}>
            {memo}
            <Avatar
              key={`${email}_${index}`}
              className={classes.userpic}
              email={permissionLevel ? email : '?'}
              index={index}
            />
          </div>
        ),
        <>
          {collaborators.length > avatarsLength && (
            <div className={classes.avatarWrapper}>
              <M.Tooltip title="Click to see more collaborators">
                <span className={classes.more}>{more}</span>
              </M.Tooltip>
            </div>
          )}
        </>,
      )}
    </div>
  )
}
