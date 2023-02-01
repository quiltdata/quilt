import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'

import JsonEditorBasic from './JsonEditor/Basic'
import JsonEditorHasInitialValue from './JsonEditor/HasInitialValue'

const books = [
  {
    path: '/jsoneditor',
    title: 'JsonEditor',
    children: [
      {
        Component: JsonEditorBasic,
        path: '/jsoneditor/basic',
        title: 'Basic',
      },
      {
        Component: JsonEditorHasInitialValue,
        path: '/jsoneditor/initial-value',
        title: 'Has initial value',
      },
    ],
  },
]

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexGrow: 1,
  },
  sidebar: {
    whiteSpace: 'nowrap',
    boxShadow: `inset 0px 2px 4px -1px rgba(0,0,0,0.2), inset 0px 4px 5px 0px rgba(0,0,0,0.14), inset 0px 1px 10px 0px rgba(0,0,0,0.12)`,
  },
  menu: {},
  subMenu: {
    paddingLeft: t.spacing(2),
  },
  content: {
    paddingTop: t.spacing(2),
    background: t.palette.common.white,
  },
}))

function StoryBook() {
  const classes = useStyles()
  const { path, url } = RRDom.useRouteMatch()
  return (
    <div className={classes.root}>
      <div className={classes.sidebar}>
        <M.List className={classes.menu}>
          {books.map((group) => (
            <>
              <M.ListItem>{group.title}</M.ListItem>
              <M.List className={classes.subMenu} dense disablePadding>
                {group.children.map((book) => (
                  <M.ListItem>
                    <RRDom.Link to={`${url}${book.path}`}>{book.title}</RRDom.Link>
                  </M.ListItem>
                ))}
              </M.List>
            </>
          ))}
        </M.List>
      </div>
      <M.Container maxWidth="lg" className={classes.content}>
        <RRDom.Switch>
          {books.map((group) =>
            group.children.map((book) => (
              <RRDom.Route path={`${path}${book.path}`} component={book.Component} />
            )),
          )}
        </RRDom.Switch>
      </M.Container>
    </div>
  )
}

export default function StoryBookPage() {
  return <Layout pre={<StoryBook />} />
}
