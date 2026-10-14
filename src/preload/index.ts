/**
 * The preload bridge. Runs in an isolated context with Node access and exposes
 * exactly one object — `window.api` — to the renderer via contextBridge. Each
 * method is a typed wrapper over `ipcRenderer.invoke` of an allow-listed
 * channel, so the UI gets full types while never touching Node or arbitrary IPC.
 */
import { contextBridge, ipcRenderer } from 'electron'
import { CHANNELS, type EasyPeasyApi } from '@shared/ipc'
import type {
  AppSettings,
  CreateCardInput,
  UpdateCardInput
} from '@shared/domain-types'

/** The concrete implementation of the typed API surface. */
const api: EasyPeasyApi = {
  system: {
    appVersion: () => ipcRenderer.invoke(CHANNELS.system_appVersion)
  },
  studySets: {
    list: () => ipcRenderer.invoke(CHANNELS.studySets_list),
    create: (input) => ipcRenderer.invoke(CHANNELS.studySets_create, input),
    rename: (input) => ipcRenderer.invoke(CHANNELS.studySets_rename, input),
    delete: (input) => ipcRenderer.invoke(CHANNELS.studySets_delete, input),
    documents: (input) => ipcRenderer.invoke(CHANNELS.studySets_documents, input)
  },
  documents: {
    import: (input) => ipcRenderer.invoke(CHANNELS.documents_import, input),
    addToStudySet: (input) =>
      ipcRenderer.invoke(CHANNELS.documents_addToStudySet, input),
    removeFromStudySet: (input) =>
      ipcRenderer.invoke(CHANNELS.documents_removeFromStudySet, input),
    getFileData: (input) => ipcRenderer.invoke(CHANNELS.documents_getFileData, input)
  },
  cards: {
    listByStudySet: (input) =>
      ipcRenderer.invoke(CHANNELS.cards_listByStudySet, input),
    listByDocument: (input) =>
      ipcRenderer.invoke(CHANNELS.cards_listByDocument, input),
    create: (input: CreateCardInput) => ipcRenderer.invoke(CHANNELS.cards_create, input),
    update: (input: UpdateCardInput) => ipcRenderer.invoke(CHANNELS.cards_update, input),
    delete: (input) => ipcRenderer.invoke(CHANNELS.cards_delete, input),
    saveAreaImage: (input) => ipcRenderer.invoke(CHANNELS.cards_saveAreaImage, input),
    getAreaImage: (input) => ipcRenderer.invoke(CHANNELS.cards_getAreaImage, input)
  },
  settings: {
    get: () => ipcRenderer.invoke(CHANNELS.settings_get),
    set: (input: Partial<AppSettings>) => ipcRenderer.invoke(CHANNELS.settings_set, input)
  }
}

// Expose the API only when context isolation is on (it always is here).
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Failed to expose preload API:', error)
  }
} else {
  // Fallback for the unexpected non-isolated case (kept for safety).
  // @ts-ignore (define on window)
  window.api = api
}
