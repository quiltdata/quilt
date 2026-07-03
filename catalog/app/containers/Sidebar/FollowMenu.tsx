import * as React from 'react'
import * as M from '@material-ui/core'

import * as URLS from 'constants/urls'

import iconFacebook from 'components/Footer/icon-facebook.svg'
import iconGithub from 'components/Footer/icon-github.svg'
import iconInstagram from 'components/Footer/icon-instagram.svg'
import iconLinkedin from 'components/Footer/icon-linkedin.svg'
import iconSlack from 'components/Footer/icon-slack.svg'
import iconTwitter from 'components/Footer/icon-twitter.svg'

const LINKS = [
  { label: 'Blog', href: URLS.blog, icon: null },
  { label: 'X (Twitter)', href: URLS.twitter, icon: iconTwitter },
  { label: 'LinkedIn', href: URLS.linkedin, icon: iconLinkedin },
  { label: 'GitHub', href: URLS.gitWeb, icon: iconGithub },
  { label: 'Slack', href: URLS.slackInvite, icon: iconSlack },
  { label: 'Instagram', href: URLS.instagram, icon: iconInstagram },
  { label: 'Facebook', href: URLS.facebook, icon: iconFacebook },
]

const useStyles = M.makeStyles((t) => ({
  menuIcon: {
    minWidth: t.spacing(4.5),
  },
  brand: {
    display: 'block',
    height: 18,
    objectFit: 'contain',
    width: 18,
  },
}))

interface FollowMenuProps {
  iconClassName?: string
}

export default function FollowMenu({ iconClassName }: FollowMenuProps) {
  const classes = useStyles()
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)
  const open = React.useCallback(
    (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget),
    [],
  )
  const close = React.useCallback(() => setAnchorEl(null), [])

  return (
    <>
      <M.ListItem button onClick={open}>
        <M.ListItemIcon className={iconClassName}>
          <M.Icon>public</M.Icon>
        </M.ListItemIcon>
        <M.ListItemText primary="Follow" />
      </M.ListItem>
      <M.Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={close}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        getContentAnchorEl={null}
      >
        {LINKS.map(({ label, href, icon }) => (
          <M.MenuItem
            key={label}
            component="a"
            href={href}
            target="_blank"
            rel="noopener"
            onClick={close}
          >
            <M.ListItemIcon className={classes.menuIcon}>
              {icon ? (
                <img src={icon} alt="" className={classes.brand} />
              ) : (
                <M.Icon fontSize="small">rss_feed</M.Icon>
              )}
            </M.ListItemIcon>
            <M.ListItemText primary={label} />
          </M.MenuItem>
        ))}
      </M.Menu>
    </>
  )
}
