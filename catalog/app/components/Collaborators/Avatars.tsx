import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

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
    // NOTE: base background color should be the same as NavBar bg
    background: `linear-gradient(to left, ${fade(
      '#2a2d69',
      0,
    )} 0, #2a2d69 32px, #2a2d69 100%)`,
    cursor: 'pointer',
    display: 'flex',
    height: '36px',
    position: 'relative',
    zIndex: 1,
  },
  more: {
    color: t.palette.common.white,
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

  const avatars = React.useMemo(() => {
    if (!potentialCollaborators.length) return knownCollaborators.slice(0, 5)
    return [potentialCollaborators[0], ...knownCollaborators.slice(0, 4)]
  }, [knownCollaborators, potentialCollaborators])

  const classes = useStyles()
  const moreNum = React.useMemo(
    () => collaborators.length - avatars.length,
    [avatars, collaborators],
  )

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
          {moreNum > 0 && (
            <div className={classes.avatarWrapper}>
              <M.Tooltip title="Click to see more collaborators">
                <span className={classes.more}>{moreNum}+</span>
              </M.Tooltip>
            </div>
          )}
        </>,
      )}
    </div>
  )
}
