import cx from 'classnames'
import * as Eff from 'effect'
import * as React from 'react'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'
import AsyncResult from 'utils/AsyncResult'
import { readableBytes, readableQuantity } from 'utils/string'

import { ColorPool } from './ColorPool'

interface ExtData {
  ext: string
  bytes: number
  objects: number
}

export const MAX_EXTS = 7

// must have length >= MAX_EXTS
export const COLOR_MAP = [
  '#8ad3cb',
  '#d7ce69',
  '#bfbadb',
  '#f4806c',
  '#83b0d1',
  '#b2de67',
  '#bc81be',
  '#f0b5d3',
  '#7ba39f',
  '#9894ad',
  '#be7265',
  '#94ad6b',
]

const useObjectsByExtStyles = M.makeStyles((t) => ({
  root: {
    display: 'grid',
    gridAutoRows: 20,
    gridColumnGap: t.spacing(1),
    gridRowGap: t.spacing(0.25),
    gridTemplateAreas: `
      ". heading heading"
    `,
    gridTemplateColumns: 'minmax(30px, max-content) 1fr minmax(30px, max-content)',
    gridTemplateRows: 'auto',
    [t.breakpoints.down('sm')]: {
      gridTemplateAreas: `
        "heading heading heading"
      `,
    },
  },
  heading: {
    // Match the v2 SectionHeader title font (subtitle1 + medium weight).
    ...t.typography.subtitle1,
    fontWeight: t.typography.fontWeightMedium,
    gridArea: 'heading',
    marginBottom: t.spacing(1),
    [t.breakpoints.down('sm')]: {
      textAlign: 'center',
    },
  },
  ext: {
    color: t.palette.text.secondary,
    gridColumn: 1,
    fontSize: t.typography.overline.fontSize,
    fontWeight: t.typography.fontWeightMedium,
    letterSpacing: t.typography.subtitle2.letterSpacing,
    lineHeight: t.typography.pxToRem(20),
    textAlign: 'right',
  },
  count: {
    color: t.palette.text.secondary,
    gridColumn: 3,
    fontSize: t.typography.overline.fontSize,
    fontWeight: t.typography.fontWeightMedium,
    letterSpacing: t.typography.subtitle2.letterSpacing,
    lineHeight: t.typography.pxToRem(20),
  },
  bar: {
    background: t.palette.action.hover,
    gridColumn: 2,
  },
  gauge: {
    height: '100%',
    position: 'relative',
  },
  flip: {},
  size: {
    color: t.palette.common.white,
    fontSize: t.typography.overline.fontSize,
    fontWeight: t.typography.fontWeightMedium,
    letterSpacing: t.typography.subtitle2.letterSpacing,
    lineHeight: t.typography.pxToRem(20),
    position: 'absolute',
    right: t.spacing(1),
    '&$flip': {
      color: t.palette.text.hint,
      left: `calc(100% + ${t.spacing(1)}px)`,
      right: 'auto',
    },
  },
  skeleton: {
    gridColumn: '1 / span 3',
  },
  unavail: {
    ...t.typography.body2,
    alignItems: 'center',
    display: 'flex',
    gridColumn: '1 / span 3',
    gridRow: `2 / span ${MAX_EXTS}`,
    justifyContent: 'center',
  },
}))

interface ObjectsByExtProps extends M.BoxProps {
  data: $TSFixMe // AsyncResult<ExtData[]>
  colorPool: ColorPool
}

export default function ObjectsByExt({ data, colorPool, ...props }: ObjectsByExtProps) {
  const classes = useObjectsByExtStyles()
  return (
    <M.Box className={classes.root} {...props}>
      <div className={classes.heading}>Objects by file extension</div>
      {AsyncResult.case(
        {
          Ok: (exts: ExtData[]) => {
            const capped = exts.slice(0, MAX_EXTS)
            const maxBytes = capped.reduce((max, e) => Math.max(max, e.bytes), 0)
            const max = Math.log(maxBytes + 1)
            const scale = (x: number) => Math.log(x + 1) / max
            return capped.map(({ ext, bytes, objects }, i) => {
              const color = colorPool.get(ext)
              return (
                <React.Fragment key={`ext:${ext}`}>
                  <div className={classes.ext} style={{ gridRow: i + 2 }}>
                    {ext || 'other'}
                  </div>
                  <div className={classes.bar} style={{ gridRow: i + 2 }}>
                    <div
                      className={classes.gauge}
                      style={{
                        background: color,
                        width: `${scale(bytes) * 100}%`,
                      }}
                    >
                      <div
                        className={cx(classes.size, {
                          [classes.flip]: scale(bytes) < 0.3,
                        })}
                      >
                        {readableBytes(bytes)}
                      </div>
                    </div>
                  </div>
                  <div className={classes.count} style={{ gridRow: i + 2 }}>
                    {readableQuantity(objects)}
                  </div>
                </React.Fragment>
              )
            })
          },
          _: (r: $TSFixMe) => (
            <>
              {Eff.Array.makeBy(MAX_EXTS, (i) => (
                <Skeleton
                  key={`skeleton:${i}`}
                  className={classes.skeleton}
                  style={{ gridRow: i + 2 }}
                  animate={!AsyncResult.Err.is(r)}
                />
              ))}
              {AsyncResult.Err.is(r) && (
                <div className={classes.unavail}>Data unavailable</div>
              )}
            </>
          ),
        },
        data,
      )}
    </M.Box>
  )
}
