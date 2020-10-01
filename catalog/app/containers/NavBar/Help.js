import cx from 'classnames'
import * as Lab from '@material-ui/lab'
import * as M from '@material-ui/core'
import * as React from 'react'
import { FormattedMessage as FM, injectIntl } from 'react-intl'

import StyledLink from 'utils/StyledLink'

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    padding: `0 ${t.spacing(4)}px`,

    [t.breakpoints.down('xs')]: {
      padding: `0 ${t.spacing()}px`,
    },
  },
  captionsWrapper: {
    boxShadow: '0 -1px 2px rgba(0, 0, 0, 0.2)',
    margin: `0 -${t.spacing(4)}px`,
    padding: `${t.spacing()}px ${t.spacing(4)}px`,
  },
  code: {
    background: t.palette.grey['300'],
    color: t.palette.info.contrastText,
    font: t.typography.monospace,
    padding: '0 3px',
    whiteSpace: 'nowrap',
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
  itemsHeader: {
    borderBottom: `1px solid ${t.palette.divider}`,
    padding: `${t.spacing()}px ${t.spacing(2)}px`,
  },
  list: {
    flexGrow: 1,
    overflowY: 'auto',
    marginBottom: t.spacing(),
  },
  subList: {
    marginLeft: '-12px',
  },
  sup: {
    margin: '0 2px',
  },
}))

const syntaxHelpRows = [
  {
    namespace: 'searchQuerySyntax.fields',
    rows: [
      {
        id: 'comment',
        isPackage: true,
      },
      {
        id: 'content',
        isObject: true,
      },
      {
        id: 'ext',
        isObject: true,
      },
      {
        id: 'handle',
        isPackage: true,
      },
      {
        id: 'hash',
      },
      {
        id: 'key',
        isObject: true,
      },
      {
        id: 'metadata',
        isPackage: true,
      },
      {
        id: 'size',
        isPackage: true,
        isObject: true,
      },
      {
        id: 'versionId',
        isObject: true,
      },
    ],
  },

  {
    namespace: 'searchQuerySyntax.operators',
    rows: [
      {
        id: 'and',
      },
      {
        id: 'or',
      },
      {
        id: 'not',
      },
      {
        id: 'exists',
      },
      {
        id: 'group',
      },
    ],
  },

  {
    namespace: 'searchQuerySyntax.wildcards',
    rows: [
      {
        id: 'asterisk',
      },
      {
        id: 'question',
      },
    ],
  },
]

function PackageKey() {
  const classes = useStyles()
  return <sup className={classes.sup}>*</sup>
}

function ObjectKey() {
  const classes = useStyles()
  return <sup className={classes.sup}>+</sup>
}

function Code({ children }) {
  const classes = useStyles()

  return <code className={classes.code}>{children}</code>
}

function ItemSyntax({ item, namespace }) {
  const { id, isObject, isPackage } = item

  const syntaxI18nId = `${namespace}.${id}.syntax`

  return (
    <M.Typography variant="body2">
      <Code>
        <FM id={syntaxI18nId} />
      </Code>
      {isObject && <ObjectKey />}
      {isPackage && <PackageKey />}
    </M.Typography>
  )
}

function ItemTitle({ item, namespace }) {
  const { id } = item

  const syntaxI18nId = `${namespace}.${id}.syntax`
  const titleI18nId = `${namespace}.${id}.title`

  return (
    <M.Typography variant="body2">
      <FM
        id={titleI18nId}
        values={{
          syntax: (
            <Code>
              <FM id={syntaxI18nId} />
            </Code>
          ),
        }}
      />
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
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))

  const exampleI18nId = `${namespace}.${item.id}.example`
  const hasExample = intl.messages[exampleI18nId]
  const titleI18nId = `${namespace}.${item.id}.title`
  const hasTitle = intl.messages[titleI18nId]

  return (
    <M.Grid container>
      <M.Grid item xs={xs ? 4 : 3}>
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

function ItemsHeader() {
  const classes = useStyles()

  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))

  return (
    <M.Grid container className={classes.itemsHeader}>
      <M.Grid item xs={xs ? 4 : 3}>
        <M.Typography variant="subtitle2">
          <FM id="searchQuerySyntax.command" />
        </M.Typography>
      </M.Grid>
      <M.Grid item xs>
        <M.Typography variant="subtitle2">
          <FM id="searchQuerySyntax.description" />
        </M.Typography>
      </M.Grid>
      <M.Grid item xs sm={3}>
        <M.Typography variant="subtitle2">
          <FM id="searchQuerySyntax.example" />
        </M.Typography>
      </M.Grid>
    </M.Grid>
  )
}

function Legend() {
  const classes = useStyles()

  return (
    <M.Box className={classes.caption}>
      <M.Typography variant="caption">
        <FM id="searchQuerySyntax.isPackage" values={{ key: <PackageKey /> }} />
      </M.Typography>
      ,{' '}
      <M.Typography variant="caption">
        <FM id="searchQuerySyntax.isObject" values={{ key: <ObjectKey /> }} />
      </M.Typography>
    </M.Box>
  )
}

function DocsExternalLink() {
  const classes = useStyles()

  const ES_V = '6.7'
  const ES_REF = `https://www.elastic.co/guide/en/elasticsearch/reference/${ES_V}/query-dsl-query-string-query.html#query-string-syntax`

  const link = (
    <StyledLink href={ES_REF}>
      <FM id="searchQuerySyntax.captionLink" />
    </StyledLink>
  )

  return (
    <M.Box className={classes.caption}>
      <M.Typography variant="caption">
        <FM id="searchQuerySyntax.caption" values={{ link }} />
      </M.Typography>
    </M.Box>
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
              <ItemsHeader />

              {rows.map((item) => (
                <M.ListItem
                  key={item.id}
                  className={classes.item}
                  button
                  onClick={() =>
                    onQuery(intl.formatMessage({ id: `${namespace}.${item.id}.syntax` }))
                  }
                >
                  <ItemWrapper item={item} namespace={namespace} />
                </M.ListItem>
              ))}
            </M.List>
          </Lab.TreeItem>
        ))}
      </Lab.TreeView>

      <M.Box className={classes.captionsWrapper}>
        <DocsExternalLink />

        <Legend />
      </M.Box>
    </M.Paper>
  )
}

export default injectIntl(Help)
