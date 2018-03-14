import invoke from 'lodash/fp/invoke';
import {
  Table,
  TableBody,
  TableHeader,
  TableHeaderColumn,
  TableRow,
  TableRowColumn,
} from 'material-ui/Table';
import PT from 'prop-types';
import React, { Fragment } from 'react';
import { FormattedMessage as FM, injectIntl } from 'react-intl';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import { lifecycle, setPropTypes } from 'recompose';

import { withPagination } from 'components/Pagination';
import Spinner from 'components/Spinner';
import Badge from 'components/VisibilityIcon';
import api, { apiStatus } from 'constants/api';
import { composeComponent } from 'utils/reactTools';
import { injectReducer } from 'utils/ReducerInjector';
import { injectSaga } from 'utils/SagaInjector';

import { formatActivity, ActivityLink } from '../Activity';
import ErrorMessage from '../ErrorMessage';
import { formatDate } from '../util';
import * as actions from './actions';
import { REDUX_KEY } from './constants';
import msg from './messages';
import reducer from './reducer';
import saga from './saga';
import selector from './selectors';


const packageActivities = [
  'installs',
  'previews',
];

const PackagesTable = composeComponent('Admin.Packages.Table',
  injectIntl,
  setPropTypes({
    packages: PT.arrayOf( // eslint-disable-line function-paren-newline
      PT.shape({
        handle: PT.string.isRequired,
        lastModified: PT.number,
        deletes: PT.number.isRequired,
      }).isRequired,
    ).isRequired, // eslint-disable-line function-paren-newline
    intl: PT.shape({
      formatMessage: PT.func.isRequired,
    }).isRequired,
  }),
  withPagination({
    key: 'packages',
    getItemId: (p) => p.handle,
  }),
  ({
    packages,
    intl: { formatMessage },
    pagination,
  }) => (
    <Fragment>
      <Table selectable={false}>
        <TableHeader adjustForCheckbox={false} displaySelectAll={false}>
          <TableRow>
            <TableHeaderColumn><FM {...msg.handle} /></TableHeaderColumn>
            <TableHeaderColumn><FM {...msg.activity} /></TableHeaderColumn>
            <TableHeaderColumn><FM {...msg.lastModified} /></TableHeaderColumn>
          </TableRow>
        </TableHeader>
        <TableBody displayRowCheckbox={false} showRowHover>
          {packages.length
            // eslint-disable-next-line object-curly-newline
            ? packages.map(({ handle, lastModified, deletes, ...activity }) => (
              <TableRow key={handle}>
                <TableRowColumn>
                  {deletes
                    ? <Fragment>{handle} <Badge label={formatMessage(msg.deleted)} /></Fragment>
                    : <Link to={`/package/${handle}`}>{handle}</Link>
                  }
                </TableRowColumn>
                <TableRowColumn>
                  <ActivityLink to={`?audit=${handle}`}>
                    {formatActivity(packageActivities, activity)}
                  </ActivityLink>
                </TableRowColumn>
                <TableRowColumn>{formatDate(lastModified)}</TableRowColumn>
              </TableRow>
            ))
            : (
              <TableRow>
                <TableRowColumn colSpan={3}><FM {...msg.empty} /></TableRowColumn>
              </TableRow>
            )
          }
        </TableBody>
      </Table>
      {pagination}
    </Fragment>
  ));

export default composeComponent('Admin.Packages',
  injectReducer(REDUX_KEY, reducer),
  injectSaga(REDUX_KEY, saga),
  connect(selector, actions),
  setPropTypes({
    status: apiStatus,
    response: PT.oneOfType([
      PT.array,
      PT.object,
    ]),
    get: PT.func.isRequired,
  }),
  lifecycle({
    componentWillMount() {
      this.props.get();
    },
  }),
  ({
    status,
    response,
  }) => (
    <Fragment>
      <h2>
        <FM {...msg.heading} />
        {
          invoke(status, {
            [api.WAITING]: () => <Spinner />,
            [api.SUCCESS]: () => ` (${response.length})`,
          })
        }
      </h2>
      {
        invoke(status, {
          [api.SUCCESS]: () => (
            <PackagesTable
              packages={response}
            />
          ),
          [api.ERROR]: () => <ErrorMessage error={response} />,
        })
      }
    </Fragment>
  ));
