const assert = require('assert')
const path = require('path')

const graphql = require('graphql')
const R = require('ramda')
const nearOperationFilePreset = require('@graphql-codegen/near-operation-file-preset')
const tsPlugin = require('@graphql-codegen/typescript')
const tsOpsPlugin = require('@graphql-codegen/typescript-operations')
const typedDocumentNodePlugin = require('@graphql-codegen/typed-document-node')
const urqlIntrospectionPlugin = require('@graphql-codegen/urql-introspection')

async function schemaIntrospectionPlugin(schema, documents, config, info) {
  return urqlIntrospectionPlugin.plugin(
    schema,
    documents,
    {
      useTypeImports: true,
      includeScalars: true,
      ...config,
    },
    info,
  )
}

const baseTSConfig = {
  avoidOptionals: true,
  declarationKind: 'interface',
  immutableTypes: true,
  namingConvention: 'keep',
  nonOptionalTypename: true,
  strictScalars: true,
  useTypeImports: true,
}

async function baseTypesPlugin(schema, documents, config, info) {
  return tsPlugin.plugin(schema, documents, { ...baseTSConfig, ...config }, info)
}

function generateOperationName({ location, baseDir }) {
  const relPath = path.relative(baseDir, location)
  const parsed = path.parse(relPath)
  const dirSegments = parsed.dir.split(path.sep)
  const value = [...dirSegments, parsed.name].join('_')
  return { kind: 'Name', value }
}

const tsOpsConfig = {
  ...baseTSConfig,
  arrayInputCoercion: false,
  onlyOperationTypes: true,
}

async function operationPlugin(schema, documents, config, info) {
  assert(
    documents.length === 1,
    'only one operation file per plugin invocation supported',
  )
  const [doc] = documents

  let defaultExport = null

  const visitor = {
    OperationDefinition: (node) => {
      assert(!defaultExport, 'only one operation per file supported')
      const adjusted = R.evolve(
        {
          name: R.defaultTo(generateOperationName({ ...doc, baseDir: config.baseDir })),
        },
        node,
      )
      defaultExport = `${adjusted.name.value}Document`
      return adjusted
    },
  }

  const visitDocument = (d) => graphql.visit(d, { leave: visitor })
  const adjustedDoc = R.evolve({ document: visitDocument }, doc)

  const [tsOpsResult, typedDocumentNodeResult] = await Promise.all(
    [tsOpsPlugin, typedDocumentNodePlugin].map((p) =>
      p.plugin(schema, [adjustedDoc], { ...tsOpsConfig, ...config }, info),
    ),
  )

  return {
    prepend: [
      '/* eslint-disable @typescript-eslint/naming-convention */',
      ...(tsOpsResult.prepend || []),
      ...(typedDocumentNodeResult.prepend || []),
    ],
    content: [tsOpsResult.content, typedDocumentNodeResult.content].join('\n'),
    append: [defaultExport ? `\nexport { ${defaultExport} as default }` : ''],
  }
}

const modes = {
  introspection: schemaIntrospectionPlugin,
  base: baseTypesPlugin,
  operation: operationPlugin,
}

async function plugin(schema, documents, { mode, ...config }, info) {
  assert(
    mode in modes,
    `invalid mode "${mode}", must be one of: ${Object.keys(modes).join(', ')}`,
  )
  return modes[mode](schema, documents, config, info)
}

async function buildGeneratesSection(options) {
  const { baseTypesPath, schemaIntrospectionPath } = options.presetConfig
  assert(baseTypesPath, 'baseTypesPath must be set in presetConfig')
  assert(schemaIntrospectionPath, 'schemaIntrospectionPath must be set in presetConfig')
  const cwd = options.presetConfig.cwd || process.cwd()
  const baseDir = path.resolve(cwd, options.baseOutputDir)

  return [
    {
      ...options,
      filename: path.resolve(options.baseOutputDir, schemaIntrospectionPath),
      config: { ...options.config, mode: 'introspection' },
    },
    {
      ...options,
      filename: path.resolve(options.baseOutputDir, baseTypesPath),
      config: { ...options.config, mode: 'base' },
    },
    ...nearOperationFilePreset.preset.buildGeneratesSection({
      ...options,
      presetConfig: { baseTypesPath: options.presetConfig.baseTypesPath },
      config: { ...options.config, mode: 'operation', baseDir },
    }),
  ]
}

module.exports = { plugin, preset: { buildGeneratesSection } }
