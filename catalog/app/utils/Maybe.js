import tagged from 'utils/tagged'

const Maybe = tagged(['Nothing', 'Just'])

Maybe.from = (v) => (v == null ? Maybe.Nothing() : Maybe.Just(v))

export default Maybe
