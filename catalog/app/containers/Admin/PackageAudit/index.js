import {
  Table,
  TableBody,
  TableHeader,
  TableHeaderColumn,
  TableRow,
  TableRowColumn,
} from 'material-ui/Table';
import PT from 'prop-types';
import React from 'react';
import { FormattedMessage as FM } from 'react-intl';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import { push } from 'react-router-redux';
import { setPropTypes, withProps } from 'recompose';

import { injectReducer } from 'utils/ReducerInjector';
import { injectSaga } from 'utils/SagaInjector';
import { composeComponent } from 'utils/reactTools';

import AuditDialog from '../AuditDialog';
import { formatDate } from '../util';
import { get } from './actions';
import { REDUX_KEY } from './constants';
import msg from './messages';
import reducer from './reducer';
import saga from './saga';
import selector from './selectors';

const AuditTable = composeComponent('Admin.PackageAudit.Table',
  setPropTypes({
    entries: PT.arrayOf( // eslint-disable-line function-paren-newline
      PT.shape({
        time: PT.number.isRequired,
        user: PT.string.isRequired,
        event: PT.string.isRequired,
      }).isRequired
    ).isRequired, // eslint-disable-line function-paren-newline
  }),
  ({ entries }) => (
    <Table selectable={false}>
      <TableHeader adjustForCheckbox={false} displaySelectAll={false}>
        <TableRow>
          <TableHeaderColumn><FM {...msg.time} /></TableHeaderColumn>
          <TableHeaderColumn><FM {...msg.user} /></TableHeaderColumn>
          <TableHeaderColumn><FM {...msg.event} /></TableHeaderColumn>
        </TableRow>
      </TableHeader>
      <TableBody displayRowCheckbox={false}>
        {entries.length
          ? entries.map(({ time, user, event }) => (
            <TableRow hoverable key={`${time} ${user} ${event}`}>
              <TableRowColumn>{formatDate(time)}</TableRowColumn>
              <TableRowColumn>
                {user === 'public'
                  ? user
                  : <Link to={`/user/${user}`}>{user}</Link>
                }
              </TableRowColumn>
              <TableRowColumn>{event}</TableRowColumn>
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
  ));

export default composeComponent('Admin.PackageAudit',
  injectReducer(REDUX_KEY, reducer),
  injectSaga(REDUX_KEY, saga),
  connect(selector, { push, get }),
  withProps({ component: AuditTable, title: msg.heading }),
  AuditDialog);
