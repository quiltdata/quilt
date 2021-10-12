import * as React from 'react'
import * as M from '@material-ui/core'

import img2x from 'utils/img2x'
import Bar from 'website/components/Bar'
import Section from 'website/components/Section'

import flying from './flying.png'
import flying2x from './flying@2x.png'
import backlight from './backlight.png'

interface LedeProps {
  heading: React.ReactNode
  detail: React.ReactNode
  cta?: React.ReactNode
  link?: React.ReactNode
  variant?: 'left' | 'center' | 'flying'
}

const useStyles = M.makeStyles((t) => ({
  flying: {
    position: 'absolute',
    [t.breakpoints.down('sm')]: {
      display: 'none',
    },
    [t.breakpoints.up('md')]: {
      right: 'calc(34vw - 535px)',
      top: 32,
      width: 862,
    },
    [t.breakpoints.up('lg')]: {
      right: -100,
    },
    '& img': {
      position: 'relative',
      width: '100%',
    },
    '&::before': {
      background: `center / contain no-repeat url(${backlight})`,
      content: '""',
      left: '-48%',
      paddingTop: `${(1432 / 862) * 100}%`,
      position: 'absolute',
      top: '-43%',
      width: `${(1605 / 862) * 100}%`,
    },
  },
}))

export default function Lede({
  heading,
  detail,
  cta,
  link,
  variant = 'left',
  children,
}: React.PropsWithChildren<LedeProps>) {
  const classes = useStyles()
  const align = variant === 'center' ? 'center' : undefined
  return (
    <Section>
      {variant === 'flying' && (
        <div className={classes.flying}>
          <img src={img2x(flying, flying2x)} alt="" />
        </div>
      )}
      <M.Box
        position="relative"
        display="flex"
        flexDirection="column"
        alignItems={{ sm: align }}
        pt={8}
        pb={5}
      >
        <Bar color="primary" />
        <M.Box pt={5} textAlign={{ sm: align }}>
          <M.Typography variant="h1" color="textPrimary">
            {heading}
          </M.Typography>
        </M.Box>
        <M.Box pt={3} pb={3} textAlign={{ sm: align }} maxWidth="35rem">
          <M.Typography variant="body1" color="textSecondary">
            {detail}
          </M.Typography>
        </M.Box>
        {!!cta && <M.Box mt={2}>{cta}</M.Box>}
        {!!link && <M.Box mt={3}>{link}</M.Box>}
      </M.Box>
      {children}
    </Section>
  )
}
