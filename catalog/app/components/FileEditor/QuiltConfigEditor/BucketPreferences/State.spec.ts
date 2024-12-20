import { parse, stringify } from './State'

describe('components/FileEditor/QuiltConfigEditor/BucketPreferences/State', () => {
  describe('stringify', () => {
    it('should stringify a config object', () => {
      const config = parse('', {})
      config['ui.nav.files'] = {
        isDefault: false,
        key: 'ui.nav.files',
        value: true,
      }
      expect(stringify(config)).toBe(JSON.stringify({ ui: { nav: { files: true } } }))
    })
  })
})
