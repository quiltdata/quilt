import invoke from 'lodash/fp/invoke';
import FlatButton from 'material-ui/FlatButton';
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
import { setPropTypes, withHandlers, lifecycle } from 'recompose';
import { createSelector } from 'reselect';

import { withPagination } from 'components/Pagination';
import Spinner from 'components/Spinner';
import Badge from 'components/VisibilityIcon';
import { makeSelectUserName } from 'containers/App/selectors';
import { push } from 'containers/Notifications/actions';
import api, { apiStatus } from 'constants/api';
import { injectReducer } from 'utils/ReducerInjector';
import { injectSaga } from 'utils/SagaInjector';
import { composeComponent } from 'utils/reactTools';

import ErrorMessage from '../ErrorMessage';
import Cell from '../LockableCell';
import SettingsMenu from '../SettingsMenu';
import { formatActivity, formatDate, withStatefulActions } from '../util';
import * as actions from './actions';
import { REDUX_KEY } from './constants';
import msg from './messages';
import reducer from './reducer';
import saga from './saga';
import selector from './selectors';
import Add from './Add';


const dispatchPromise = (actionCreator, ...args) =>
  new Promise((resolve, reject) => actionCreator(...args, { resolve, reject }));

const memberActivities = [
  'packages',
  'installs',
  'previews',
];

const MembersTable = composeComponent('Admin.Members.Table',
  injectIntl,
  setPropTypes({
    user: PT.string.isRequired,
    members: PT.arrayOf( // eslint-disable-line function-paren-newline
      PT.shape({
        name: PT.string.isRequired,
        lastSeen: PT.string,
        status: PT.oneOf(['active', 'disabled']).isRequired,
      }).isRequired,
    ).isRequired, // eslint-disable-line function-paren-newline
    actions: PT.shape({
      enable: PT.func.isRequired,
      disable: PT.func.isRequired,
      resetPassword: PT.func.isRequired,
    }).isRequired,
    intl: PT.shape({
      formatMessage: PT.func.isRequired,
    }).isRequired,
  }),
  withStatefulActions(({ intl: { formatMessage }, user, ...props }) => ({ name, status }) =>
    status === 'active'
      ? [
        {
          text: formatMessage(msg.disable),
          callback: () => props.disable(name),
          disabled: user === name,
        },
        'divider',
        { text: formatMessage(msg.resetPassword), callback: () => props.resetPassword(name) },
      ]
      : [
        { text: formatMessage(msg.enable), callback: () => props.enable(name) },
      ]
  ), // eslint-disable-line function-paren-newline
  withPagination({ key: 'members', getItemId: (m) => m.name }),
  ({
    members,
    bindActions,
    pending,
    intl: { formatMessage },
    pagination,
  }) => (
    <Fragment>
      <Table selectable={false}>
        <TableHeader adjustForCheckbox={false} displaySelectAll={false}>
          <TableRow>
            <TableHeaderColumn style={{ paddingLeft: '48px' }}><FM {...msg.name} /></TableHeaderColumn>
            <TableHeaderColumn><FM {...msg.activity} /></TableHeaderColumn>
            <TableHeaderColumn><FM {...msg.lastSeen} /></TableHeaderColumn>
          </TableRow>
        </TableHeader>
        <TableBody displayRowCheckbox={false} showRowHover>
          {members.length
            // eslint-disable-next-line object-curly-newline
            ? members.map(({ name, status, lastSeen, ...activity }) => (
              <TableRow key={name}>
                <Cell
                  locked={pending[name]}
                  style={{
                    paddingLeft: 0,
                  }}
                >
                  <SettingsMenu
                    actions={bindActions({ name, status })}
                    busy={pending[name]}
                    style={{
                      verticalAlign: 'middle',
                    }}
                    buttonProps={{
                      // adjustments to keep the table row at 48px height
                      style: {
                        height: '46px',
                        paddingTop: '10px',
                        paddingBottom: '10px',
                      },
                    }}
                  />
                  <Link
                    to={`/user/${name}`}
                    style={{
                      verticalAlign: 'middle',
                      opacity: status === 'disabled' ? 0.5 : undefined,
                    }}
                  >
                    {name}
                  </Link>
                  {' '}
                  {status === 'disabled'
                    ? <Badge label={formatMessage(msg.disabled)} />
                    : null
                  }
                </Cell>
                <Cell locked={pending[name]}>
                  <FlatButton containerElement={<Link to={`?audit=${name}`} />}>
                    {formatActivity(memberActivities, activity)}
                  </FlatButton>
                </Cell>
                <Cell locked={pending[name]}>{formatDate(lastSeen)}</Cell>
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

export default composeComponent('Admin.Members',
  injectReducer(REDUX_KEY, reducer),
  injectSaga(REDUX_KEY, saga),
  injectIntl,
  connect(
    createSelector(selector(), makeSelectUserName(), (state, user) => ({ user, ...state })),
    { notify: push, ...actions }
  ),
  setPropTypes({
    user: PT.string.isRequired,
    status: apiStatus,
    response: PT.oneOfType([
      PT.array,
      PT.object,
    ]),
    add: PT.func.isRequired,
    get: PT.func.isRequired,
    disable: PT.func.isRequired,
    enable: PT.func.isRequired,
    resetPassword: PT.func.isRequired,
    notify: PT.func.isRequired,
    intl: PT.shape({
      formatMessage: PT.func.isRequired,
    }).isRequired,
  }),
  withHandlers({
    disable: ({ disable, notify, intl: { formatMessage } }) => (name) => {
      // eslint-disable-next-line no-alert, no-restricted-globals
      if (!confirm(formatMessage(msg.disableConfirm, { name }))) {
        return Promise.resolve();
      }

      return dispatchPromise(disable, name)
        .then(() => {
          notify(formatMessage(msg.disableSuccess, { name }));
        })
        .catch(() => {
          notify(formatMessage(msg.disableError, { name }));
        });
    },
    enable: ({ enable, notify, intl: { formatMessage } }) => (name) =>
      dispatchPromise(enable, name)
        .then(() => {
          notify(formatMessage(msg.enableSuccess, { name }));
        })
        .catch(() => {
          notify(formatMessage(msg.enableError, { name }));
        }),
    resetPassword: ({ resetPassword, notify, intl: { formatMessage } }) => (name) =>
      dispatchPromise(resetPassword, name)
        .then(() => {
          notify(formatMessage(msg.resetPasswordSuccess, { name }));
        })
        .catch(() => {
          notify(formatMessage(msg.resetPasswordError, { name }));
        }),
  }),
  lifecycle({
    componentWillMount() {
      this.props.get();
    },
  }),
  ({
    status,
    response,
    add,
    enable,
    disable,
    resetPassword,
    ...props
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
            <MembersTable
              members={response}
              actions={{ enable, disable, resetPassword }}
              {...props}
            />
          ),
          [api.ERROR]: () => <ErrorMessage error={response} />,
        })
      }
      <Add add={add} />
    </Fragment>
  ));
