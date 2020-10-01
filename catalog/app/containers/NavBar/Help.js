import cx from 'classnames'
import * as Lab from '@material-ui/lab'
import * as M from '@material-ui/core'
import * as React from 'react'

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
    marginLeft: '-12px',
  },
}))

const useCodeStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.grey['300'],
    color: t.palette.info.contrastText,
    font: t.typography.monospace,
    padding: '0 3px',
    whiteSpace: 'pre-wrap',
  },
}))

const useItemsHeaderStyles = M.makeStyles((t) => ({
  root: {
    borderBottom: `1px solid ${t.palette.divider}`,
    padding: `0 ${t.spacing(2)}px ${t.spacing(1)}px`,
  },
}))

const useDocsExternalLinkStyles = M.makeStyles((t) => ({
  root: {
    marginTop: t.spacing(2),
    marginBottom: t.spacing(4),
  },
}))

const syntaxHelpRows = [
  {
    namespace: 'Fields',
    rows: [
      {
        example: 'comment: TODO',
        id: 'comment',
        syntax: 'comment:',
        title: 'Package comment',
      },
      {
        example: 'content: Hello',
        id: 'content',
        syntax: 'content:',
        title: 'Object content',
      },
      {
        example: 'ext: *.fastq.gz',
        id: 'ext',
        syntax: 'ext:',
        title: 'Object extension',
      },
      {
        example: 'handle: "user/*"',
        id: 'handle',
        syntax: 'handle:',
        title: 'Package name',
      },
      {
        example: 'hash: 3192ac1*',
        id: 'hash',
        syntax: 'hash:',
        title: 'Package hash',
      },
      {
        example: 'key: "bar/"',
        id: 'key',
        syntax: 'key:',
        title: 'Object key',
      },
      {
        example: 'metadata: dapi',
        id: 'metadata',
        syntax: 'metadata:',
        title: 'Package metadata',
      },
      {
        example: 'size: >=4096',
        id: 'size',
        syntax: 'size:',
        title: 'Object size in bytes',
      },
      {
        example: 'version_id: t.LVVCx*',
        id: 'versionId',
        syntax: 'version_id:',
        title: 'Object version id',
      },
      {
        example: 'package_stats\n  .total_files: >100',
        id: 'totalFiles',
        syntax: 'package_stats\n  .total_files:',
        title: 'Package total files',
      },
      {
        example: 'package_stats\n  .total_bytes: <100',
        id: 'totalBytes',
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
        id: 'and',
        syntax: 'AND',
        title: 'Conjunction',
      },
      {
        example: 'a OR b',
        id: 'or',
        syntax: 'OR',
        title: 'Disjunction',
      },
      {
        example: 'NOT a',
        id: 'not',
        syntax: 'NOT',
        title: 'Negation',
      },
      {
        example: '_exists_: content',
        id: 'exists',
        syntax: '_exists_:',
        title: 'Matches any non-null value for the given field',
      },
      {
        example: '(a OR b)',
        id: 'group',
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
        id: 'asterisk',
        syntax: '*',
        title: 'Zero or more characters, avoid leading * (slow)',
      },
      {
        example: 'React.?sx',
        id: 'question',
        syntax: '?',
        title: 'Exactly one character',
      },
      {
        example: '/lmnb[12]/',
        id: 'regex',
        syntax: '//',
        title: 'Regular expression (slows search)',
      },
    ],
  },
]

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

function DocsExternalLink() {
  const classes = useDocsExternalLinkStyles()

  return (
    <M.Typography variant="body2" component="p" className={classes.root}>
      Quilt uses ElasticSearch 6.7 query string queries.{' '}
      <StyledLink href={ES_REF} target="_blank">
        Learn more
      </StyledLink>
      .
    </M.Typography>
  )
}

function Help({ className, onQuery }) {
  const classes = useStyles()

  return (
    <M.Paper className={cx(classes.root, className)}>
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
                  key={item.id}
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

export default Help
