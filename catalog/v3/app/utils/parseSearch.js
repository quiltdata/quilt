import { parse } from 'querystring'

export default (search) => parse(search.replace(/^\?/, ''))
