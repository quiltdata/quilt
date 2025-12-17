import cx from 'classnames'
import * as React from 'react'

import type { RegularTableElement } from 'regular-table'
import perspective from '@finos/perspective'
import type { Table, TableData, ViewConfig } from '@finos/perspective'
import type { HTMLPerspectiveViewerElement } from '@finos/perspective-viewer'

import { themes } from 'utils/perspective-pollution'

export type PerspectiveInput = TableData

const worker = perspective.worker()

export type Model =
  | { _tag: 'idle' }
  | {
      _tag: 'ready'
      rotateThemes: () => void
      size: number | null
      toggleConfig: () => void
    }
  | { _tag: 'error'; error: Error }

async function createModel(
  viewer: HTMLPerspectiveViewerElement,
  table: Table,
): Promise<Extract<Model, { _tag: 'ready' }>> {
  const size = await table.size()
  return {
    _tag: 'ready',
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
  const [state, setState] = React.useState<Model>({ _tag: 'idle' })

  const init = React.useCallback((): Promise<Model> => {
    if (!table || !viewer) return Promise.resolve({ _tag: 'idle' })
    if (table instanceof Error) return Promise.reject(table)
    return createModel(viewer, table)
  }, [viewer, table])

  React.useEffect(() => {
    init()
      .then(setState)
      .catch((error) => setState({ _tag: 'error', error }))
  }, [init])

  return state
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
    if (!viewer) return

    let tbl: Table | null = null
    worker
      .table(data)
      .then(async (t) => {
        await viewer.load(t)
        tbl = t
        return t
      })
      .then(setTable)
      .catch(setTable)

    return () => {
      tbl?.delete()
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
