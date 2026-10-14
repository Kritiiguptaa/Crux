/**
 * Settings dialog. Lets the user control how highlights become cards (ask every
 * time / create automatically / only when I click) and the default highlight
 * color. Changes are saved immediately through the API.
 */
import type { AppSettings, CardCreationMode, HighlightColor } from '@shared/domain-types'
import { Modal } from '@renderer/components/Modal'
import { Button } from '@renderer/components/Button'
import { HIGHLIGHT_COLORS, HIGHLIGHT_HEX } from '@renderer/modules/reader/colors'

interface SettingsModalProps {
  open: boolean
  settings: AppSettings
  onChange: (patch: Partial<AppSettings>) => void
  onClose: () => void
}

/** Human-readable labels for each card-creation mode. */
const MODE_LABELS: Record<CardCreationMode, string> = {
  ask: 'Ask me each time (Allow once / Always allow)',
  auto: 'Create a card automatically',
  manual: 'Only when I click “Add card”'
}

export function SettingsModal({ open, settings, onChange, onClose }: SettingsModalProps) {
  return (
    <Modal
      open={open}
      title="Settings"
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="space-y-5">
        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink">When I highlight</h3>
          <div className="space-y-1.5">
            {(Object.keys(MODE_LABELS) as CardCreationMode[]).map((mode) => (
              <label key={mode} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="radio"
                  name="cardCreationMode"
                  checked={settings.cardCreationMode === mode}
                  onChange={() => onChange({ cardCreationMode: mode })}
                />
                {MODE_LABELS[mode]}
              </label>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink">Default highlight color</h3>
          <div className="flex items-center gap-2">
            {HIGHLIGHT_COLORS.map((c: HighlightColor) => (
              <button
                key={c}
                onClick={() => onChange({ defaultHighlightColor: c })}
                title={c}
                className={`h-6 w-6 rounded-full border ${
                  settings.defaultHighlightColor === c
                    ? 'border-ink ring-2 ring-accent'
                    : 'border-gray-300'
                }`}
                style={{ backgroundColor: HIGHLIGHT_HEX[c] }}
              />
            ))}
          </div>
        </section>
      </div>
    </Modal>
  )
}
