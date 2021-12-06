import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import perspective from '@finos/perspective'

import 'utils/perspective-pollution'

import { renderWarnings } from './util'

const worker = perspective.worker()

const useStyles = M.makeStyles((t) => ({
  root: {
    width: '100%',
  },
  viewer: {
    height: t.spacing(40),
  },
}))

function renderPerspectiveViewer(parentNode, className) {
  const element = document.createElement('perspective-viewer')
  element.className = className
  parentNode.appendChild(element)
  return element
}

async function renderTable(data, viewer) {
  const table = await worker.table(data)
  viewer.load(table)
  return table
}

function DataFrame({ children, className, data, note, warnings, ...props } = {}) {
  const classes = useStyles()

  const [root, setRoot] = React.useState(null)

  React.useEffect(() => {
    let table, viewer

    async function fetchData() {
      if (!root) return

      viewer = renderPerspectiveViewer(root, classes.viewer)
      table = await renderTable(data, viewer)
    }
    fetchData()

    return () => {
      table?.delete()
      viewer?.parentNode?.removeChild(viewer)
    }
  }, [classes.viewer, data, root])

  return (
    <div className={cx(className, classes.root)} ref={setRoot} title={note} {...props}>
      {renderWarnings(warnings)}
    </div>
  )
}

export default ({ data, note, warnings }, props) => (
  <DataFrame {...{ data, note, warnings }} {...props} />
)
