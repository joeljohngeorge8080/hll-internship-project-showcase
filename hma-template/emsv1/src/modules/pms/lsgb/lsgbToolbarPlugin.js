/**
 * lsgbToolbarPlugin.js — adds "Upload Sheet" and "Save to Database" buttons
 * to Univer's own toolbar, so Univer owns the whole editing UI and this app
 * only supplies two actions: load an .xlsx into the canvas, and persist the
 * current canvas back to Supabase.
 *
 * This app is plain JS/JSX (Vite + esbuild, no TypeScript decorator support),
 * but Univer's plugin examples are all written with `@Inject` decorators.
 * redi (Univer's DI library) documents a decorator-free equivalent —
 * `setDependencies(Ctor, [deps...], startIndex)` — which is what's used here
 * instead. See https://github.com/wzhudev/redi.
 */
import React from 'react'
import {
  CommandType,
  ICommandService,
  Injector,
  Plugin,
  UniverInstanceType,
  setDependencies,
} from '@univerjs/core'
import { ComponentManager, IMenuManagerService, MenuItemType, RibbonStartGroup } from '@univerjs/ui'

const UPLOAD_COMMAND_ID = 'lsgb.command.upload-sheet'
const SAVE_COMMAND_ID = 'lsgb.command.save-sheet'

const UploadIcon = () =>
  React.createElement(
    'svg',
    { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none' },
    React.createElement('path', {
      d: 'M8 2v8m0-8L5 5m3-3l3 3M3 11v1.5A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V11',
      stroke: 'currentColor',
      strokeWidth: 1.4,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }),
  )

const SaveIcon = () =>
  React.createElement(
    'svg',
    { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none' },
    React.createElement('path', {
      d: 'M3 2.5h8L13 4.5v9a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5Z',
      stroke: 'currentColor',
      strokeWidth: 1.4,
      strokeLinejoin: 'round',
    }),
    React.createElement('path', {
      d: 'M5 2.5V6h5V2.5M5 14v-4h6v4',
      stroke: 'currentColor',
      strokeWidth: 1.4,
      strokeLinejoin: 'round',
    }),
  )

/**
 * @param {{ onUpload: () => void, onSave: () => void }} handlers
 * Returns a Plugin class (Univer plugins are registered as constructors, so
 * this factory closes over the page's upload/save handlers and hands back a
 * fresh class each call).
 */
export function createLsgbToolbarPlugin({ onUpload, onSave }) {
  class LsgbToolbarPlugin extends Plugin {
    constructor(_config, injector, menuManagerService, componentManager, commandService) {
      super()
      this._injector = injector
      this._menuManagerService = menuManagerService
      this._componentManager = componentManager
      this._commandService = commandService
    }

    onStarting() {
      this._componentManager.register('LsgbUploadIcon', UploadIcon)
      this._componentManager.register('LsgbSaveIcon', SaveIcon)

      this._commandService.registerCommand({
        type: CommandType.OPERATION,
        id: UPLOAD_COMMAND_ID,
        handler: () => {
          onUpload()
          return true
        },
      })
      this._commandService.registerCommand({
        type: CommandType.OPERATION,
        id: SAVE_COMMAND_ID,
        handler: () => {
          onSave()
          return true
        },
      })

      this._menuManagerService.mergeMenu({
        [RibbonStartGroup.OTHERS]: {
          [UPLOAD_COMMAND_ID]: {
            order: 0,
            menuItemFactory: () => ({
              id: UPLOAD_COMMAND_ID,
              title: 'Upload Sheet',
              tooltip: 'Upload an Excel (.xlsx) file',
              icon: 'LsgbUploadIcon',
              type: MenuItemType.BUTTON,
            }),
          },
          [SAVE_COMMAND_ID]: {
            order: 1,
            menuItemFactory: () => ({
              id: SAVE_COMMAND_ID,
              title: 'Save',
              tooltip: 'Save changes to the database',
              icon: 'LsgbSaveIcon',
              type: MenuItemType.BUTTON,
            }),
          },
        },
      })
    }
  }

  LsgbToolbarPlugin.type = UniverInstanceType.UNIVER_SHEET
  LsgbToolbarPlugin.pluginName = 'LSGB_TOOLBAR_PLUGIN'

  setDependencies(
    LsgbToolbarPlugin,
    [Injector, IMenuManagerService, ComponentManager, ICommandService],
    1,
  )

  return LsgbToolbarPlugin
}
