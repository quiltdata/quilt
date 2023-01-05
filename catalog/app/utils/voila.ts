import cfg from 'constants/config'
import * as Cache from 'utils/ResourceCache'

const VoilaResource = Cache.createResource({
  name: 'Voila',
  persist: true,
  fetch: () =>
    fetch(`${cfg.registryUrl}/voila/`)
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
  return Cache.useData(VoilaResource, null, { suspend: true })
}

export { useVoila as use }
