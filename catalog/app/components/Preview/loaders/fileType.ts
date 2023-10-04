// TODO: consider to use:
//       text/html
//       application/vnd.quilt.echarts
//       application/vnd.quilt.perspective
//       etc.
//       But we need conversion from content-type to summarize type then,
//       or update summarize spec
enum FileType {
  ECharts = 'echarts',
  Html = 'html',
  Igv = 'igv',
  Json = 'json',
  Jupyter = 'jupyter',
  Markdown = 'markdown',
  Ngl = 'ngl',
  Tabular = 'perspective',
  Text = 'txt',
  Vega = 'vega',
  Voila = 'voila',
}
export default FileType
