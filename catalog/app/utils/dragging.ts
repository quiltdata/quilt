import * as React from 'react'

export default function useDragging() {
  const [isDragActive, setDragActive] = React.useState(false)

  const setActive = React.useCallback(() => setDragActive(true), [])
  const setInactive = React.useCallback(() => setDragActive(false), [])

  React.useEffect(() => {
    document.addEventListener('dragover', setActive)
    document.addEventListener('dragleave', setInactive)
    document.addEventListener('drop', setInactive)

    return () => {
      document.removeEventListener('dragover', setActive)
      document.removeEventListener('dragleave', setInactive)
      document.removeEventListener('drop', setInactive)
    }
  }, [setActive, setInactive])

  return isDragActive
}
