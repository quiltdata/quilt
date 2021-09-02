import { parse } from 'querystring'

export default (search: string) => parse(search.replace(/^\?/, ''))
