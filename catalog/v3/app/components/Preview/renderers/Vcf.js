import cx from 'classnames'
import * as React from 'react'
import { unstable_Box as Box } from '@material-ui/core/Box'
import Table from '@material-ui/core/Table'
import TableBody from '@material-ui/core/TableBody'
import TableCell from '@material-ui/core/TableCell'
import TableHead from '@material-ui/core/TableHead'
import TableRow from '@material-ui/core/TableRow'
import Typography from '@material-ui/core/Typography'
import { makeStyles } from '@material-ui/styles'

const useStyles = makeStyles((t) => ({
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
    height: t.spacing.unit * 3,
  },
  cell: {
    border: 'none',
    whiteSpace: 'nowrap',

    '&, &:last-child': {
      paddingLeft: t.spacing.unit * 2,
      paddingRight: 0,
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
    columnGap: t.spacing.unit * 2,
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: t.typography.pxToRem(12),
    maxHeight: 'calc(100vh - 5rem)',
    overflow: 'auto',
  },
}))

const Vcf = ({ meta, header, data, variants }) => {
  const classes = useStyles()

  const renderCell = (type, i = '') => (col, j) => (
    <TableCell
      // eslint-disable-next-line react/no-array-index-key
      key={`${type}:${i}:${j}`}
      className={cx(classes.cell, classes[type])}
    >
      {col}
    </TableCell>
  )

  return (
    <div className={classes.root}>
      <div className={classes.tableWrapper}>
        <Table className={classes.table}>
          <TableHead>
            {meta.map((l, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <TableRow key={`meta:${i}`} className={classes.row}>
                <TableCell
                  colSpan={header[0].length}
                  className={cx(classes.cell, classes.meta)}
                >
                  {l}
                </TableCell>
              </TableRow>
            ))}
          </TableHead>
        </Table>
      </div>
      <div className={classes.tableWrapper}>
        <Table className={classes.table}>
          <TableHead>
            <TableRow className={classes.row}>
              {header.map(renderCell('header'))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <TableRow key={`data:${i}`} className={classes.row}>
                {row.map(renderCell('data', i))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {!!variants.length && (
        <Box mt={2}>
          <Typography variant="h6" gutterBottom>
            Variants ({variants.length})
          </Typography>
          <div className={classes.variants}>{variants.join(' ')}</div>
        </Box>
      )}
    </div>
  )
}

export default (data, props) => <Vcf {...data} {...props} />
