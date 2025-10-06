import * as React from 'react'
import * as M from '@material-ui/core'

import quratorIcon from './qurator-icon.png'

interface QuratorIconProps {
  className?: string
  fontSize?: 'small' | 'default' | 'large'
  style?: React.CSSProperties
}

const useStyles = M.makeStyles(() => ({
  icon: {
    width: '24px',
    height: '24px',
    display: 'inline-block',
    backgroundImage: `url(${quratorIcon})`,
    backgroundSize: 'contain',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
  },
  small: {
    width: '20px',
    height: '20px',
  },
  large: {
    width: '32px',
    height: '32px',
  },
}))

export default function QuratorIcon({
  className,
  fontSize = 'default',
  style,
}: QuratorIconProps) {
  const classes = useStyles()

  return (
    <div
      className={`${classes.icon} ${fontSize === 'small' ? classes.small : ''} ${fontSize === 'large' ? classes.large : ''} ${className || ''}`}
      style={style}
    />
  )
}
