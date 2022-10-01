import yaml from 'js-yaml'

// eslint-disable-next-line consistent-return
export default function parseYaml(inputStr?: string) {
  if (!inputStr) return undefined
  try {
    return yaml.load(inputStr)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
  }
}
