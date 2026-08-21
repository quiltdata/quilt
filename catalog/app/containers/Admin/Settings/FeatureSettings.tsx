import * as React from 'react'
import * as Sentry from '@sentry/react'
import * as M from '@material-ui/core'

import * as Notifications from 'containers/Notifications'
import type { Feature, FeatureId } from 'utils/features'
import { FEATURES, FEATURE_IDS, useFeatureSetting } from 'utils/features'

interface FeatureSwitchProps {
  id: FeatureId
}

/**
 * One switch, one capability.
 *
 * Each switch is its own component rather than a row in a `.map()` body because
 * `useFeatureSetting` is a hook; they all read the same cached settings
 * resource, so N switches is still one fetch.
 */
function FeatureSwitch({ id }: FeatureSwitchProps) {
  const { label, description } = FEATURES[id] as Feature
  const { push: notify } = Notifications.use()
  const [enabled, setEnabled] = useFeatureSetting(id)

  // Held only while the write is in flight. `null` means "no write pending, show
  // the real value" -- which is why this is a nullable boolean and not a pair of
  // value/disabled flags: on failure we drop back to `enabled`, so the switch
  // snaps to what is actually stored instead of lying about a write that lost.
  const [pending, setPending] = React.useState<boolean | null>(null)

  const handleChange = React.useCallback(
    async (_event: React.ChangeEvent<{}>, checked: boolean) => {
      if (pending !== null) return
      setPending(checked)
      try {
        await setEnabled(checked)
      } catch (e) {
        Sentry.captureException(e)
        notify(`Failed to update "${label}": ${e}`)
      } finally {
        setPending(null)
      }
    },
    [label, notify, pending, setEnabled],
  )

  return (
    <>
      <M.FormControlLabel
        control={
          <M.Switch
            checked={pending ?? enabled}
            onChange={handleChange}
            disabled={pending !== null}
          />
        }
        label={label}
      />
      <M.FormHelperText>{description}</M.FormHelperText>
    </>
  )
}

/**
 * The admin panel's preview-capability switches, rendered straight off the
 * `utils/features` registry.
 *
 * Callers must not render this when the registry is empty -- see
 * `HAS_PREVIEW_FEATURES` below. A card of zero switches is admin-panel clutter,
 * and a switch with nothing behind it is worse: it would report a capability
 * this build cannot deliver.
 */
export default function FeatureSettings() {
  return (
    <M.FormGroup>
      {FEATURE_IDS.map((id) => (
        <FeatureSwitch key={id} id={id} />
      ))}
    </M.FormGroup>
  )
}

/**
 * Whether this build has any preview capability to offer.
 *
 * The registry ships empty: this slice is the switching machinery, and each
 * capability slice adds its own entry alongside the code that reads it. So until
 * one does, the card does not render at all.
 */
export const HAS_PREVIEW_FEATURES = FEATURE_IDS.length > 0
