import yaml from 'js-yaml'

// eslint-disable-next-line consistent-return
export default function parseYaml(inputStr) {
  try {
    return yaml.safe_load(inputStr, 'utf8')
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
  }
}
