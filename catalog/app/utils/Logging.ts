import * as Eff from 'effect'
import log from 'loglevel'

const defaultLevel = process.env.NODE_ENV === 'development' ? 'trace' : 'info'
// Use setDefaultLevel() instead of setLevel() here to allow developers or users
// overriding log level by running Log.setLevel(lvl) in the console for
// debug / development purposes (reset it back to default with Log.resetLevel()).
// For details see loglevel docs at https://github.com/pimterry/loglevel
log.setDefaultLevel(defaultLevel)

// expose logger instance to allow changing log levels via console
;(window as any).Log = log

export default log

export interface ScopeConfig {
  name: string
  enter?: unknown[]
}

const normalizeScopeConfig = (cfg: ScopeConfig | string): ScopeConfig =>
  typeof cfg === 'string' ? { name: cfg } : cfg

const logExit = Eff.Exit.match({
  onSuccess: <A>(a: A) => Eff.Effect.log('exit: success', br, a),
  onFailure: <E>(cause: Eff.Cause.Cause<E>) =>
    Eff.Effect.log(`exit: failure (${cause._tag})`, br, Eff.Cause.pretty(cause)),
})

export function scoped(cfg: ScopeConfig | string) {
  // TODO: accept annotations?
  const config = normalizeScopeConfig(cfg)
  return <A, E, R>(eff: Eff.Effect.Effect<A, E, R>) =>
    Eff.pipe(
      Eff.Effect.log('enter', ...(config.enter ?? [])),
      Eff.Effect.andThen(eff),
      // TODO: wait for scope to close (causing span to end)
      Eff.Effect.onExit(logExit),
      Eff.Effect.withSpan(config.name, { attributes: {} }),
      Eff.Effect.scoped,
      // change the default log level used by Effect.log
      Eff.LogLevel.locally(Eff.LogLevel.Debug),
    )
}

export const scopedFn =
  (cfg: ScopeConfig | string) =>
  <Args extends any[], A, E, R>(fn: (...args: Args) => Eff.Effect.Effect<A, E, R>) =>
  (...args: Args) =>
    scoped({ enter: [br, 'args:', args], ...normalizeScopeConfig(cfg) })(fn(...args))

// XXX: tracerLogger dies when encountering a symbol
// export const br = Symbol('br')
export const br = { _tag: 'br' }

const logLevelCss: Record<Eff.LogLevel.LogLevel['_tag'], string> = {
  None: '',
  All: '',
  Trace: 'color: grey;',
  Debug: 'color: blue;',
  Info: 'color: green;',
  Warning: 'color: yellow;',
  Error: 'color: red;',
  Fatal: 'color: white; background-color: red;',
}

// order: parent -> child
const getSpanStack = (so: Eff.Option.Option<Eff.Tracer.AnySpan>): Eff.Tracer.AnySpan[] =>
  Eff.Array.reverse(
    Eff.Array.unfold(
      so,
      Eff.Option.map((s): [Eff.Tracer.AnySpan, Eff.Option.Option<Eff.Tracer.AnySpan>] =>
        s._tag === 'Span' ? [s, s.parent] : [s, Eff.Option.none()],
      ),
    ),
  )

const getSpanDisplayName = (s: Eff.Tracer.AnySpan) =>
  s._tag === 'Span' ? s.name : 'EXTERNAL'

const bigint1m = BigInt(1_000_000)

const toMs = (n: bigint) => Number(n / bigint1m)

const getSpanStatusDisplay = (s: Eff.Tracer.AnySpan, now: number) => {
  if (s._tag === 'ExternalSpan') return 'external'
  if (s.status._tag === 'Started')
    return `running for ${now - toMs(s.status.startTime)}ms`
  if (s.status._tag === 'Ended')
    return `ended after ${toMs(s.status.endTime - s.status.startTime)}ms`
  return Eff.absurd<never>(s.status)
}

const getParentSpan = Eff.flow(
  Eff.FiberRefs.get(Eff.FiberRef.currentContext),
  Eff.Option.flatMap(Eff.Context.getOption(Eff.Tracer.ParentSpan)),
)

// borrowed from effect, adapted for browser console
export const consolePrettyLogger = Eff.Logger.make(
  ({ annotations, cause, context, date, fiberId, logLevel, message, spans }) => {
    const console = globalThis.console

    const args = Eff.Array.ensure(message)
    // split args into lines at `br` separators
    const [firstLine, ...lines] = Eff.pipe(
      args,
      Eff.Array.reduce(Eff.Array.of(Eff.Array.empty<unknown>()), (acc, arg) =>
        arg === br
          ? Eff.Array.append(acc, [])
          : Eff.Array.modifyNonEmptyLast(acc, Eff.Array.append(arg)),
      ),
      Eff.Array.filter(Eff.Array.isNonEmptyArray),
    )

    const span = getParentSpan(context)
    const spanStack = getSpanStack(span).map(getSpanDisplayName).join(' > ')

    let prefix = Eff.FiberId.threadName(fiberId)
    if (spanStack) prefix = `${prefix} ${spanStack}`
    const prefixStyled = [
      '%c%s',
      `${logLevelCss[logLevel._tag]} font-weight: lighter;`,
      prefix,
    ]

    console.groupCollapsed(...prefixStyled, ...firstLine)

    if (!Eff.Cause.isEmpty(cause)) {
      console.error(Eff.Cause.pretty(cause, { renderErrorCause: true }))
    }

    for (const line of lines) console.log(...line)

    if (Eff.HashMap.size(annotations) > 0) {
      for (const [key, value] of annotations) {
        console.log(`${key}:`, value)
      }
    }

    const now = date.getTime()

    if (Eff.List.isCons(spans)) {
      console.groupCollapsed('spans:')
      for (const s of spans) {
        console.log(`${s.label}: ${now - s.startTime}ms`)
      }
      console.groupEnd()
    }

    if (span._tag === 'Some') {
      console.groupCollapsed(
        `span: ${spanStack} %c${getSpanStatusDisplay(span.value, now)}`,
        'color: grey; font-weight: lighter;',
      )
      console.log(span.value)
      console.groupEnd()
    }

    console.groupEnd()
  },
)
