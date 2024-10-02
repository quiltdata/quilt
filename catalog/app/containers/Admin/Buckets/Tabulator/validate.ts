import * as FF from 'final-form'

import tabulatorTableSchema from 'schemas/tabulatorTable.yml.json'

import { JsonInvalidAgainstSchema } from 'utils/error'
import { makeSchemaValidator } from 'utils/json-schema'
import * as yaml from 'utils/yaml'

const validateTable: FF.FieldValidator<string> = (inputStr?: string) => {
  try {
    const data = yaml.parse(inputStr)
    const validator = makeSchemaValidator(tabulatorTableSchema)
    const errors = validator(data)
    if (errors.length) {
      return new JsonInvalidAgainstSchema({ errors }).message
    }
    return undefined
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    return 'invalid'
  }
}

export default validateTable
