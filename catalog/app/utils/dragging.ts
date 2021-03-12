import * as React from 'react'

export default function useDragging() {
  const [isDragActive, setDragActive] = React.useState(false)

  React.useEffect(() => {
    document.addEventListener('dragover', () => {
      setDragActive(true)
    })
    document.addEventListener('dragleave', () => {
      setDragActive(false)
    })
    document.addEventListener('drop', () => {
      setDragActive(false)
    })
  }, [])

  return isDragActive
}
