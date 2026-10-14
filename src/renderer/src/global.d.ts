/** Makes the preload-exposed, fully-typed API visible to the renderer. */
import type { EasyPeasyApi } from '@shared/ipc'

declare global {
  interface Window {
    api: EasyPeasyApi
  }
}

export {}
