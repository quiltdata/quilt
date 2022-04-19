import * as FP from 'fp-ts'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import StyledLink from 'utils/StyledLink'
import Code from 'components/Code'

const ES_V = '6.7'
const ES_REF = `https://www.elastic.co/guide/en/elasticsearch/reference/${ES_V}/query-dsl-query-string-query.html#query-string-syntax`

const useStyles = M.makeStyles((t) => ({
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

type ExampleFormatter = (...syntaxParts: React.ReactNode[]) => React.ReactNode

interface SyntaxHelpItem {
  example: ExampleFormatter
  syntax: string | string[]
  title: string
}

interface SyntaxHelpNamespace {
  namespace: string
  rows: SyntaxHelpItem[]
}

const syntaxHelpRows: SyntaxHelpNamespace[] = [
  {
    namespace: 'Fields',
    rows: [
      {
        example: (s) => <>{s}TODO</>,
        syntax: 'comment:',
        title: 'Package comment',
      },
      {
        example: (s) => <>{s}Hello</>,
        syntax: 'content:',
        title: 'Object content',
      },
      {
        example: (s) => <>{s}*.fastq.gz</>,
        syntax: 'ext:',
        title: 'Object extension',
      },
      {
        example: (s) => <>{s}"user/*"</>,
        syntax: 'handle:',
        title: 'Package name',
      },
      {
        example: (s) => <>{s}3192ac1*</>,
        syntax: 'hash:',
        title: 'Package hash',
      },
      {
        example: (s) => <>{s}research*</>,
        syntax: 'key:',
        title: 'Object key',
      },
      {
        example: (s) => <>{s}"research"</>,
        syntax: 'key_text:',
        title: 'Analyzed object key',
      },
      {
        example: (s) => <>{s}[2022-02-04 TO 2022-02-20]</>,
        syntax: 'last_modified:',
        title: 'Last modified date',
      },
      {
        example: (s) => <>{s}dapi</>,
        syntax: 'metadata:',
        title: 'Package metadata',
      },
      {
        example: (s) => <>{s}&gt;=4096</>,
        syntax: 'size:',
        title: 'Object size in bytes',
      },
      {
        example: (s) => <>{s}t.LVVCx*</>,
        syntax: 'version_id:',
        title: 'Object version id',
      },
      {
        example: (s) => <>{s}&gt;100</>,
        syntax: 'package_stats\n  .total_files:',
        title: 'Package total files',
      },
      {
        example: (s) => <>{s}&lt;100</>,
        syntax: 'package_stats\n  .total_bytes:',
        title: 'Package total bytes',
      },
    ],
  },

  {
    namespace: 'Logical operators and grouping',
    rows: [
      {
        example: (s) => <>a {s} b</>,
        syntax: 'AND',
        title: 'Conjunction',
      },
      {
        example: (s) => <>a {s} b</>,
        syntax: 'OR',
        title: 'Disjunction',
      },
      {
        example: (s) => <>{s} a</>,
        syntax: 'NOT',
        title: 'Negation',
      },
      {
        example: (s) => <>{s} content</>,
        syntax: '_exists_:',
        title: 'Matches any non-null value for the given field',
      },
      {
        example: (s1, s2) => (
          <>
            {s1}a AND b{s2}
          </>
        ),
        syntax: ['(', ')'],
        title: 'Group terms',
      },
    ],
  },

  {
    namespace: 'Wildcards and regular expressions',
    rows: [
      {
        example: (s) => <>config.y{s}ml</>,
        syntax: '*',
        title: 'Zero or more characters, avoid leading * (slow)',
      },
      {
        example: (s) => <>React.{s}sx</>,
        syntax: '?',
        title: 'Exactly one character',
      },
      {
        example: (s1, s2) => (
          <>
            {s1}lmnb[12]{s2}
          </>
        ),
        syntax: ['/', '/'],
        title: 'Regular expression (slows search)',
      },
    ],
  },
]

const useExamplePartStyles = M.makeStyles((t) => ({
  root: {
    color: t.palette.text.hint,
  },
  syntax: {
    color: t.palette.text.primary,
  },
}))

interface ExamplePartProps {
  syntax: string | string[]
  example: ExampleFormatter
}

function Example({ syntax, example }: ExamplePartProps) {
  const classes = useExamplePartStyles()
  const syntaxParts = (Array.isArray(syntax) ? syntax : [syntax]).map((part) => (
    <span className={classes.syntax}>{part}</span>
  ))
  return <span className={classes.root}>{example(...syntaxParts)}</span>
}

interface SyntaxProps {
  syntax: string | string[]
}
function Syntax({ syntax }: SyntaxProps) {
  return <>{Array.isArray(syntax) ? syntax.join('') : syntax}</>
}

interface ItemProps {
  item: SyntaxHelpItem
}

function Item({ item }: ItemProps) {
  const t = M.useTheme()
  const sm = M.useMediaQuery(t.breakpoints.up('sm'))

  const { example, syntax, title } = item
  return (
    <M.Grid container>
      <M.Grid item xs={7}>
        <M.Typography variant="body2">
          <Code>
            {sm ? (
              <Example syntax={syntax} example={example} />
            ) : (
              <Syntax syntax={syntax} />
            )}
          </Code>
        </M.Typography>
      </M.Grid>
      <M.Grid item xs>
        <M.Typography variant="body2">{title}</M.Typography>
      </M.Grid>
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
  const classes = useItemsHeaderStyles()

  return (
    <M.Grid container className={classes.root}>
      <M.Grid item xs={7}>
        <M.Typography variant="subtitle2">Command</M.Typography>
      </M.Grid>
      <M.Grid item xs>
        <M.Typography variant="subtitle2">Description</M.Typography>
      </M.Grid>
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

const normalizeSyntaxItem = (s: string | string[]) =>
  FP.function.pipe(
    s,
    (s1: string | string[]) => (Array.isArray(s1) ? s1.join('') : s1),
    (s2: string) => s2.replace(/\s/g, ''),
  )

type HelpProps = Partial<React.HTMLAttributes<HTMLDivElement>> & {
  className: string
  onQuery: (query: string) => void
}

export default function Help({ className, onQuery, ...props }: HelpProps) {
  const classes = useStyles()

  return (
    <div className={className} {...props}>
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

              {rows.map((item) => {
                const syntax = normalizeSyntaxItem(item.syntax)
                return (
                  <M.ListItem
                    key={syntax}
                    className={classes.item}
                    button
                    onClick={() => onQuery(syntax)}
                  >
                    <Item item={item} />
                  </M.ListItem>
                )
              })}
            </M.List>
          </Lab.TreeItem>
        ))}
      </Lab.TreeView>

      <DocsExternalLink />
    </div>
  )
}
