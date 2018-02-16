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
import { FormattedMessage } from 'react-intl';
import { compose, setPropTypes, setDisplayName, withProps } from 'recompose';

import Spinner from 'components/Spinner';
import api, { apiStatus } from 'constants/api';

import messages from './messages';
import { branch, formatActivity, formatDate } from './util';
import SettingsMenu from './SettingsMenu';


const memberActivities = [
  'packages',
  'installs',
  'previews',
  // 'deletes',
  // 'pushes',
];

const MembersTable = compose(
  setPropTypes({
    audit: PT.func.isRequired,
    members: PT.arrayOf(
      PT.shape({
        name: PT.string.isRequired,
        lastSeen: PT.string,
      }).isRequired,
    ).isRequired,
    actions: PT.shape({
      remove: PT.func.isRequired,
      resetPassword: PT.func.isRequired,
    }).isRequired,
  }),
  withProps(({ actions }) => ({
    actions: [
      { text: 'Remove member', callback: actions.remove },
      'divider',
      { text: 'Reset password', callback: actions.resetPassword },
    ],
  })),
  setDisplayName('Admin.Members.Table'),
)(({ audit, members, actions }) => (
  <Table selectable={false}>
    <TableHeader adjustForCheckbox={false} displaySelectAll={false}>
      <TableRow>
        <TableHeaderColumn>Name</TableHeaderColumn>
        <TableHeaderColumn>Activity</TableHeaderColumn>
        <TableHeaderColumn>Last seen</TableHeaderColumn>
        <TableHeaderColumn>Settings</TableHeaderColumn>
      </TableRow>
    </TableHeader>
    <TableBody displayRowCheckbox={false}>
      {members.map(({ name, lastSeen, ...activity }) => (
        <TableRow hoverable key={name}>
          <TableRowColumn><a onClick={() => audit(name)}>{name}</a></TableRowColumn>
          <TableRowColumn>
            <a onClick={() => audit(name)}>{formatActivity(memberActivities, activity)}</a>
          </TableRowColumn>
          <TableRowColumn>
            <FlatButton onClick={() => audit(name)}>{formatDate(lastSeen)}</FlatButton>
          </TableRowColumn>
          <TableRowColumn>
            <SettingsMenu actions={actions} arg={name} />
          </TableRowColumn>
        </TableRow>
      ))}
    </TableBody>
  </Table>
));

const ErrorMessage = compose(
  setPropTypes({
    error: PT.shape({
      message: PT.string,
    }).isRequired,
  }),
  setDisplayName('Admin.Members.Error'),
)(({ error }) => (
  <p>Error: {error.message}</p>
));

export default compose(
  setPropTypes({
    status: apiStatus,
    response: PT.oneOfType([
      PT.array,
      PT.object,
    ]),
    actions: PT.object.isRequired,
    audit: PT.func.isRequired,
  }),
  setDisplayName('Admin.Members'),
)(({
  status,
  response,
  actions,
  audit,
}) => (
  <Fragment>
    <h2>
      <FormattedMessage {...messages.teamMembers} />
      {
        branch(status, {
          [api.WAITING]: () => <Spinner />,
          [api.SUCCESS]: () => ` (${response.length})`,
        })
      }
    </h2>
    {
      branch(status, {
        [api.SUCCESS]: () => (
          <MembersTable
            members={response}
            audit={audit}
            actions={actions}
          />
        ),
        [api.ERROR]: () => <ErrorMessage error={response} />,
      })
    }
  </Fragment>
));
