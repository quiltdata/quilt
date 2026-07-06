import * as React from 'react'

export default function useDragging() {
  const [dragCounter, setDragCounter] = React.useState(0)
  const isDragActive = dragCounter > 0

  React.useEffect(() => {
    const handleDragEnter = (event: DragEvent) => {
      event.preventDefault()
      if (event.dataTransfer?.types && event.dataTransfer.types.includes('Files')) {
        setDragCounter((count) => count + 1)
      }
    }

    const handleDragLeave = (event: DragEvent) => {
      event.preventDefault()

      if (!event.relatedTarget) {
        setDragCounter(0)
        return
      }

      setDragCounter((count) => Math.max(0, count - 1))
    }

    const handleDragOver = (event: DragEvent) => {
      event.preventDefault()
    }

    const handleDrop = (event: DragEvent) => {
      event.preventDefault()
      setDragCounter(0)
    }

    const handleDragEnd = () => {
      setDragCounter(0)
    }

    document.addEventListener('dragenter', handleDragEnter)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('drop', handleDrop)
    document.addEventListener('dragend', handleDragEnd)

    return () => {
      document.removeEventListener('dragenter', handleDragEnter)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('drop', handleDrop)
      document.removeEventListener('dragend', handleDragEnd)
    }
  }, [])

  return isDragActive
}
