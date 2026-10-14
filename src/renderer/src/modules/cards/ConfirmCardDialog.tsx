/**
 * The card-creation permission prompt (used when the setting is "ask"). It
 * previews what was captured and offers "Allow once" (create just this one) or
 * "Always allow" (create and switch the setting to auto, so it won't ask again).
 */
import type { CardDraft } from '@renderer/modules/reader/types'
import { Modal } from '@renderer/components/Modal'
import { Button } from '@renderer/components/Button'

interface ConfirmCardDialogProps {
  draft: CardDraft | null
  onAllowOnce: () => void
  onAlwaysAllow: () => void
  onCancel: () => void
}

export function ConfirmCardDialog({
  draft,
  onAllowOnce,
  onAlwaysAllow,
  onCancel
}: ConfirmCardDialogProps) {
  return (
    <Modal
      open={draft !== null}
      title="Create a card?"
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={onAlwaysAllow}>
            Always allow
          </Button>
          <Button variant="primary" onClick={onAllowOnce}>
            Allow once
          </Button>
        </>
      }
    >
      <p className="mb-2 text-subtle">This selection will become a card:</p>
      <div className="max-h-32 overflow-auto rounded-md bg-gray-50 p-2 text-sm">
        {draft?.kind === 'area' ? (
          <em className="text-subtle">A captured area (image) on page {draft.anchor.pageOrSlide}.</em>
        ) : (
          `“${draft?.body ?? ''}”`
        )}
      </div>
      <p className="mt-3 text-xs text-subtle">
        “Always allow” creates cards automatically from now on. You can change this later in
        Settings.
      </p>
    </Modal>
  )
}
