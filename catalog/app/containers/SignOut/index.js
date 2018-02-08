import { connect } from 'react-redux';
import { compose, lifecycle, withProps } from 'recompose';
import Redirect from 'components/Redirect';
import { makeSignOutURL } from 'utils/auth';
import { signOut } from 'containers/App/actions';


export default compose(
  connect(),
  lifecycle({
    componentWillMount() {
      this.props.dispatch(signOut());
    },
  }),
  withProps({ url: makeSignOutURL() }),
)(Redirect);
