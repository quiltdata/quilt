import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
import Placeholder from 'components/Placeholder'
import * as RT from 'utils/reactTools'

const JsonDisplayBasic = () => import('./JsonDisplay/Basic')
const JsonEditorBasic = () => import('./JsonEditor/Basic')
const JsonEditorHasInitialValue = () => import('./JsonEditor/HasInitialValue')

const SuspensePlaceholder = () => <Placeholder color="text.secondary" />

const books = [
  {
    path: '/jsoneditor',
    title: 'JsonEditor',
    children: [
      {
        Component: RT.mkLazy(JsonEditorBasic, SuspensePlaceholder),
        path: '/basic',
        title: 'Basic',
      },
      {
        Component: RT.mkLazy(JsonEditorHasInitialValue, SuspensePlaceholder),
        path: '/initial-value',
        title: 'Has initial value',
      },
    ],
  }, {
    path: '/jsondisplay',
    title: 'JsonDisplay',
    children: [
      {
        Component: RT.mkLazy(JsonDisplayBasic, SuspensePlaceholder),
        path: '/basic',
        title: 'Basic',
      },
    ],
  },
]

const useStyles = M.makeStyles((t) => ({
  root: {
    flexGrow: 1,
  },
  sidebarPaper: {
    marginTop: t.spacing(14),
    minWidth: t.spacing(30),
    whiteSpace: 'nowrap',
    zIndex: t.zIndex.appBar - 1,
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
  const t = M.useTheme()
  const lg = M.useMediaQuery(t.breakpoints.up('lg'))
  const { path, url } = RRDom.useRouteMatch()
  const [subMenu, setSubMenu] = React.useState('')
  const [menuOpened, setMenuOpened] = React.useState(false)
  const toggleMenuDrawer = React.useCallback(() => setMenuOpened((o) => !o), [])
  const toggleSubMenu = React.useCallback(
    (p) => setSubMenu((s) => (s !== p ? p : '')),
    [],
  )
  return (
    <div className={classes.root}>
      <M.AppBar position="relative" color="transparent">
        <M.Container maxWidth="lg">
          <M.Toolbar variant="dense" disableGutters>
            <M.IconButton
              aria-label="menu"
              color="inherit"
              edge="start"
              onClick={toggleMenuDrawer}
            >
              <M.Icon>menu</M.Icon>
            </M.IconButton>

            <RRDom.Switch>
              {books.map((group) =>
                group.children.map((book) => (
                  <RRDom.Route
                    path={`${path}${group.path}${book.path}`}
                    render={() => (
                      <M.Breadcrumbs>
                        <span>{group.title}</span>
                        <span>{book.title}</span>
                      </M.Breadcrumbs>
                    )}
                  />
                )),
              )}
            </RRDom.Switch>
          </M.Toolbar>
        </M.Container>
      </M.AppBar>
      <M.Drawer
        open={menuOpened || lg}
        variant="persistent"
        classes={{ paper: classes.sidebarPaper }}
      >
        <M.List className={classes.menu}>
          {books.map((group) => (
            <>
              <M.ListItem onClick={() => toggleSubMenu(group.path)}>
                <M.ListItemText>{group.title}</M.ListItemText>
                <M.Icon>{subMenu === group.path ? 'expand_less' : 'expand_more'}</M.Icon>
              </M.ListItem>
              <M.Collapse in={subMenu === group.path}>
                <M.List className={classes.subMenu} dense disablePadding>
                  {group.children.map((book) => (
                    <M.ListItem>
                      <RRDom.Link
                        to={`${url}${group.path}${book.path}`}
                        onClick={toggleMenuDrawer}
                      >
                        {book.title}
                      </RRDom.Link>
                    </M.ListItem>
                  ))}
                </M.List>
              </M.Collapse>
            </>
          ))}
        </M.List>
      </M.Drawer>
      <M.Container maxWidth="lg" className={classes.content}>
        <RRDom.Switch>
          {books.map((group) =>
            group.children.map((book) => (
              <RRDom.Route
                path={`${path}${group.path}${book.path}`}
                component={book.Component}
              />
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
