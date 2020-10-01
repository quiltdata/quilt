import cx from 'classnames'
import * as Lab from '@material-ui/lab'
import * as M from '@material-ui/core'
import * as React from 'react'
import { FormattedMessage as FM, injectIntl } from 'react-intl'

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
    whiteSpace: 'nowrap',
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
    marginBottom: t.spacing(3),
  },
}))

const syntaxHelpRows = [
  {
    namespace: 'searchQuerySyntax.fields',
    rows: [
      {
        id: 'comment',
        isPackage: true,
        syntax: 'comment:',
      },
      {
        id: 'content',
        isObject: true,
        syntax: 'content:',
      },
      {
        id: 'ext',
        isObject: true,
        syntax: 'ext:',
      },
      {
        id: 'handle',
        isPackage: true,
        syntax: 'handle:',
      },
      {
        id: 'hash',
        syntax: 'hash:',
      },
      {
        id: 'key',
        isObject: true,
        syntax: 'key:',
      },
      {
        id: 'metadata',
        isPackage: true,
        syntax: 'metadata:',
      },
      {
        id: 'size',
        isPackage: true,
        isObject: true,
        syntax: 'size:',
      },
      {
        id: 'versionId',
        isObject: true,
        syntax: 'version_id:',
      },
    ],
  },

  {
    namespace: 'searchQuerySyntax.operators',
    rows: [
      {
        id: 'and',
        syntax: 'AND',
      },
      {
        id: 'or',
        syntax: 'OR',
      },
      {
        id: 'not',
        syntax: 'NOT',
      },
      {
        id: 'exists',
        syntax: '_exists_:',
      },
      {
        id: 'group',
        syntax: '()',
      },
    ],
  },

  {
    namespace: 'searchQuerySyntax.wildcards',
    rows: [
      {
        id: 'asterisk',
        syntax: '*',
      },
      {
        id: 'question',
        syntax: '?',
      },
    ],
  },
]

function Code({ children }) {
  const classes = useCodeStyles()

  return <code className={classes.root}>{children}</code>
}

function ItemSyntax({ item }) {
  const { syntax } = item

  return (
    <M.Typography variant="body2">
      <Code>{syntax}</Code>
    </M.Typography>
  )
}

function ItemTitle({ item, namespace }) {
  const { id, isObject, isPackage, syntax } = item

  const titleI18nId = `${namespace}.${id}.title`

  return (
    <M.Typography variant="body2">
      <FM
        id={titleI18nId}
        values={{
          syntax: <Code>{syntax}</Code>,
        }}
      />
      {isObject && isPackage && <FM id="searchQuerySyntax.objectAndPackage" />}
      {isObject && !isPackage && <FM id="searchQuerySyntax.object" />}
      {isPackage && !isObject && <FM id="searchQuerySyntax.package" />}
    </M.Typography>
  )
}

function ItemExample({ item, namespace }) {
  const { id } = item

  const exampleI18nId = `${namespace}.${id}.example`

  return (
    <M.Typography variant="body2">
      <Code>
        <FM id={exampleI18nId} />
      </Code>
    </M.Typography>
  )
}

function Item({ intl, item, namespace }) {
  const exampleI18nId = `${namespace}.${item.id}.example`
  const hasExample = intl.messages[exampleI18nId]
  const titleI18nId = `${namespace}.${item.id}.title`
  const hasTitle = intl.messages[titleI18nId]

  return (
    <M.Grid container>
      <M.Grid item xs={4} sm={3}>
        <ItemSyntax item={item} namespace={namespace} />
      </M.Grid>
      {hasTitle && (
        <M.Grid item xs>
          <ItemTitle item={item} namespace={namespace} />
        </M.Grid>
      )}
      {hasExample && (
        <M.Grid item xs sm={3}>
          <ItemExample item={item} namespace={namespace} />
        </M.Grid>
      )}
    </M.Grid>
  )
}

const ItemWrapper = injectIntl(Item)

function ItemsHeader({ hasExamples }) {
  const classes = useItemsHeaderStyles()

  return (
    <M.Grid container className={classes.root}>
      <M.Grid item xs={4} sm={3}>
        <M.Typography variant="subtitle2">
          <FM id="searchQuerySyntax.command" />
        </M.Typography>
      </M.Grid>
      <M.Grid item xs>
        <M.Typography variant="subtitle2">
          <FM id="searchQuerySyntax.description" />
        </M.Typography>
      </M.Grid>
      {hasExamples && (
        <M.Grid item xs sm={3}>
          <M.Typography variant="subtitle2">
            <FM id="searchQuerySyntax.example" />
          </M.Typography>
        </M.Grid>
      )}
    </M.Grid>
  )
}

function DocsExternalLink() {
  const classes = useDocsExternalLinkStyles()

  const link = (
    <StyledLink href={ES_REF} target="_blank">
      <FM id="searchQuerySyntax.captionLink" />
    </StyledLink>
  )

  return (
    <M.Typography variant="body2" component="p" className={classes.root}>
      <FM id="searchQuerySyntax.caption" values={{ link }} />
    </M.Typography>
  )
}

function Help({ className, intl, onQuery }) {
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
            label={
              <M.Typography variant="subtitle2">
                <FM id={`${namespace}.title`} />
              </M.Typography>
            }
            nodeId={namespace}
            key={namespace}
            classes={{
              label: classes.headerLabel,
            }}
          >
            <M.List className={classes.subList}>
              <ItemsHeader
                hasExamples={rows.some(
                  (item) => intl.messages[`${namespace}.${item.id}.example`],
                )}
              />

              {rows.map((item) => (
                <M.ListItem
                  key={item.id}
                  className={classes.item}
                  button
                  onClick={() => onQuery(item.syntax)}
                >
                  <ItemWrapper item={item} namespace={namespace} />
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

export default injectIntl(Help)
