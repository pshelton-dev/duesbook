import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'

// Unpackaged (npm run dev) must never open the real books: the installed app
// shares the default userData folder on a case-insensitive filesystem.
if (!app.isPackaged) {
  app.setPath('userData', join(app.getPath('appData'), 'duesbook-dev'))
}

import { maybeAutoBackup } from './backup'
import { openDb, closeDb } from './db'
import { ensurePeriodsCurrent } from './dues'
import { registerIpc } from './ipc'

/** Dev-only: DUESBOOK_SHOOT=<dir> walks the six screens, saves PNGs, quits. */
async function shootScreens(win: BrowserWindow, outDir: string): Promise<void> {
  const { writeFileSync } = await import('fs')
  const screens = ['home', 'ledger', 'members', 'dues', 'reports', 'settings']
  for (let i = 0; i < screens.length; i++) {
    await win.webContents.executeJavaScript(
      `(() => { const b = document.querySelectorAll('.nav-item')[${i}]; if (b) b.click(); })()`
    )
    await new Promise((r) => setTimeout(r, 700))
    const img = await win.webContents.capturePage()
    writeFileSync(join(outDir, `${i + 1}-${screens[i]}.png`), img.toPNG())
  }
  app.quit()
}

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

  win.on('ready-to-show', () => {
    win.show()
    const shootDir = process.env['DUESBOOK_SHOOT']
    if (shootDir && !app.isPackaged) {
      setTimeout(() => {
        shootScreens(win, shootDir).catch((err) => console.error('Screenshot run failed:', err))
      }, 1500)
    }
  })

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
