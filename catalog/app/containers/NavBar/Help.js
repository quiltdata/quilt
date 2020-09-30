import * as Lab from '@material-ui/lab'
import * as M from '@material-ui/core'
import * as React from 'react'

import StyledLink from 'utils/StyledLink'
import searchQuerySyntax from 'translations/search-query-syntax.json'

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

function Help({ onQuery }) {
  const classes = useStyles()

  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))

  const ES_V = '6.7'
  const ES_REF = `https://www.elastic.co/guide/en/elasticsearch/reference/${ES_V}/query-dsl-query-string-query.html#query-string-syntax`

  const { caption, keywords, operators, regex, wildcards } = searchQuerySyntax
  const syntaxHelpRows = [keywords, operators, wildcards, regex]

  return (
    <M.Box className={classes.wrapper}>
      <M.Paper className={classes.root}>
        <Lab.TreeView
          defaultCollapseIcon={<M.Icon>arrow_drop_down</M.Icon>}
          defaultExpandIcon={<M.Icon>arrow_right</M.Icon>}
          defaultExpanded={syntaxHelpRows.map((syntaxHelp) => syntaxHelp.title)}
          disableSelection
        >
          {syntaxHelpRows.map((syntaxHelp) => (
            <Lab.TreeItem
              className={classes.group}
              label={<M.Typography variant="subtitle2">{syntaxHelp.title}</M.Typography>}
              nodeId={syntaxHelp.title}
              key={syntaxHelp.title}
              classes={{
                label: classes.headerLabel,
              }}
            >
              {syntaxHelp.rows.map(({ example, key, objected, packaged, title }) => (
                <Lab.TreeItem
                  key={key}
                  nodeId={key}
                  classes={{
                    iconContainer: classes.itemIcon,
                    root: classes.itemRoot,
                  }}
                  onLabelClick={() => onQuery(key)}
                  label={
                    <M.Grid container>
                      <M.Grid item xs={xs ? 5 : 4}>
                        <M.Typography variant="body2">
                          <code className={classes.code}>{key}</code>
                          {objected && <sup className={classes.sup}>+</sup>}
                          {packaged && <sup className={classes.sup}>*</sup>}
                        </M.Typography>
                      </M.Grid>
                      <M.Grid item xs>
                        <M.Typography variant="body2">{title}</M.Typography>
                      </M.Grid>
                      {example && (
                        <M.Grid item xs>
                          <M.Typography variant="body2" align="right">
                            <code className={classes.code}>{example}</code>
                          </M.Typography>
                        </M.Grid>
                      )}
                    </M.Grid>
                  }
                />
              ))}
            </Lab.TreeItem>
          ))}
        </Lab.TreeView>

        <M.Box className={classes.caption}>
          <M.Typography variant="caption">
            {caption}
            <StyledLink href={ES_REF}>ElasticSearch 6.7 query string syntax</StyledLink>
          </M.Typography>
        </M.Box>

        <M.Box className={classes.caption}>
          <M.Typography variant="caption">
            <sup className={classes.sup}>*</sup> — package
            <br />
            <sup className={classes.sup}>+</sup> — object
          </M.Typography>
        </M.Box>
      </M.Paper>
    </M.Box>
  )
}

export default Help
