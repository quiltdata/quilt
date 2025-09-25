import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import cfg from 'constants/config'
import { mkFormError } from 'utils/formTools'

export const MAX_UPLOAD_SIZE = 20 * 1000 * 1000 * 1000 // 20GB
// XXX: keep in sync w/ the backend
// NOTE: these limits are lower than the actual "hard" limits on the backend
export const MAX_S3_SIZE = cfg.chunkedChecksums
  ? 5 * 10 ** 12 // 5 TB
  : 50 * 10 ** 9 // 50 GB
export const MAX_FILE_COUNT = 1000

export function useCryptoApiValidation() {
  return React.useCallback(
    () =>
      !!window.crypto?.subtle?.digest
        ? {}
        : mkFormError(
            'Quilt requires the Web Cryptography API. Please try another browser.',
          ),

    [],
  )
}

export function calcDialogHeight(windowHeight: number, metaHeight: number): number {
  const neededSpace = 345 /* space to fit other inputs */ + metaHeight
  const availableSpace = windowHeight - 200 /* free space for headers */
  const minimalSpace = 420 /* minimal height */
  if (availableSpace < minimalSpace) return minimalSpace
  return R.clamp(minimalSpace, availableSpace, neededSpace)
}

export const useContentStyles = M.makeStyles({
  root: {
    height: ({ metaHeight }: { metaHeight: number }) =>
      calcDialogHeight(window.innerHeight, metaHeight),
    paddingTop: 0,
  },
})

interface DialogWrapperProps {
  exited: boolean
}

export function DialogWrapper({
  exited,
  ...props
}: DialogWrapperProps & React.ComponentProps<typeof M.Dialog>) {
  const refProps = { exited, onExited: props.onExited }
  const ref = React.useRef<typeof refProps>()
  ref.current = refProps
  React.useEffect(
    () => () => {
      // call onExited on unmount if it has not been called yet
      if (!ref.current!.exited && ref.current!.onExited)
        (ref.current!.onExited as () => void)()
    },
    [],
  )
  return <M.Dialog {...props} />
}
