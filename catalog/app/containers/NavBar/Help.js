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
    font: t.typography.monospace,
    padding: '0 3px',
    background: t.palette.info.light, // t.info.main
    color: t.palette.info.contrastText,
  },
  group: {
    marginTop: t.spacing(2),
  },
  wrapper: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: t.spacing(5),
    animation: '$appear 150ms ease',
    [t.breakpoints.down('xs')]: {
      left: '-43px',
      right: '-36px',
    },
  },
  headerLabel: {
    '&:hover': {
      background: 'transparent',
    },
  },
  itemRoot: {
    marginTop: t.spacing(),
    paddingBottom: t.spacing(),
    borderBottom: `1px solid ${t.palette.divider}`,
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

function Help({ intl, onQuery }) {
  const classes = useStyles()

  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))

  const ES_V = '6.7'
  const ES_REF = `https://www.elastic.co/guide/en/elasticsearch/reference/${ES_V}/query-dsl-query-string-query.html#query-string-syntax`

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
              {rows.map(({ id, isObject, isPackage }) => {
                const exampleId = `${namespace}.${id}.example`
                const hasExample = intl.messages[exampleId]
                const syntaxId = `${namespace}.${id}.syntax`
                const titleId = `${namespace}.${id}.title`
                const hasTitle = intl.messages[titleId]
                return (
                  <Lab.TreeItem
                    key={id}
                    nodeId={id}
                    classes={{
                      iconContainer: classes.itemIcon,
                      root: classes.itemRoot,
                    }}
                    onLabelClick={() => onQuery()}
                    label={
                      <M.Grid container>
                        <M.Grid item xs={xs ? 5 : 4}>
                          <M.Typography variant="body2">
                            <code className={classes.code}>
                              <FM id={syntaxId} />
                            </code>
                            {isObject && <sup className={classes.sup}>+</sup>}
                            {isPackage && <sup className={classes.sup}>*</sup>}
                          </M.Typography>
                        </M.Grid>
                        {hasTitle && (
                          <M.Grid item xs>
                            <M.Typography variant="body2">
                              <FM id={titleId} />
                            </M.Typography>
                          </M.Grid>
                        )}
                        {hasExample && (
                          <M.Grid item xs>
                            <M.Typography variant="body2" align="right">
                              <code className={classes.code}>
                                <FM id={exampleId} />
                              </code>
                            </M.Typography>
                          </M.Grid>
                        )}
                      </M.Grid>
                    }
                  />
                )
              })}
            </Lab.TreeItem>
          ))}
        </Lab.TreeView>

        <M.Box className={classes.caption}>
          <M.Typography variant="caption">
            <FM id="searchQuerySyntax.caption" />
            <StyledLink href={ES_REF}>ElasticSearch 6.7 query string syntax</StyledLink>
          </M.Typography>
        </M.Box>

        <M.Box className={classes.caption}>
          <M.Typography variant="caption">
            <sup className={classes.sup}>*</sup>
            <FM id="searchQuerySyntax.isPackage" />
            <br />
            <sup className={classes.sup}>+</sup>
            <FM id="searchQuerySyntax.isObject" />
          </M.Typography>
        </M.Box>
      </M.Paper>
    </M.Box>
  )
}

export default injectIntl(Help)
