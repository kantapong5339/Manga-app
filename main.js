const { app, BrowserWindow } = require('electron')

function createWindow () {
  // ตั้งค่าขนาดหน้าต่างโปรแกรม
  // สั่งให้โหลดไฟล์หน้าเว็บของเรา
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true, // ซ่อนแถบเมนู File, Edit ด้านบน ให้ดูเหมือนแอปจริงๆ
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false // 🌟 เพิ่มบรรทัดนี้: ปลดล็อกให้แอปดึงข้อมูลข้ามเว็บไซต์ได้
    }
  })

  // สั่งให้โหลดไฟล์หน้าเว็บของเรา
  win.loadFile('index.html')
}

// เมื่อโปรแกรมพร้อม ให้สร้างหน้าต่างขึ้นมา
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// ปิดโปรแกรมเมื่อกดกากบาท
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})