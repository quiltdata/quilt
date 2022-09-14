const defaultResult = false
let overrideResult: boolean | null = null

export function override(value: boolean) {
  overrideResult = value
}

export function reset() {
  overrideResult = null
}

export function useVoila() {
  return overrideResult ?? defaultResult
}

export { useVoila as use }
