import * as React from 'react'

const Ctx = React.createContext({})

function EmbedConfigProvider({ config, children }) {
  return <Ctx.Provider value={config}>{children}</Ctx.Provider>
}

function useEmbedConfig() {
  return React.useContext(Ctx)
}

export { EmbedConfigProvider as Provider, useEmbedConfig as use }
