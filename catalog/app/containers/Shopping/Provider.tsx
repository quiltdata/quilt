import * as React from 'react'

import * as S3FilePicker from 'containers/Bucket/PackageDialog/S3FilePicker'

interface Shopping {
  entries: Record<string, S3FilePicker.S3File>
}

const Ctx = React.createContext<
  [Shopping | null, React.Dispatch<React.SetStateAction<Shopping>>]
>([null, () => null])

const shopping: Shopping = {
  entries: {},
}

interface ProviderProps {
  children: React.ReactNode
}

export function Provider({ children }: ProviderProps) {
  const [value, setValue] = React.useState(shopping)
  return <Ctx.Provider value={[value, setValue]}>{children}</Ctx.Provider>
}

export const useShopping = () => React.useContext(Ctx)

export const use = useShopping
