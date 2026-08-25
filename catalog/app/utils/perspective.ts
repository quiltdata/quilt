import cx from 'classnames'
import * as React from 'react'

import type { RegularTableElement } from 'regular-table'
import perspective from '@finos/perspective'
import type { Table, TableData, ViewConfig } from '@finos/perspective'
import type { HTMLPerspectiveViewerElement } from '@finos/perspective-viewer'

import log from 'utils/Logging'
import { themes } from 'utils/perspective-pollution'

export interface State {
  rotateThemes: () => void
  size: number | null
  toggleConfig: () => void
}

export type PerspectiveInput = TableData

const worker = perspective.worker()

export function renderViewer(
  parentNode: HTMLElement,
  { className }: React.HTMLAttributes<HTMLDivElement>,
): HTMLPerspectiveViewerElement {
  const element = document.createElement('perspective-viewer')
  // NOTE: safari needs `.perspective-viewer-material` instead of custom tagName
  element.className = cx('perspective-viewer-material', className)
  parentNode.appendChild(element)
  return element
}

export async function renderTable(
  data: PerspectiveInput,
  viewer: HTMLPerspectiveViewerElement,
) {
  const table = await worker.table(data)
  await viewer.load(table)
  return table
}

function listenOnRender(
  viewer: HTMLPerspectiveViewerElement,
  onRender?: (tableEl: RegularTableElement) => void,
) {
  const regularTable: RegularTableElement | null = viewer.querySelector('regular-table')
  if (!onRender || !regularTable?.addStyleListener) return
  onRender(regularTable)
  regularTable.addStyleListener(({ detail }) => onRender(detail))
}

function mkRotateThemes(viewer: HTMLPerspectiveViewerElement) {
  return async () => {
    const settings = await viewer.save()
    // @ts-expect-error `ViewConfig` type doesn't have `theme`
    const themeIndex = themes.findIndex((t) => t === settings?.theme)
    const theme = themeIndex === themes.length - 1 ? themes[0] : themes[themeIndex + 1]
    viewer.restore({ theme } as ViewConfig)
  }
}

async function mkState(
  viewer: HTMLPerspectiveViewerElement,
  table: Table,
): Promise<State> {
  return {
    rotateThemes: mkRotateThemes(viewer),
    size: await table.size(),
    toggleConfig: () => viewer.toggleConfig(),
  }
}

async function disposeViewer(
  viewer: HTMLPerspectiveViewerElement | null,
  table: Table | null,
) {
  viewer?.parentNode?.removeChild(viewer)
  await viewer?.delete()
  await table?.delete()
}

function usePerspective(
  container: HTMLDivElement | null,
  data: PerspectiveInput,
  attrs: React.HTMLAttributes<HTMLDivElement>,
  config?: ViewConfig,
  onRender?: (tableEl: RegularTableElement) => void,
) {
  const [state, setState] = React.useState<State | Error | null>(null)

  React.useEffect(() => {
    // NOTE(@fiskus): if you want to refactor, don't try `useRef`, try something different
    let table: Table | null = null
    let viewer: HTMLPerspectiveViewerElement | null = null
    // NOTE: `data` is a dep, so "Load more" re-runs this effect. Without the
    //       flag, the aborted run's outcome would land on the run that replaced
    //       it -- an error over a preview that is loading fine.
    let cancelled = false

    async function renderData() {
      if (!container) return

      viewer = renderViewer(container, attrs)
      table = await renderTable(data, viewer)

      listenOnRender(viewer, onRender)

      if (config) {
        await viewer.restore(config)
      }

      const next = await mkState(viewer, table)
      if (cancelled) return
      setState(next)
    }

    // NOTE: catch the whole thing, not just the load: `restore(config)`,
    //       `size()` and `onRender` reject too, and an unhandled rejection here
    //       leaves the preview blank with nothing to show for it
    renderData().catch((e) => {
      if (cancelled) return
      const error = e instanceof Error ? e : new Error((e as any).message || `${e}`)
      setState(error)
      log.error(error)
    })

    return () => {
      cancelled = true
      disposeViewer(viewer, table)
    }
  }, [attrs, config, container, data, onRender])

  // NOTE: rethrow during render, because errors raised inside the async effect
  //       above never reach the enclosing `ErrorBoundary` on their own
  if (state instanceof Error) throw state

  return state
}

export const use = usePerspective
