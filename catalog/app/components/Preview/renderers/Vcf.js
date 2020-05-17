import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import { renderWarnings } from './util'

const useStyles = M.makeStyles((t) => ({
  root: {
    width: '100%',
  },
  tableWrapper: {
    overflow: 'auto',
  },
  table: {
    fontFamily: t.typography.monospace.fontFamily,
  },
  row: {
    height: t.spacing(3),
  },
  cell: {
    border: 'none',
    whiteSpace: 'nowrap',
    '&, &:last-child': {
      padding: [[0, 0, 0, t.spacing(2)]],
    },
    '&:first-child': {
      paddingLeft: 0,
    },
  },
  meta: {
    color: t.palette.text.secondary,
  },
  header: {
    color: t.palette.text.primary,
    fontWeight: 600,
  },
  variants: {
    columns: '4em',
    columnGap: t.spacing(2),
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: t.typography.pxToRem(12),
    maxHeight: 'calc(100vh - 5rem)',
    overflow: 'auto',
  },
}))

function Vcf({ meta, header, data, variants, note, warnings }) {
  const classes = useStyles()

  const renderCell = (type, i = '') => (col, j) => (
    <M.TableCell
      // eslint-disable-next-line react/no-array-index-key
      key={`${type}:${i}:${j}`}
      className={cx(classes.cell, classes[type])}
    >
      {col}
    </M.TableCell>
  )

  return (
    <div className={classes.root}>
      {renderWarnings(warnings)}
      <div className={classes.tableWrapper}>
        <M.Table className={classes.table}>
          <M.TableHead>
            {meta.map((l, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <M.TableRow key={`meta:${i}`} className={classes.row}>
                <M.TableCell
                  colSpan={header ? header[0].length : undefined}
                  className={cx(classes.cell, classes.meta)}
                >
                  {l}
                </M.TableCell>
              </M.TableRow>
            ))}
          </M.TableHead>
        </M.Table>
      </div>
      <div title={note} className={classes.tableWrapper}>
        <M.Table className={classes.table}>
          {!!header && (
            <M.TableHead>
              <M.TableRow className={classes.row}>
                {header.map(renderCell('header'))}
              </M.TableRow>
            </M.TableHead>
          )}
          <M.TableBody>
            {data.map((row, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <M.TableRow key={`data:${i}`} className={classes.row}>
                {row.map(renderCell('data', i))}
              </M.TableRow>
            ))}
          </M.TableBody>
        </M.Table>
      </div>
      {!!variants.length && (
        <M.Box mt={2}>
          <M.Typography variant="h6" gutterBottom>
            Variants ({variants.length})
          </M.Typography>
          <div className={classes.variants}>{variants.join(' ')}</div>
        </M.Box>
      )}
    </div>
  )
}

export default (data, props) => <Vcf {...data} {...props} />
