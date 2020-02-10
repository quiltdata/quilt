import cx from 'classnames'
import * as React from 'react'
import GHButton from 'react-github-btn'
import * as M from '@material-ui/core'

import * as URLS from 'constants/urls'
import img2x from 'utils/img2x'
import scrollIntoView from 'utils/scrollIntoView'

import art from './art.png'
import art2x from './art@2x.png'
import backlight from './backlight.png'

const usePanelStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    background: '#33346e',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    marginBottom: t.spacing(3),
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  text: {
    alignItems: 'center',
    color: t.palette.common.white,
    display: 'flex',
    fontSize: '1.75rem',
    fontWeight: t.typography.fontWeightBold,
    height: 150,
    lineHeight: 2 / 1.75,
    textAlign: 'center',
    [t.breakpoints.only('sm')]: {
      fontSize: '1.25rem',
      lineHeight: 2 / 1.25,
    },
  },
  extra: {
    bottom: 30,
    position: 'absolute',
  },
  line: {
    height: 10,
    width: '100%',
  },
  primary: {
    background: 'linear-gradient(to right, #c47e70, #efcda3, #c47e70)',
  },
  secondary: {
    background: 'linear-gradient(to right, #4142ad, #946add, #4142ad)',
  },
  tertiary: {
    background: 'linear-gradient(to right, #236f9a, #77caab, #236f9a)',
  },
}))

function Panel({ color, extra, children }) {
  const classes = usePanelStyles()
  return (
    <div className={classes.root}>
      <div className={classes.text}>{children}</div>
      {!!extra && <div className={classes.extra}>{extra}</div>}
      <div className={cx(classes.line, classes[color])} />
    </div>
  )
}

const Link = ({ children, ...props }) => (
  <M.Link color="textPrimary" underline="none" variant="body1" {...props}>
    {children}
    <M.Icon color="primary" style={{ verticalAlign: 'middle' }}>
      chevron_right
    </M.Icon>
  </M.Link>
)

const useStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gridTemplateRows: 'auto',
    gridColumnGap: t.spacing(5),
    [t.breakpoints.down('xs')]: {
      gridRowGap: t.spacing(8),
      gridTemplateColumns: 'auto',
      gridTemplateRows: 'auto auto auto',
    },
  },
  col: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
  },
  art: {
    flexShrink: 0,
    position: 'relative',
    height: 410,
    width: 380,
    [t.breakpoints.down('xs')]: {
      maxWidth: 380,
      width: '100%',
    },
    '& img': {
      position: 'relative',
      width: '100%',
    },
    '&::before': {
      background: `center / cover url(${backlight})`,
      content: '""',
      height: `${(501 / 410) * 100}%`,
      position: 'absolute',
      right: '-22%',
      top: '-11%',
      width: `${(719 / 380) * 100}%`,
    },
  },
  getNotified: {
    maxWidth: 660,
    position: 'relative',
    [t.breakpoints.up('sm')]: {
      marginLeft: t.spacing(7),
    },
    [t.breakpoints.down('xs')]: {
      marginTop: t.spacing(8),
    },
  },
}))

export default function Contribute() {
  const classes = useStyles()
  return (
    <M.Container
      maxWidth="lg"
      className={classes.root}
      id="contribute"
      ref={scrollIntoView()}
    >
      <M.Box pt={12} pb={6}>
        <M.Typography variant="h1" color="textPrimary" align="center">
          Contribute to Quilt
        </M.Typography>
        <M.Box mt={1} />
        <M.Typography variant="body1" color="textSecondary" align="center">
          There are three ways that you can contribute to Quilt
        </M.Typography>
      </M.Box>
      <div className={classes.grid}>
        <div className={classes.col}>
          <Panel color="tertiary">Curate open data</Panel>
          <Link href={URLS.curate}>Apply now</Link>
        </div>
        <div className={classes.col}>
          <Panel
            color="primary"
            extra={
              <GHButton href={URLS.gitWeb} data-show-count>
                Star
              </GHButton>
            }
          >
            Write code
          </Panel>
          <Link href={URLS.gitWeb}>View on GitHub</Link>
        </div>
        <div className={classes.col}>
          <Panel color="secondary">Run a private Quilt</Panel>
          <Link href="https://quiltdata.com">Learn more</Link>
        </div>
      </div>
      <M.Box
        display="flex"
        pt={10}
        pb={13}
        flexDirection={{ xs: 'column', sm: 'row' }}
        alignItems="center"
        justifyContent="space-between"
      >
        <div className={classes.art}>
          <img src={img2x(art, art2x)} alt="" />
        </div>
        <div className={classes.getNotified}>
          <M.Typography
            variant="h2"
            color="textPrimary"
            id="get-notified"
            ref={scrollIntoView()}
          >
            Get notified
          </M.Typography>
          <M.Box pt={4} />
          <M.Typography variant="body1" color="textSecondary">
            Quilt is evolving. Join the{' '}
            <M.Link color="secondary" underline="always" href={URLS.mailingListGeneral}>
              <b>general mailing list</b>
            </M.Link>
            {' or '}
            <M.Link color="secondary" underline="always" href={URLS.slackInvite}>
              <b>Slack channel</b>
            </M.Link>{' '}
            to discuss new features, ask questions, and stay in the loop.
          </M.Typography>
        </div>
      </M.Box>
    </M.Container>
  )
}
