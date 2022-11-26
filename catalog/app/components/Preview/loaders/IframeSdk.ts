import type { JsonRecord } from 'utils/types'

// TOOD: get-file-url, find-file-url
type EventName = 'list-files' | 'fetch-file' | 'find-file'

export function requestEvent(eventName: EventName, payload?: JsonRecord) {
  const EVENT_NAMESPACE = 'quilt-iframe-request'

  return new Promise((resolve, reject) => {
    try {
      window.addEventListener(
        'message',
        (event) => {
          const { name, data } = event.data
          if (name !== `${EVENT_NAMESPACE}-${eventName}`) return
          resolve(data)
        },
        { once: true },
      )
      window?.top?.postMessage({
        name: `${EVENT_NAMESPACE}-${eventName}`,
        payload,
      })
    } catch (error) {
      reject(error)
    }
  })
}
