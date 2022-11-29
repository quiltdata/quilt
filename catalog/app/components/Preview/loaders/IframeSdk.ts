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
    const eventId = `quilt-event-id-${(window as any).counter++}`
    const handler = (event: MessageEvent) => {
      const { id, data } = event.data
      if (id !== eventId) return
      window.removeEventListener('message', handler)
      resolve(data)
    }
    try {
      window.addEventListener('message', handler)
      window?.top?.postMessage({
        id: eventId,
        name: `${EVENT_NAMESPACE}-${eventName}`,
        payload,
      })
    } catch (error) {
      reject(error)
    }
  })
}
