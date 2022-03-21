import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

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
  className?: string
  email: string
  hover: boolean
  index: number
  usersLength: number
}

const useAvatarStyles = M.makeStyles((t) => ({
  root: ({ email, hover, index, usersLength }: AvatarProps) => {
    const backgroundColor = stringToColor(email)
    const color = t.palette.getContrastText(backgroundColor)
    return {
      backgroundColor,
      fontSize: '13px',
      color,
      textTransform: 'uppercase',
      transform: `translateX(${
        hover ? `${(index + 1) * 2}px` : `-${(index + 1) * 12}px`
      })`,
      transition: 'transform 0.3s ease',
      zIndex: (usersLength - index) * 10,
    }
  },
}))

function Avatar({ className, email, ...props }: AvatarProps) {
  const classes = useAvatarStyles({ email, ...props })
  return (
    <M.Avatar title={email} className={cx(classes.root, className)}>
      {email.substring(0, 2)}
    </M.Avatar>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    marginLeft: t.spacing(2),
    height: '24px',
    position: 'relative',
  },
  userpic: {
    height: '24px',
    position: 'relative',
    width: '24px',
  },
  icon: {
    backgroundColor: t.palette.secondary.main,
    fontSize: '16px',
    zIndex: 50,
  },
}))

export default function Collaborators() {
  const classes = useStyles()
  const users = [
    'fiskus@quiltdata.io',
    'nl0@quiltdata.io',
    'sergey@quiltdata.io',
    'aneesh@quiltdata.io',
  ]
  const [hover, setHover] = React.useState(false)
  return (
    <div
      className={classes.root}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <M.Avatar className={cx(classes.userpic, classes.icon)}>
        <M.Icon color="action" fontSize="inherit">
          visibility
        </M.Icon>
      </M.Avatar>
      {users.map((email, index) => (
        <Avatar
          className={classes.userpic}
          usersLength={users.length}
          email={email}
          index={index}
          hover={hover}
        />
      ))}
    </div>
  )
}
