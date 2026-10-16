export default function saveAs(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // Not synchronously: clicking only queues the download, and revoking the URL
  // before the browser reads the blob cancels it in some of them.
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
