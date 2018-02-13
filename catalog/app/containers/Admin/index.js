/* Admin */
import Checkbox from 'material-ui/Checkbox';
import Dialog from 'material-ui/Dialog';
import Divider from 'material-ui/Divider';
import FlatButton from 'material-ui/FlatButton';
import IconButton from 'material-ui/IconButton';
import IconMenu from 'material-ui/IconMenu';
import MenuItem from 'material-ui/MenuItem';
import PT from 'prop-types';
import React, { PureComponent, Fragment } from 'react';
import { connect } from 'react-redux';
import { FormattedMessage } from 'react-intl';
import {
  Table,
  TableBody,
  TableHeader,
  TableHeaderColumn,
  TableRow,
  TableRowColumn,
} from 'material-ui/Table';
import TextField from 'material-ui/TextField';

import MIcon from 'components/MIcon';
import Spinner from 'components/Spinner';
import api from 'constants/api';

import * as actions from './actions';
import messages from './messages';
import selector from './selectors';

import config from 'constants/config';

const teamName = config.team && config.team.name;

export class Admin extends PureComponent { // eslint-disable-line react/prefer-stateless-function
  state = {
    open: false,
  };
  setOpen(flag) {
    this.setState({ open: flag });
  }
  componentWillMount() {
    this.props.getMembers();
  }

  render() {
    const { members, packages } = this.props;
    console.log('admin state', { members, packages });
    return (
      <div>
        <h1><FormattedMessage {...messages.teamHeader} values={{ name: teamName.toUpperCase() }} /></h1>
        <h2><FormattedMessage {...messages.teamPolicies} /></h2>
        <Checkbox checked label={<FormattedMessage {...messages.membersRead} />} />
        <Checkbox checked={false} label={<FormattedMessage {...messages.membersWrite} />} />

        <h2><FormattedMessage {...messages.membersAdd} /></h2>
        <TextField hintText="Email" />
        <FlatButton label="Add" />

        <MembersSection {...members} onOpen={() => this.setOpen(true)} />

        <h2><FormattedMessage {...messages.teamPackages} /></h2>
        {/*<PackageTable />*/}

        <AuditDialog
          onClose={() => this.setOpen(false)}
          open={this.state.open}
        />
      </div>
    );
  }
}

Admin.propTypes = {
  members: PT.shape({
    status: PT.oneOf([api.WAITING, api.SUCCESS, api.ERROR]),
    response: PT.array,
  }).isRequired,
  packages: PT.shape({
    status: PT.oneOf([api.WAITING, api.SUCCESS, api.ERROR]),
    response: PT.object,
  }).isRequired,
  getMembers: PT.func.isRequired,
};

const MemberSettingsMenu = () => (
  <IconMenu
    iconButtonElement={<IconButton><MIcon>settings</MIcon></IconButton>}
    anchorOrigin={{ horizontal: 'left', vertical: 'top' }}
    targetOrigin={{ horizontal: 'right', vertical: 'top' }}
  >
  <MenuItem primaryText="Remove member" />
    <Divider style={{ borderBottom: '1px solid' }} />
    <MenuItem primaryText="Reset password" />
  </IconMenu>

);


function randInt() {
  return Math.floor(Math.random() * 10) + 1;
}


const activityMask = ['packages', 'installs', 'previews'];

const MembersSection = ({ onOpen, status, response }) => (
  <Fragment>
    <h2>
      <FormattedMessage {...messages.teamMembers} />
      {
        status === null || status === api.WAITING ?
        <Spinner /> :
        status === api.SUCCESS ?
        ` (${response.length})` : null
      }
    </h2>
    {
      status === api.SUCCESS ?
      <MembersTable onOpen={onOpen} members={response} /> :
      status === api.ERROR ?
      <p>Error: {response.message}</p> : null
    }
  </Fragment>
);

const MembersTable = ({ onOpen, members }) => (
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
      {members.map((m) => <MemberRow key={m.name} onOpen={onOpen} {...m} />)}
    </TableBody>
  </Table>
);


MembersTable.propTypes = {
  onOpen: PT.func.isRequired,
  members: PT.array.isRequired,
};

const memberActivities = [
  'packages',
  'installs',
  'previews',
  // 'deletes',
  // 'pushes',
];

const formatActivity = (map, activity) =>
  map
    .filter((key) => key in activity)
    .map((key) => `${activity[key]} ${key}`)
    .join(', ');


const formatDate = (d) => d ? new Date(d).toLocaleString() : 'N/A';

const MemberRow = ({ onOpen, name, last_seen, ...activity }) => (
  <TableRow key={name}>
    <TableRowColumn><a onClick={onOpen}>{name}</a></TableRowColumn>
    <TableRowColumn>
      <a onClick={onOpen}>{formatActivity(memberActivities, activity)}</a>
    </TableRowColumn>
    <TableRowColumn>
      <FlatButton onClick={onOpen}>{formatDate(last_seen)}</FlatButton>
    </TableRowColumn>
    <TableRowColumn><MemberSettingsMenu /></TableRowColumn>
  </TableRow>
);


const PackageSettingsMenu = () => (
  <IconMenu
    iconButtonElement={<IconButton><MIcon>settings</MIcon></IconButton>}
    anchorOrigin={{ horizontal: 'left', vertical: 'top' }}
    targetOrigin={{ horizontal: 'right', vertical: 'top' }}
  >
    <MenuItem primaryText="Delete" />
  </IconMenu>

);

const PackageTable = () => (
  <Table selectable={false}>
    <TableHeader adjustForCheckbox={false} displaySelectAll={false}>
      <TableRow>
        <TableHeaderColumn>Name</TableHeaderColumn>
        <TableHeaderColumn>Activity</TableHeaderColumn>
        <TableHeaderColumn>Last modified</TableHeaderColumn>
        <TableHeaderColumn>Settings</TableHeaderColumn>
      </TableRow>
    </TableHeader>
    <TableBody displayRowCheckbox={false}>
      {
        packageData.map((p) => (
          <TableRow hoverable key={p.name}>
            <TableRowColumn><a href="#TODO">{p.name}</a></TableRowColumn>
            <TableRowColumn>
              <a href="#TODO">
                {activityMask.slice(1).map((l) => `${randInt()} ${l}`).join(', ')}
              </a>
            </TableRowColumn>
            <TableRowColumn><FlatButton> {p.last_seen} </FlatButton></TableRowColumn>
            <TableRowColumn><PackageSettingsMenu /></TableRowColumn>
          </TableRow>
        ))
      }
    </TableBody>
  </Table>
);

const AuditDialog = ({ onClose, open }) => {
  const actions = [
    <FlatButton
      label="Close"
      primary
      onClick={onClose}
    />,
  ];

  return (
    <Dialog
      title="User Audit"
      actions={actions}
      contentStyle={{ width: '80%', maxWidth: 'none' }}
      modal
      open={open}
    >
      <AuditTable />
    </Dialog>
  );
};

AuditDialog.propTypes = {
  onClose: PT.func,
  open: PT.bool,
};

const AuditTable = () => (
  <Table selectable={false}>
    <TableHeader adjustForCheckbox={false} displaySelectAll={false}>
      <TableRow>
        <TableHeaderColumn>Time</TableHeaderColumn>
        <TableHeaderColumn>Package</TableHeaderColumn>
        <TableHeaderColumn>Event</TableHeaderColumn>
      </TableRow>
    </TableHeader>
    <TableBody displayRowCheckbox={false}>
      {
        packageData.map((p) => (
          <TableRow hoverable key={p.name}>
            <TableRowColumn><FlatButton>{p.last_seen}</FlatButton></TableRowColumn>
            <TableRowColumn><a href="#TODO">{p.name}</a></TableRowColumn>
            <TableRowColumn>
              {['preview', 'install', 'push'][Math.floor(Math.random() * 3)]}
            </TableRowColumn>
          </TableRow>
        ))
      }
    </TableBody>
  </Table>
);

export default connect(selector, actions)(Admin);
