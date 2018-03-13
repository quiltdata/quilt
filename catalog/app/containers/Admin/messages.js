/* Admin messages */
import { defineMessages } from 'react-intl';

const scope = 'app.containers.Admin';

export default defineMessages({
  membersRead: {
    id: `${scope}.membersRead`,
    defaultMessage: 'Members can read public packages',
  },
  membersWrite: {
    id: `${scope}.membersWrite`,
    defaultMessage: 'Members can write public packages',
  },
  teamHeader: {
    id: `${scope}.teamHeader`,
    defaultMessage: 'Team {name}',
  },
  teamPayment: {
    id: `${scope}.teamPayment`,
    defaultMessage: 'Status',
  },
  teamPolicies: {
    id: `${scope}.teamPolicies`,
    defaultMessage: 'Policies',
  },
  changePolicy: {
    id: `${scope}.changePolicy`,
    defaultMessage: 'Contact support@quiltdata.io to change these settings',
  },
  defaultErrorMessage: {
    id: `${scope}.defaultErrorMessage`,
    defaultMessage: 'Something went wrong',
  },
  closeAuditDialog: {
    id: `${scope}.closeAuditDialog`,
    defaultMessage: 'Close',
  },
});
