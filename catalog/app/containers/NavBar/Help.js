import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import StyledLink from 'utils/StyledLink'

const ES_V = '6.7'
const ES_REF = `https://www.elastic.co/guide/en/elasticsearch/reference/${ES_V}/query-dsl-query-string-query.html#query-string-syntax`

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: `0 ${t.spacing(4)}px`,
    overflowY: 'auto',

    [t.breakpoints.down('xs')]: {
      padding: `0 ${t.spacing(1)}px`,
    },
  },
  group: {
    marginTop: t.spacing(2),
  },
  headerLabel: {
    background: 'transparent !important',
  },
  item: {
    borderBottom: `1px solid ${t.palette.divider}`,

    '&:last-child': {
      border: 0,
    },
  },
  list: {
    marginBottom: t.spacing(1),
  },
  subList: {
    marginLeft: t.spacing(-1.5),
  },
}))

const syntaxHelpRows = [
  {
    namespace: 'Fields',
    rows: [
      {
        example: 'comment:TODO',
        syntax: 'comment:',
        title: 'Package comment',
      },
      {
        example: 'content:Hello',
        syntax: 'content:',
        title: 'Object content',
      },
      {
        example: 'ext:*.fastq.gz',
        syntax: 'ext:',
        title: 'Object extension',
      },
      {
        example: 'handle:"user/*"',
        syntax: 'handle:',
        title: 'Package name',
      },
      {
        example: 'hash:3192ac1*',
        syntax: 'hash:',
        title: 'Package hash',
      },
      {
        example: 'key:"bar/"',
        syntax: 'key:',
        title: 'Object key',
      },
      {
        example: 'metadata:dapi',
        syntax: 'metadata:',
        title: 'Package metadata',
      },
      {
        example: 'size:>=4096',
        syntax: 'size:',
        title: 'Object size in bytes',
      },
      {
        example: 'version_id:t.LVVCx*',
        syntax: 'version_id:',
        title: 'Object version id',
      },
      {
        example: 'package_stats\n  .total_files:>100',
        syntax: 'package_stats\n  .total_files:',
        title: 'Package total files',
      },
      {
        example: 'package_stats\n  .total_bytes:<100',
        syntax: 'package_stats\n  .total_bytes:',
        title: 'Package total bytes',
      },
    ],
  },

  {
    namespace: 'Logical operators and grouping',
    rows: [
      {
        example: 'a AND b',
        syntax: 'AND',
        title: 'Conjunction',
      },
      {
        example: 'a OR b',
        syntax: 'OR',
        title: 'Disjunction',
      },
      {
        example: 'NOT a',
        syntax: 'NOT',
        title: 'Negation',
      },
      {
        example: '_exists_: content',
        syntax: '_exists_:',
        title: 'Matches any non-null value for the given field',
      },
      {
        example: '(a OR b)',
        syntax: '()',
        title: 'Group terms',
      },
    ],
  },

  {
    namespace: 'Wildcards and regular expressions',
    rows: [
      {
        example: 'config.y*ml',
        syntax: '*',
        title: 'Zero or more characters, avoid leading * (slow)',
      },
      {
        example: 'React.?sx',
        syntax: '?',
        title: 'Exactly one character',
      },
      {
        example: '/lmnb[12]/',
        syntax: '//',
        title: 'Regular expression (slows search)',
      },
    ],
  },
]

const useCodeStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.grey[300],
    borderRadius: '2px',
    color: t.palette.info.contrastText,
    fontFamily: t.typography.monospace.fontFamily,
    padding: '0 3px',
    whiteSpace: 'pre-wrap',
  },
}))

function Code({ children }) {
  const classes = useCodeStyles()

  return <code className={classes.root}>{children}</code>
}

function Item({ item }) {
  const t = M.useTheme()
  const sm = M.useMediaQuery(t.breakpoints.up('sm'))

  const { example, syntax, title } = item
  return (
    <M.Grid container>
      <M.Grid item xs={6} sm={3}>
        <M.Typography variant="body2">
          <Code>{syntax}</Code>
        </M.Typography>
      </M.Grid>
      <M.Grid item xs>
        <M.Typography variant="body2">{title}</M.Typography>
      </M.Grid>
      {sm && (
        <M.Grid item xs={4}>
          <M.Typography variant="body2">
            <Code>{example}</Code>
          </M.Typography>
        </M.Grid>
      )}
    </M.Grid>
  )
}

const useItemsHeaderStyles = M.makeStyles((t) => ({
  root: {
    borderBottom: `1px solid ${t.palette.divider}`,
    padding: `0 ${t.spacing(2)}px ${t.spacing(1)}px`,
  },
}))

function ItemsHeader() {
  const t = M.useTheme()
  const sm = M.useMediaQuery(t.breakpoints.up('sm'))

  const classes = useItemsHeaderStyles()

  return (
    <M.Grid container className={classes.root}>
      <M.Grid item xs={6} sm={3}>
        <M.Typography variant="subtitle2">Command</M.Typography>
      </M.Grid>
      <M.Grid item xs>
        <M.Typography variant="subtitle2">Description</M.Typography>
      </M.Grid>
      {sm && (
        <M.Grid item xs sm={4}>
          <M.Typography variant="subtitle2">Example</M.Typography>
        </M.Grid>
      )}
    </M.Grid>
  )
}

const useDocsExternalLinkStyles = M.makeStyles((t) => ({
  root: {
    marginTop: t.spacing(2),
    marginBottom: t.spacing(4),
  },
}))

function DocsExternalLink() {
  const classes = useDocsExternalLinkStyles()

  return (
    <M.Typography variant="body2" component="p" className={classes.root}>
      {`Quilt uses ElasticSearch ${ES_V} query string queries. `}
      <StyledLink href={ES_REF} target="_blank">
        Learn more
      </StyledLink>
      .
    </M.Typography>
  )
}

export default function Help({ className, onQuery, ...props }) {
  const classes = useStyles()

  return (
    <M.Paper className={cx(classes.root, className)} {...props}>
      <Lab.TreeView
        defaultCollapseIcon={<M.Icon>arrow_drop_down</M.Icon>}
        defaultExpandIcon={<M.Icon>arrow_right</M.Icon>}
        defaultExpanded={syntaxHelpRows.map(({ namespace }) => namespace)}
        disableSelection
        className={classes.list}
      >
        {syntaxHelpRows.map(({ namespace, rows }) => (
          <Lab.TreeItem
            className={classes.group}
            label={<M.Typography variant="subtitle2">{namespace}</M.Typography>}
            nodeId={namespace}
            key={namespace}
            classes={{
              label: classes.headerLabel,
            }}
          >
            <M.List className={classes.subList}>
              <ItemsHeader />

              {rows.map((item) => (
                <M.ListItem
                  key={item.syntax}
                  className={classes.item}
                  button
                  onClick={() => onQuery(item.syntax)}
                >
                  <Item item={item} />
                </M.ListItem>
              ))}
            </M.List>
          </Lab.TreeItem>
        ))}
      </Lab.TreeView>

      <DocsExternalLink />
    </M.Paper>
  )
}
