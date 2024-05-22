import * as React from 'react'
import * as M from '@material-ui/core'

import defer from 'utils/defer'
import type { Resolver } from 'utils/defer'

type DialogState = 'open' | 'closing' | 'closed'

type ExtraDialogProps = Omit<M.DialogProps, 'open' | 'onClose' | 'onExited'>

export type Close<R> = [R] extends [never] ? () => void : Resolver<R>['resolve']

type Render<R> = (props: { close: Close<R> }) => JSX.Element

interface Dialog {
  render: Render<any>
  props?: ExtraDialogProps
  resolver: Resolver<any>
}

export const useDialogs = () => {
  const [state, setState] = React.useState<DialogState>('closed')
  const [dialog, setDialog] = React.useState<Dialog | null>(null)

  const open = React.useCallback(
    <R = never,>(render: Render<R>, props?: ExtraDialogProps) => {
      const { resolver, promise } = defer<R>()
      setDialog({ render, props, resolver })
      setState('open')
      return promise
    },
    [setDialog, setState],
  )

  const close = React.useCallback(
    (reason: any) => {
      if (dialog) dialog.resolver.resolve(reason)
      setState('closing')
    },
    [setState, dialog],
  )

  const cleanup = React.useCallback(() => {
    if (state === 'closing') {
      setState('closed')
      setDialog(null)
    }
  }, [state, setState, setDialog])

  const render = (props?: ExtraDialogProps) => (
    <M.Dialog
      open={state === 'open'}
      onClose={close}
      onExited={cleanup}
      {...props}
      {...dialog?.props}
    >
      {dialog ? dialog.render({ close }) : ''}
    </M.Dialog>
  )

  return { open, render }
}

export const use = useDialogs

export type Dialogs = ReturnType<typeof use>
