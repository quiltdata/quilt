import yaml from 'js-yaml'

export default function parseYaml(inputStr) {
  try {
    return yaml.safeLoad(inputStr, 'utf8')
  } catch (error) {
    console.error(error)
    return ''
  }
}
