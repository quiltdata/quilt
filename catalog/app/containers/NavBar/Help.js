import * as Lab from '@material-ui/lab'
import * as M from '@material-ui/core'
import * as React from 'react'
import { FormattedMessage as FM, injectIntl } from 'react-intl'

import StyledLink from 'utils/StyledLink'

const useStyles = M.makeStyles((t) => ({
  '@keyframes appear': {
    '0%': {
      transform: 'translateY(-10px)',
    },
    '100%': {
      transform: 'translateY(0)',
    },
  },
  root: {
    maxHeight: '400px',
    overflowY: 'auto',
    padding: `${t.spacing()}px ${t.spacing(4)}px ${t.spacing(4)}px`,

    [t.breakpoints.down('xs')]: {
      paddingLeft: t.spacing(),
      paddingRight: t.spacing(),
    },
  },
  caption: {
    margin: `${t.spacing(2)}px 0`,
  },
  code: {
    background: t.palette.info.light, // t.info.main
    color: t.palette.info.contrastText,
    font: t.typography.monospace,
    padding: '0 3px',
    whiteSpace: 'nowrap',
  },
  group: {
    marginTop: t.spacing(2),
  },
  headerLabel: {
    '&:hover': {
      background: 'transparent',
    },
  },
  itemRoot: {
    borderBottom: `1px solid ${t.palette.divider}`,
    marginTop: t.spacing(),
    paddingBottom: t.spacing(),

    '&:last-child': {
      border: 0,
    },
  },
  itemIcon: {
    width: 0,
  },
  sup: {
    margin: '0 2px',
  },
  wrapper: {
    animation: '$appear 150ms ease',
    left: 0,
    position: 'absolute',
    right: 0,
    top: t.spacing(5),

    [t.breakpoints.down('xs')]: {
      left: '-43px',
      right: '-36px',
    },
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

  {
    namespace: 'searchQuerySyntax.regex',
    rows: [],
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

  const syntaxId = `${namespace}.${id}.syntax`

  return (
    <M.Typography variant="body2">
      <Code>
        <FM id={syntaxId} />
      </Code>
      {isObject && <ObjectKey />}
      {isPackage && <PackageKey />}
    </M.Typography>
  )
}

function ItemTitle({ item, namespace }) {
  const { id } = item

  const syntaxId = `${namespace}.${id}.syntax`
  const titleId = `${namespace}.${id}.title`

  return (
    <M.Typography variant="body2">
      <FM
        id={titleId}
        values={{
          syntax: (
            <Code>
              <FM id={syntaxId} />
            </Code>
          ),
        }}
      />
    </M.Typography>
  )
}

function ItemExample({ item, namespace }) {
  const { id } = item

  const exampleId = `${namespace}.${id}.example`

  return (
    <M.Typography variant="body2">
      <Code>
        <FM id={exampleId} />
      </Code>
    </M.Typography>
  )
}

function Item({ intl, item, namespace }) {
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))

  const exampleId = `${namespace}.${item.id}.example`
  const hasExample = intl.messages[exampleId]
  const titleId = `${namespace}.${item.id}.title`
  const hasTitle = intl.messages[titleId]

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
        <M.Grid item xs align="right">
          <ItemExample item={item} namespace={namespace} />
        </M.Grid>
      )}
    </M.Grid>
  )
}

const ItemWrapper = injectIntl(Item)

function Legend() {
  const classes = useStyles()

  return (
    <M.Box className={classes.caption}>
      <M.Typography variant="caption" component="p">
        <FM id="searchQuerySyntax.isPackage" values={{ key: <PackageKey /> }} />
      </M.Typography>
      <M.Typography variant="caption" component="p">
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

function Help({ intl, onQuery }) {
  const classes = useStyles()

  return (
    <M.Box className={classes.wrapper}>
      <M.Paper className={classes.root}>
        <Lab.TreeView
          defaultCollapseIcon={<M.Icon>arrow_drop_down</M.Icon>}
          defaultExpandIcon={<M.Icon>arrow_right</M.Icon>}
          defaultExpanded={syntaxHelpRows.map(({ namespace }) => namespace)}
          disableSelection
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
              {rows.map((item) => (
                <Lab.TreeItem
                  key={item.id}
                  nodeId={item.id}
                  classes={{
                    iconContainer: classes.itemIcon,
                    root: classes.itemRoot,
                  }}
                  onLabelClick={() =>
                    onQuery(intl.formatMessage({ id: `${namespace}.${item.id}.syntax` }))
                  }
                  label={<ItemWrapper item={item} namespace={namespace} />}
                />
              ))}
            </Lab.TreeItem>
          ))}
        </Lab.TreeView>

        <DocsExternalLink />

        <Legend />
      </M.Paper>
    </M.Box>
  )
}

export default injectIntl(Help)
