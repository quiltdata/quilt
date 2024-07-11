import * as Eff from 'effect'

const filterKeyName = (key: string) => key.replace(/[\s="]/g, '_')

const renderLogSpanLogfmt =
  (now: number) =>
  (self: Eff.LogSpan.LogSpan): string => {
    const label = filterKeyName(self.label)
    return `${label}=${now - self.startTime}ms`
  }

const structuredMessage = (u: unknown): unknown => {
  switch (typeof u) {
    case 'bigint':
    case 'function':
    case 'symbol': {
      return String(u)
    }
    default: {
      return u
    }
  }
}

// borrowed from effect, adapted for browser console
const consolePrettyLogger = Eff.Logger.make(
  ({
    annotations,
    cause,
    context,
    date,
    fiberId,
    logLevel,
    message: message_,
    spans,
  }) => {
    const services = Eff.FiberRefs.getOrDefault(
      context,
      Eff.DefaultServices.currentServices,
    )
    const console = Eff.Context.get(services, Eff.Console.Console).unsafe

    const message = Eff.Array.ensure(message_)

    let firstLine = `${logLevel.label} (${Eff.FiberId.threadName(fiberId)})`

    if (Eff.List.isCons(spans)) {
      const now = date.getTime()
      const render = renderLogSpanLogfmt(now)
      for (const span of spans) {
        firstLine += ` ${render(span)}`
      }
    }

    firstLine += ':'
    let messageIndex = 0
    if (message.length > 0) {
      const firstMaybeString = structuredMessage(message[0])
      if (typeof firstMaybeString === 'string') {
        firstLine += ` ${firstMaybeString}`
        messageIndex++
      }
    }

    console.groupCollapsed(firstLine)

    if (!Eff.Cause.isEmpty(cause)) {
      console.error(Eff.Cause.pretty(cause, { renderErrorCause: true }))
    }

    if (messageIndex < message.length) {
      for (; messageIndex < message.length; messageIndex++) {
        console.log(message[messageIndex])
      }
    }

    if (Eff.HashMap.size(annotations) > 0) {
      for (const [key, value] of annotations) {
        console.log(`${key}:`, value)
      }
    }
    console.groupEnd()
  },
)

const loggerLayer = Eff.Logger.replace(Eff.Logger.defaultLogger, consolePrettyLogger)

export const runtime = Eff.ManagedRuntime.make(loggerLayer)
