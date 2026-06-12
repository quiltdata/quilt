import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

const useStyles = M.makeStyles((t) => ({
  root: {
    borderRadius: '50%',
    height: t.spacing(4),
    width: t.spacing(4),
  },
  // the stub artwork is an inscribed circle, so only custom icons need cropping
  crop: {
    objectFit: 'cover',
  },
  disc: {
    color: t.palette.common.white,
  },
  ring: {
    color: t.palette.grey.A100,
  },
  glyph: {
    color: t.palette.grey[700],
  },
  contrast: {
    '& $disc': {
      color: 'transparent',
    },
    '& $ring, & $glyph': {
      color: fade(t.palette.grey.A100, 0.5),
    },
  },
}))

interface BucketIconProps {
  // only applies to custom icons, the stub ignores it
  alt?: string
  className?: string
  classes?: {
    custom?: string
    stub?: string
  }
  src?: string
  title?: string
}

export default function BucketIcon({
  alt = '',
  className: optClassName,
  classes: optClasses,
  src,
  title,
}: BucketIconProps) {
  const classes = useStyles()
  // in dark themes the stub switches to contrast colors
  const dark = M.useTheme().palette.type === 'dark'

  if (src) {
    return (
      <img
        alt={alt}
        className={cx(classes.root, classes.crop, optClasses?.custom, optClassName)}
        src={src}
        title={title}
      />
    )
  }

  return (
    <M.SvgIcon
      className={cx(
        classes.root,
        dark && classes.contrast,
        optClasses?.stub,
        optClassName,
      )}
      titleAccess={title}
      viewBox="0 0 149 149"
    >
      <circle className={classes.disc} cx="74.5" cy="74.5" r="71" fill="currentColor" />
      <path
        className={classes.ring}
        fill="currentColor"
        d="M74.5 149C33.4 149 0 115.6 0 74.5S33.4 0 74.5 0 149 33.4 149 74.5 115.6 149 74.5 149zm0-142C37.3 7 7 37.3 7 74.5S37.3 142 74.5 142 142 111.7 142 74.5 111.8 7 74.5 7z"
      />
      <path
        className={classes.glyph}
        fill="currentColor"
        d="m112 85-5.3-3.8 4.4-35.9c.1-1.1-.2-2.3-1-3.1-.8-.9-1.8-1.3-3-1.3H42.8c-1.1 0-2.2.5-3 1.3-.8.9-1.1 2-1 3.1l7.7 63.4c.2 2 1.9 3.5 4 3.5h48.8c2 0 3.7-1.5 4-3.5l2.2-18.4 1.8 1.3c.7.5 1.5.7 2.3.7 1.2 0 2.5-.6 3.3-1.7 1.3-1.9.9-4.4-.9-5.6zm-16.2 19.2H54.1l-6.7-55.4h55.3l-3.3 27.1-17.3-12.2v-.1c0-4.1-3.3-7.4-7.4-7.4s-7.4 3.3-7.4 7.4 3.3 7.4 7.4 7.4c1.1 0 2-.2 3-.6L98.1 85l-2.3 19.2z"
      />
    </M.SvgIcon>
  )
}
