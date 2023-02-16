import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
import Placeholder from 'components/Placeholder'
import * as RT from 'utils/reactTools'

const ButtonsIconized = () => import('./Buttons/Iconized')
const JsonDisplayBasic = () => import('./JsonDisplay/Basic')
const JsonEditorBasic = () => import('./JsonEditor/Basic')
const JsonEditorHasInitialValue = () => import('./JsonEditor/HasInitialValue')
const CommitMessage = () => import('./Forms/CommitMessage')
const SelectDropdownBasic = () => import('./SelectDropdown/Basic')
const SelectDropdownStates = () => import('./SelectDropdown/States')

const SuspensePlaceholder = () => <Placeholder color="text.secondary" />

const books = [
  {
    path: '/buttons',
    title: 'Buttons',
    children: [
      {
        Component: RT.mkLazy(ButtonsIconized, SuspensePlaceholder),
        path: '/iconized',
        title: 'Iconized',
      },
    ],
  },
  {
    path: '/package-dialog',
    title: 'Package Dialog',
    children: [
      {
        Component: RT.mkLazy(CommitMessage, SuspensePlaceholder),
        path: '/commit-message',
        title: 'Commit message',
      },
    ],
  },
  {
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
  },
  {
    path: '/select-dropdowns',
    title: 'SelectDropdowns',
    children: [
      {
        Component: RT.mkLazy(SelectDropdownBasic, SuspensePlaceholder),
        path: '/basic',
        title: 'Basic',
      },
      {
        Component: RT.mkLazy(SelectDropdownStates, SuspensePlaceholder),
        path: '/states',
        title: 'States',
      },
    ],
  },
]

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
  },
  sidebarPaper: {
    marginTop: t.spacing(14),
    minWidth: t.spacing(30),
    whiteSpace: 'nowrap',
    zIndex: t.zIndex.appBar - 1,
  },
  subMenu: {
    paddingLeft: t.spacing(2),
  },
  content: {
    flexGrow: 1,
    paddingTop: t.spacing(2),
    background: t.palette.common.white,
  },
}))

function StoryBook() {
  const classes = useStyles()
  const t = M.useTheme()
  const xl = M.useMediaQuery(t.breakpoints.up('xl'))
  const { path, url } = RRDom.useRouteMatch()
  const [closedSubMenu, setClosedSubMenu] = React.useState<Record<string, boolean>>({})
  const [menuOpened, setMenuOpened] = React.useState(false)
  const toggleMenuDrawer = React.useCallback(() => setMenuOpened((o) => !o), [])
  const toggleSubMenu = React.useCallback(
    (p: string) =>
      setClosedSubMenu((s: Record<string, boolean>) => ({ ...s, [p]: !s[p] })),
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
                    key={`${path}${group.path}${book.path}`}
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
        open={menuOpened || xl}
        variant="persistent"
        classes={{ paper: classes.sidebarPaper }}
      >
        <M.List>
          {books.map((group) => (
            <React.Fragment key={group.path}>
              <M.ListItem onClick={() => toggleSubMenu(group.path)}>
                <M.ListItemText>{group.title}</M.ListItemText>
                <M.Icon>
                  {closedSubMenu[group.path] ? 'expand_more' : 'expand_less'}
                </M.Icon>
              </M.ListItem>
              <M.Collapse in={!closedSubMenu[group.path]}>
                <M.List className={classes.subMenu} dense disablePadding>
                  {group.children.map((book) => (
                    <M.ListItem key={`${url}${group.path}${book.path}`}>
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
            </React.Fragment>
          ))}
        </M.List>
      </M.Drawer>
      <M.Container maxWidth="lg" className={classes.content}>
        <RRDom.Switch>
          {books.map((group) =>
            group.children.map((book) => (
              <RRDom.Route
                key={`${path}${group.path}${book.path}`}
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
