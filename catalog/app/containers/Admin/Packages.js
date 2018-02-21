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
import { FormattedMessage as FM } from 'react-intl';
import { Link } from 'react-router';
import { compose, setPropTypes, setDisplayName } from 'recompose';

import Spinner from 'components/Spinner';
import api, { apiStatus } from 'constants/api';

import msg from './messages';
import { branch, formatActivity, formatDate } from './util';
import ErrorMessage from './ErrorMessage';


const packageActivities = [
  'installs',
  'previews',
];

const PackagesTable = compose(
  setPropTypes({
    audit: PT.func.isRequired,
    packages: PT.arrayOf( // eslint-disable-line function-paren-newline
      PT.shape({
        handle: PT.string.isRequired,
        lastModified: PT.number,
      }).isRequired,
    ).isRequired, // eslint-disable-line function-paren-newline
  }),
  setDisplayName('Admin.Packages.Table'),
// eslint-disable-next-line object-curly-newline
)(({ audit, packages }) => (
  <Table selectable={false}>
    <TableHeader adjustForCheckbox={false} displaySelectAll={false}>
      <TableRow>
        <TableHeaderColumn><FM {...msg.pkgHandle} /></TableHeaderColumn>
        <TableHeaderColumn><FM {...msg.pkgActivity} /></TableHeaderColumn>
        <TableHeaderColumn><FM {...msg.pkgLastModified} /></TableHeaderColumn>
      </TableRow>
    </TableHeader>
    <TableBody displayRowCheckbox={false}>
      {packages.length
        ? packages.map(({ handle, lastModified, ...activity }) => (
          <TableRow hoverable key={handle}>
            <TableRowColumn>
              <Link to={`/package/${handle}`}>{handle}</Link>
            </TableRowColumn>
            <TableRowColumn>
              {/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/anchor-is-valid */}
              <a onClick={() => audit(handle)}>
                {formatActivity(packageActivities, activity)}
              </a>
              {/* eslint-enable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/anchor-is-valid */}
            </TableRowColumn>
            <TableRowColumn>{formatDate(lastModified)}</TableRowColumn>
          </TableRow>
        ))
        : (
          <TableRow>
            <TableRowColumn colSpan={3}><FM {...msg.pkgEmpty} /></TableRowColumn>
          </TableRow>
        )
      }
    </TableBody>
  </Table>
));

export default compose(
  setPropTypes({
    status: apiStatus,
    response: PT.oneOfType([
      PT.array,
      PT.object,
    ]),
    audit: PT.func.isRequired,
  }),
  setDisplayName('Admin.Packages'),
)(({
  status,
  response,
  audit,
}) => (
  <Fragment>
    <h2>
      <FM {...msg.teamPackages} />
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
          <PackagesTable
            packages={response}
            audit={audit}
          />
        ),
        [api.ERROR]: () => <ErrorMessage error={response} />,
      })
    }
  </Fragment>
));
