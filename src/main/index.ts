import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { maybeAutoBackup } from './backup'
import { openDb, closeDb } from './db'
import { ensurePeriodsCurrent } from './dues'
import { registerIpc } from './ipc'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  const db = openDb()
  registerIpc()

  try {
    ensurePeriodsCurrent(db)
  } catch (err) {
    console.error('Auto-rolling dues periods failed:', err)
  }

  createWindow()

  maybeAutoBackup(db).catch((err) => {
    console.error('Automatic backup failed:', err)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  closeDb()
})
