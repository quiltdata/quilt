import { mapProps } from 'recompose';
import omit from 'lodash/omit';
import pick from 'lodash/pick';


export const saveProps = ({ key = '_originalProps', keep = [] }) =>
  mapProps((props) => ({ ...pick(props, keep), [key]: omit(props, keep) }));

export const restoreProps = ({ key = '_originalProps', keep = [] }) =>
  mapProps(({ [key]: original = {}, ...props }) =>
    ({ ...original, ...pick(props, keep) }));
