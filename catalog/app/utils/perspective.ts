import cx from 'classnames'
import * as React from 'react'

import type { RegularTableElement } from 'regular-table'
import perspective from '@finos/perspective'
import type { Table, TableData, ViewConfig } from '@finos/perspective'
import type { HTMLPerspectiveViewerElement } from '@finos/perspective-viewer'

import Log from 'utils/Logging'
import { themes } from 'utils/perspective-pollution'

export type PerspectiveInput = TableData

const worker = perspective.worker()

export type Model = {
  rotateThemes: () => void
  size: number | null
  toggleConfig: () => void
}

async function createModel(
  viewer: HTMLPerspectiveViewerElement,
  table: Table,
): Promise<Model> {
  const size = await table.size()
  return {
    rotateThemes: async () => {
      const settings = await viewer?.save()
      // @ts-expect-error `ViewConfig` type doesn't have `theme`
      const themeIndex = themes.findIndex((t) => t === settings?.theme)
      const theme = themeIndex === themes.length - 1 ? themes[0] : themes[themeIndex + 1]
      viewer?.restore({ theme } as ViewConfig)
    },
    size,
    toggleConfig: () => viewer?.toggleConfig(),
  }
}

function useModel(
  viewer: HTMLPerspectiveViewerElement | null,
  table: Table | Error | null,
) {
  const [model, setModel] = React.useState<Model | null>(null)
  const [error, setError] = React.useState<Error | null>(null)

  const init = React.useCallback(async (): Promise<Model | null> => {
    if (!table || !viewer) return null
    if (table instanceof Error) {
      throw table
    }
    return createModel(viewer, table)
  }, [viewer, table])

  React.useEffect(() => {
    init()
      .then(setModel)
      .catch((e) => {
        setError(e)
        Log.error(e)
      })
  }, [init])

  if (error) {
    throw error
  }

  return model
}

function useViewer(anchorEl: HTMLDivElement | null, className: string) {
  const [viewer, setViewer] = React.useState<HTMLPerspectiveViewerElement | null>(null)

  React.useEffect(() => {
    if (!anchorEl) return

    const element = document.createElement('perspective-viewer')
    // NOTE: safari needs `.perspective-viewer-material` instead of custom tagName
    element.className = cx('perspective-viewer-material', className)
    anchorEl.appendChild(element)

    setViewer(element)

    return () => {
      element.parentNode?.removeChild(element)
      element.delete()
    }
  }, [anchorEl, className])

  return viewer
}

function useTable(viewer: HTMLPerspectiveViewerElement | null, data: PerspectiveInput) {
  const [table, setTable] = React.useState<Table | Error | null>(null)
  React.useEffect(() => {
    let tbl: Table | null = null

    async function renderTable() {
      if (!viewer) return

      tbl = await worker.table(data)
      await viewer.load(tbl)
      setTable(tbl)
    }

    renderTable().catch((e) => {
      setTable(e instanceof Error ? e : new Error(e.message || `${e}`))
    })

    return () => {
      tbl?.delete()
      tbl = null
    }
  }, [data, viewer])
  return table
}

function useRestoreConfig(
  viewer: HTMLPerspectiveViewerElement | null,
  config?: ViewConfig,
) {
  React.useEffect(() => {
    if (!config || !viewer) return
    viewer.restore(config)
  }, [config, viewer])
}

function useListenOnRender(
  viewer: HTMLPerspectiveViewerElement | null,
  onRender?: (tableEl: RegularTableElement) => void,
) {
  React.useEffect(() => {
    if (!viewer) return

    const regularTable: RegularTableElement | null = viewer.querySelector('regular-table')

    if (!onRender || !regularTable?.addStyleListener) return

    onRender(regularTable)
    regularTable.addStyleListener(({ detail }) => onRender(detail))
  }, [onRender, viewer])
}

function usePerspective(
  anchorEl: HTMLDivElement | null,
  data: PerspectiveInput,
  className: string,
  config?: ViewConfig,
  onRender?: (tableEl: RegularTableElement) => void,
) {
  const viewer = useViewer(anchorEl, className)
  const table = useTable(viewer, data)

  useRestoreConfig(viewer, config)
  useListenOnRender(viewer, onRender)

  return useModel(viewer, table)
}

export const use = usePerspective
