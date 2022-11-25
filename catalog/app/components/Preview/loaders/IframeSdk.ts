import type { JsonRecord } from 'utils/types'

type EventName = 'list-files' | 'fetch-file'

export function requestEvent(eventName: EventName, payload?: JsonRecord) {
  const EVENT_NAMESPACE = 'quilt-iframe-request'

  return new Promise((resolve, reject) => {
    try {
      window.addEventListener('message', (event) => {
        const { name, data } = event.data
        if (name !== `${EVENT_NAMESPACE}-${eventName}`) return
        resolve(data)
      })
      window?.top?.postMessage({
        name: `${EVENT_NAMESPACE}-${eventName}`,
        payload,
      })
    } catch (error) {
      reject(error)
    }
  })
}
