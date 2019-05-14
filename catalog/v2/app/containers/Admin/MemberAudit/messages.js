import { defineMessages } from 'react-intl';

const scope = 'app.cotainers.Admin.MemberAudit';

export default defineMessages({
  heading: {
    id: `${scope}.heading`,
    defaultMessage: 'User audit',
  },
  time: {
    id: `${scope}.time`,
    defaultMessage: 'Time',
  },
  package: {
    id: `${scope}.package`,
    defaultMessage: 'Package',
  },
  event: {
    id: `${scope}.event`,
    defaultMessage: 'Event',
  },
  empty: {
    id: `${scope}.empty`,
    defaultMessage: 'Nothing here yet',
  },
});
