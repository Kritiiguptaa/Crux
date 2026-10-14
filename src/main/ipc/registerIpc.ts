/**
 * Registers one `ipcMain.handle` per channel in the shared contract. This is
 * the only surface the renderer can reach: each handler validates nothing more
 * than types (the preload guarantees shape) and delegates to a storage or
 * document module. Handlers are thin on purpose — logic lives in the modules.
 */
import { ipcMain, BrowserWindow, app } from 'electron'
import { CHANNELS } from '@shared/ipc'
import type { CreateCardInput, UpdateCardInput, AppSettings } from '@shared/domain-types'
import {
  listStudySets,
  createStudySet,
  renameStudySet,
  deleteStudySet
} from '../storage/studySetRepo'
import {
  listDocumentsInStudySet,
  linkToStudySet,
  unlinkFromStudySet
} from '../storage/documentRepo'
import {
  listCardsByStudySet,
  listCardsByDocument,
  createCard,
  updateCard,
  deleteCard,
  listAreaImagePathsByStudySet
} from '../storage/cardRepo'
import { getSettings, setSettings } from '../storage/settingsRepo'
import { importDocument } from '../documents/importDocument'
import { getFileData } from '../documents/fileData'
import { saveAreaImage, getAreaImage, deleteAreaImage } from '../cards/areaImage'

/** Wires every IPC channel to its handler. Called once during app startup. */
export function registerIpc(): void {
  ipcMain.handle(CHANNELS.system_appVersion, () => app.getVersion())

  // --- Study sets ---
  ipcMain.handle(CHANNELS.studySets_list, () => listStudySets())
  ipcMain.handle(CHANNELS.studySets_create, (_e, input: { name: string }) =>
    createStudySet(input.name)
  )
  ipcMain.handle(CHANNELS.studySets_rename, (_e, input: { id: string; name: string }) =>
    renameStudySet(input.id, input.name)
  )
  ipcMain.handle(CHANNELS.studySets_delete, (_e, input: { id: string }) => {
    // Remove the area-card PNGs first — the DB cascade can't touch the filesystem.
    const images = listAreaImagePathsByStudySet(input.id)
    deleteStudySet(input.id)
    for (const path of images) deleteAreaImage(path)
  })
  ipcMain.handle(CHANNELS.studySets_documents, (_e, input: { id: string }) =>
    listDocumentsInStudySet(input.id)
  )

  // --- Documents ---
  ipcMain.handle(CHANNELS.documents_import, (e, input: { studySetId: string }) =>
    importDocument(BrowserWindow.fromWebContents(e.sender), input.studySetId)
  )
  ipcMain.handle(
    CHANNELS.documents_addToStudySet,
    (_e, input: { documentId: string; studySetId: string }) =>
      linkToStudySet(input.documentId, input.studySetId)
  )
  ipcMain.handle(
    CHANNELS.documents_removeFromStudySet,
    (_e, input: { documentId: string; studySetId: string }) =>
      unlinkFromStudySet(input.documentId, input.studySetId)
  )
  ipcMain.handle(CHANNELS.documents_getFileData, (_e, input: { documentId: string }) =>
    getFileData(input.documentId)
  )

  // --- Cards ---
  ipcMain.handle(CHANNELS.cards_listByStudySet, (_e, input: { studySetId: string }) =>
    listCardsByStudySet(input.studySetId)
  )
  ipcMain.handle(
    CHANNELS.cards_listByDocument,
    (_e, input: { studySetId: string; documentId: string }) =>
      listCardsByDocument(input.studySetId, input.documentId)
  )
  ipcMain.handle(CHANNELS.cards_create, (_e, input: CreateCardInput) => createCard(input))
  ipcMain.handle(CHANNELS.cards_update, (_e, input: UpdateCardInput) => updateCard(input))
  ipcMain.handle(CHANNELS.cards_delete, (_e, input: { id: string }) => {
    const imagePath = deleteCard(input.id)
    if (imagePath) deleteAreaImage(imagePath)
  })
  ipcMain.handle(
    CHANNELS.cards_saveAreaImage,
    (_e, input: { documentId: string; pngBytes: Uint8Array }) =>
      saveAreaImage(input.documentId, input.pngBytes)
  )
  ipcMain.handle(CHANNELS.cards_getAreaImage, (_e, input: { imagePath: string }) =>
    getAreaImage(input.imagePath)
  )

  // --- Settings ---
  ipcMain.handle(CHANNELS.settings_get, () => getSettings())
  ipcMain.handle(CHANNELS.settings_set, (_e, input: Partial<AppSettings>) =>
    setSettings(input)
  )
}
