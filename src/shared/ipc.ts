/**
 * The typed IPC contract between the renderer and the main process.
 *
 * `CHANNELS` is the single list of allowed channel names — the preload only
 * ever wires these, so the renderer cannot reach any other main-process code.
 * `EasyPeasyApi` is the ergonomic, fully-typed surface the preload exposes as
 * `window.api`; main registers one handler per channel with matching types.
 */
import type {
  AppSettings,
  Card,
  CreateCardInput,
  DocumentMeta,
  StudySet,
  UpdateCardInput
} from './domain-types'

/** Every IPC channel the app uses, grouped by domain. */
export const CHANNELS = {
  system_appVersion: 'system:appVersion',

  studySets_list: 'studySets:list',
  studySets_create: 'studySets:create',
  studySets_rename: 'studySets:rename',
  studySets_delete: 'studySets:delete',
  studySets_documents: 'studySets:documents',

  documents_import: 'documents:import',
  documents_addToStudySet: 'documents:addToStudySet',
  documents_removeFromStudySet: 'documents:removeFromStudySet',
  documents_getFileData: 'documents:getFileData',

  cards_listByStudySet: 'cards:listByStudySet',
  cards_listByDocument: 'cards:listByDocument',
  cards_create: 'cards:create',
  cards_update: 'cards:update',
  cards_delete: 'cards:delete',
  cards_saveAreaImage: 'cards:saveAreaImage',
  cards_getAreaImage: 'cards:getAreaImage',

  settings_get: 'settings:get',
  settings_set: 'settings:set'
} as const

export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS]

/**
 * The API shape exposed to the renderer as `window.api`. Each method is a thin
 * wrapper over `ipcRenderer.invoke` of the matching channel; all are async.
 */
export interface EasyPeasyApi {
  system: {
    /** Returns the running app version string. */
    appVersion(): Promise<string>
  }
  studySets: {
    /** Lists all study sets with document/card counts, newest activity first. */
    list(): Promise<StudySet[]>
    /** Creates a study set and returns it. */
    create(input: { name: string }): Promise<StudySet>
    /** Renames a study set and returns the updated row. */
    rename(input: { id: string; name: string }): Promise<StudySet>
    /** Deletes a study set and all cards scoped to it. */
    delete(input: { id: string }): Promise<void>
    /** Lists the documents belonging to a study set. */
    documents(input: { id: string }): Promise<DocumentMeta[]>
  }
  documents: {
    /**
     * Opens a native file picker, hashes and registers the chosen file, adds it
     * to the given study set, and returns its metadata (or null if cancelled).
     */
    import(input: { studySetId: string }): Promise<DocumentMeta | null>
    /** Links an already-registered document into another study set. */
    addToStudySet(input: { documentId: string; studySetId: string }): Promise<void>
    /** Unlinks a document from a study set (the document stays registered). */
    removeFromStudySet(input: { documentId: string; studySetId: string }): Promise<void>
    /** Returns the raw file bytes for pdf.js to render. */
    getFileData(input: { documentId: string }): Promise<Uint8Array>
  }
  cards: {
    /** Lists all cards in a study set. */
    listByStudySet(input: { studySetId: string }): Promise<Card[]>
    /** Lists cards for one document within a study set (drives the reader overlay). */
    listByDocument(input: { studySetId: string; documentId: string }): Promise<Card[]>
    /** Creates a card and returns it. */
    create(input: CreateCardInput): Promise<Card>
    /** Updates a card's editable fields and returns the updated row. */
    update(input: UpdateCardInput): Promise<Card>
    /** Deletes a card (and its on-disk area image, if any). */
    delete(input: { id: string }): Promise<void>
    /**
     * Persists a cropped area image (PNG bytes) to disk and returns the relative
     * path to store on the card's anchor.
     */
    saveAreaImage(input: { documentId: string; pngBytes: Uint8Array }): Promise<string>
    /** Reads a previously saved area image back as bytes for display. */
    getAreaImage(input: { imagePath: string }): Promise<Uint8Array>
  }
  settings: {
    /** Returns all app settings (with defaults applied). */
    get(): Promise<AppSettings>
    /** Updates one or more settings and returns the full, merged settings. */
    set(input: Partial<AppSettings>): Promise<AppSettings>
  }
}
