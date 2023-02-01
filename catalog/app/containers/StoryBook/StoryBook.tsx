import * as React from 'react'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'

import JsonEditorBook from './JsonEditor/Basic'

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
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
  return (
    <div className={classes.root}>
      <div className={classes.sidebar}>
        <M.List className={classes.menu}>
          <M.ListItem>Json Editor</M.ListItem>
          <M.List className={classes.subMenu} dense disablePadding>
            <M.ListItem>Basic</M.ListItem>
            <M.ListItem>Has initial value</M.ListItem>
          </M.List>
        </M.List>
      </div>
      <M.Container maxWidth="lg" className={classes.content}>
        <JsonEditorBook />
      </M.Container>
    </div>
  )
}

export default function StoryBookPage() {
  return <Layout pre={<StoryBook />} />
}
