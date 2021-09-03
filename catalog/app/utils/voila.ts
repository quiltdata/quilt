import * as Config from 'utils/Config'
import * as Cache from 'utils/ResourceCache'

const VOILA_PING_URL = (registryUrl: string) => `${registryUrl}/voila/`

const VoilaResource = Cache.createResource({
  name: 'Voila',
  persist: true,
  fetch: (registryUrl: string) =>
    fetch(VOILA_PING_URL(registryUrl))
      .then((resp) => resp.ok)
      .catch(() => false)
      .then((r) => {
        if (!r) {
          // eslint-disable-next-line no-console
          console.debug('Voila is not supported by current stack')
          // TODO: add link to documentation
        }
        return r
      }),
})

export function useVoila(): boolean {
  const { registryUrl } = Config.use()
  return Cache.useData(VoilaResource, registryUrl, { suspend: true })
}

export { useVoila as use }
