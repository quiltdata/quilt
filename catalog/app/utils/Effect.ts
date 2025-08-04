import * as Eff from 'effect'

import * as Log from 'utils/Logging'

const LOG_LEVEL =
  process.env.NODE_ENV === 'development' ? Eff.LogLevel.Trace : Eff.LogLevel.Info

const appLayer = Eff.pipe(
  Eff.Logger.replace(Eff.Logger.defaultLogger, Log.consolePrettyLogger),
  Eff.Layer.provide(Eff.Logger.minimumLogLevel(LOG_LEVEL)),
)

export const runtime = Eff.ManagedRuntime.make(appLayer)
