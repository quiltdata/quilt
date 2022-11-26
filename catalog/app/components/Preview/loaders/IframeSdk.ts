import type { JsonRecord } from 'utils/types'

type EventName = 'list-files' | 'get-file-url' | 'find-file-url'

export const EVENT_NAME: Record<string, EventName> = {
  FIND_FILE_URL: 'find-file-url',
  GET_FILE_URL: 'get-file-url',
  LIST_FILES: 'list-files',
}

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
