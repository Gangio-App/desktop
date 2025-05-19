const { app, BrowserWindow, BrowserView, ipcMain, shell, Tray, Menu, nativeImage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');
const { autoUpdater } = require('electron-updater');
const { resolveResourcePath } = require('./app-utils');

// Helper function to resolve app paths in both dev and production
function resolveAppPath(relativePath) {
  try {
    // First try development path
    const devPath = path.join(__dirname, '..', relativePath);
    if (fs.existsSync(devPath)) {
      return devPath;
    }
    
    // Then try production path in resources directory
    const prodPath = path.join(process.resourcesPath, relativePath.replace(/^resources[\\/]/, ''));
    if (fs.existsSync(prodPath)) {
      return prodPath;
    }
    
    // Fallback to app path
    const appPath = path.join(app.getAppPath(), relativePath);
    return appPath;
  } catch (error) {
    console.error(`Error resolving path for ${relativePath}:`, error);
    return relativePath; // Return original as last resort
  }
}

// Get app version with better error handling
function getVersion() {
  try {
    // Try to get version from package.json using resolved path
    const packagePath = resolveAppPath('package.json');
    console.log('Looking for package.json at:', packagePath);
    
    if (fs.existsSync(packagePath)) {
      const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      return packageData.version || '1.0.0';
    } else {
      console.warn('package.json not found at path:', packagePath);
      return '1.0.0-dev';
    }
  } catch (error) {
    console.error('Error getting app version:', error);
    return '1.0.0-dev';
  }
}

// Add IPC handler for getting app version - only register once
if (!ipcMain.listenerCount('get-app-version')) {
  ipcMain.handle('get-app-version', () => {
    try {
      const version = getVersion();
      console.log('Returning app version:', version);
      return version;
    } catch (error) {
      console.error('Error in get-app-version handler:', error);
      return isDev ? '1.0.0-dev' : '1.0.0';
    }
  });
}

// Simple settings store implementation
class SettingsStore {
  constructor(defaults) {
    this.path = path.join(app.getPath('userData'), 'settings.json');
    this.defaults = defaults;
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.path)) {
        const data = JSON.parse(fs.readFileSync(this.path, 'utf8'));
        return { ...this.defaults, ...data };
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
    return { ...this.defaults };
  }

  save() {
    try {
      fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    this.save();
  }
}

// Initialize settings store
const store = new SettingsStore({
  startMinimized: false,
  minimizeToTray: true,
  launchOnStartup: true,
  hasShownTrayNotification: false
});

// Keep references to prevent garbage collection
let mainWindow;

// App metadata
const APP_NAME = 'Gangio Desktop';
const APP_ORGANIZATION = 'Gangio';
const APP_LOGIN_URL = 'https://gangio.vercel.app';
const APP_AUTHOR = '@korybantes';
const APP_GITHUB = 'https://github.com/korybantes/gangio-legacy';

// Global variables
let splashWindow;
let settingsWindow;
let tray;
let forceQuit = false;
let updateAvailable = false;

// Create splash screen window
function createSplashScreen() {
  splashWindow = new BrowserWindow({
    width: 1000,
    height: 600,
    transparent: false,
    frame: false,
    resizable: false,
    movable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: isDev
    },
    backgroundColor: '#111827'
  });

  // Load splash screen HTML with better error handling and path resolution
  try {
    // Try multiple possible paths for the splash screen
    const splashPaths = [
      path.join(__dirname, 'splash.html'),
      path.join(app.getAppPath(), 'src', 'splash.html'),
      path.join(process.resourcesPath, 'src', 'splash.html'),
      path.join(process.resourcesPath, 'app.asar', 'src', 'splash.html'),
      path.join(process.resourcesPath, 'app', 'src', 'splash.html')
    ];
    
    // Find the first path that exists
    let splashPath = splashPaths[0]; // Default
    for (const testPath of splashPaths) {
      if (fs.existsSync(testPath)) {
        splashPath = testPath;
        console.log('Found splash screen at:', splashPath);
        break;
      }
    }
    
    console.log('Loading splash screen from:', splashPath);
    
    // Check if the file exists before attempting to load it
    if (fs.existsSync(splashPath)) {
      splashWindow.loadFile(splashPath)
        .catch(err => {
          console.error('Failed to load splash screen:', err);
          // If splash screen fails to load, create main window directly
          if (!mainWindow) createMainWindow();
        });
    } else {
      console.error('Splash screen file not found at:', splashPath);
      // Try alternative paths as fallback
      const altPaths = [
        path.join(__dirname, 'splash.html'),
        path.join(app.getAppPath(), 'src', 'splash.html'),
        path.join(process.resourcesPath, 'app', 'src', 'splash.html')
      ];
      
      // Try each alternative path
      let loaded = false;
      for (const altPath of altPaths) {
        if (fs.existsSync(altPath)) {
          console.log('Found splash screen at alternative path:', altPath);
          splashWindow.loadFile(altPath).catch(e => console.error('Error loading alternative path:', e));
          loaded = true;
          break;
        }
      }
      
      // If still not loaded, create main window directly
      if (!loaded) {
        console.error('Could not find splash screen at any path, creating main window directly');
        if (!mainWindow) createMainWindow();
      }
    }
  } catch (error) {
    console.error('Error loading splash screen:', error);
    // If splash screen fails to load, create main window directly
    if (!mainWindow) createMainWindow();
  }

  // Handle IPC from splash screen
  ipcMain.once('splash-screen-ready', () => {
    if (!mainWindow) {
      createMainWindow();
    }
  });
  
  // Handle splash screen close event
  splashWindow.on('closed', () => {
    splashWindow = null;
    // If main window hasn't been created yet, create it
    if (!mainWindow) {
      createMainWindow();
    }
  });
}

function createSettingsWindow() {
  // If settings window already exists, just focus it
  if (settingsWindow) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 650,
    height: 650,
    frame: false,
    resizable: false,
    transparent: true,
    center: true,
    parent: mainWindow,
    modal: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Try multiple possible paths for the settings HTML
  const settingsPaths = [
    path.join(__dirname, 'settings.html'),
    path.join(app.getAppPath(), 'src', 'settings.html'),
    path.join(process.resourcesPath, 'src', 'settings.html'),
    path.join(process.resourcesPath, 'app.asar', 'src', 'settings.html'),
    path.join(process.resourcesPath, 'app', 'src', 'settings.html')
  ];
  
  // Find the first path that exists
  let settingsPath = settingsPaths[0]; // Default
  for (const testPath of settingsPaths) {
    if (fs.existsSync(testPath)) {
      settingsPath = testPath;
      console.log('Found settings HTML at:', settingsPath);
      break;
    }
  }
  
  console.log('Loading settings from:', settingsPath);
  settingsWindow.loadFile(settingsPath);

  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function createMainWindow() {
  // Create the browser window with resource optimization
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    backgroundColor: '#1a1a1a',
    frame: false, // Remove default frame for custom titlebar
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Resource optimization settings
      backgroundThrottling: true,
      offscreen: false,
      spellcheck: false,
      enableWebSQL: false,
      autoplayPolicy: 'user-gesture-required',
      // Disable hardware acceleration if causing issues
      // Comment this out if you need hardware acceleration
      // disableHardwareAcceleration: true
    }
  });
  
  // Set additional resource optimization options
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Open external links in browser instead of new electron windows
    shell.openExternal(url);
    return { action: 'deny' };
  });
  
  // Optimize memory usage
  mainWindow.webContents.on('dom-ready', () => {
    // Reduce memory usage when window is not focused
    if (global.gc) {
      global.gc();
    }
  });

  // Load the titlebar with proper path resolution
  // Try multiple possible paths for the titlebar
  const titlebarPaths = [
    path.join(__dirname, 'titlebar.html'),
    path.join(app.getAppPath(), 'src', 'titlebar.html'),
    path.join(process.resourcesPath, 'src', 'titlebar.html'),
    path.join(process.resourcesPath, 'app.asar', 'src', 'titlebar.html'),
    path.join(process.resourcesPath, 'app', 'src', 'titlebar.html')
  ];
  
  // Find the first path that exists
  let titlebarPath = titlebarPaths[0]; // Default
  for (const testPath of titlebarPaths) {
    if (fs.existsSync(testPath)) {
      titlebarPath = testPath;
      console.log('Found titlebar at:', titlebarPath);
      break;
    }
  }
  
  console.log('Loading titlebar from:', titlebarPath);
  const titlebarUrl = `file://${titlebarPath}`;
  
  // Create a BrowserView for the titlebar
  const titlebarView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Additional optimization settings
      spellcheck: false,
      enableWebSQL: false
    }
  });
  
  // Add the titlebar view to the main window
  mainWindow.setBrowserView(titlebarView);
  
  // Set initial bounds for the titlebar
  const updateTitlebarBounds = () => {
    const bounds = mainWindow.getBounds();
    titlebarView.setBounds({ x: 0, y: 0, width: bounds.width, height: 32 });
  };
  
  updateTitlebarBounds();
  titlebarView.setAutoResize({ width: true, height: false });
  titlebarView.webContents.loadFile(titlebarPath);
  
  // Update titlebar bounds when window is resized
  mainWindow.on('resize', updateTitlebarBounds);
  
  // Create a BrowserView for the main content
  const contentView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  
  // Add the content view to the main window
  mainWindow.addBrowserView(contentView);
  
  // Set initial bounds for the content view
  const updateContentBounds = () => {
    const bounds = mainWindow.getBounds();
    contentView.setBounds({ x: 0, y: 32, width: bounds.width, height: bounds.height - 32 });
  };
  
  updateContentBounds();
  contentView.setAutoResize({ width: true, height: true });
  
  // Update content bounds when window is resized
  mainWindow.on('resize', updateContentBounds);
  
  // Listen for window maximize/unmaximize events
  mainWindow.on('maximize', () => {
    if (titlebarView) {
      titlebarView.webContents.send('maximized-state-changed', true);
    }
  });
  
  mainWindow.on('unmaximize', () => {
    if (titlebarView) {
      titlebarView.webContents.send('maximized-state-changed', false);
    }
  });
  
  // Load the Gangio web app in the content view with resource optimization
  try {
    console.log('Loading Gangio web app in content view');
    // Load the web app using the defined login URL
    contentView.webContents.loadURL(APP_LOGIN_URL, { 
      userAgent: 'Chrome',
      // Resource optimization options
      httpReferrer: APP_LOGIN_URL,
      // Disable unnecessary features to save resources
      enableBlinkFeatures: '',
      disableBlinkFeatures: 'AutomationControlled,CollectiveScheduling',
    });
    
    // Additional resource optimization
    contentView.webContents.session.setPreloads([]);
    contentView.webContents.session.setSpellCheckerEnabled(false);
    
    // Throttle background tabs to save CPU/GPU
    contentView.webContents.setBackgroundThrottling(true);
  } catch (error) {
    console.error('Error loading content view:', error);
    // Show error in main window if content fails to load
    if (mainWindow) {
      mainWindow.show();
      mainWindow.webContents.loadFile(path.join(__dirname, 'error.html')).catch(err => {
        console.error('Failed to load error page:', err);
      });
    }
  }
  
  // Add error handling for server access issues
  contentView.webContents.on('console-message', (event, level, message, line, sourceId) => {
    // Log console messages from the web app
    console.log(`[Web Console] ${message}`);
    
    // Check for timeout or validation errors
    if (message.includes('timeout') || message.includes('validate access')) {
      console.log('[Desktop Client] Detected server access issue');
      
      // You could implement retry logic or user notifications here
    }
  });

  // Handle window load completion and splash screen transition
  contentView.webContents.once('did-finish-load', () => {
    console.log('Content view loaded with Gangio web app');
    
    // Give the main window a moment to fully render before showing it
    setTimeout(() => {
      // Close splash screen and show main window - with error handling
      try {
        if (splashWindow && !splashWindow.isDestroyed()) {
          splashWindow.close();
          splashWindow = null;
        }
      } catch (error) {
        console.error('Error closing splash window:', error);
        // Ensure splashWindow reference is cleared even if there's an error
        splashWindow = null;
      }
      
      // Check if we should start minimized
      const startMinimized = store.get('startMinimized');
      
      if (!startMinimized) {
        // Show and focus the main window with a fade-in effect
        mainWindow.setOpacity(0);
        mainWindow.show();
        
        // Fade in the main window
        let opacity = 0;
        const fadeIn = setInterval(() => {
          if (opacity >= 1) {
            clearInterval(fadeIn);
            mainWindow.focus();
          } else {
            opacity += 0.1;
            mainWindow.setOpacity(opacity);
          }
        }, 30);
      } else {
        // Start minimized (hidden) in the tray
        mainWindow.setOpacity(1);
      }
    }, 800); // Additional delay for smoother transition
  });
  
  // Open external links in browser
  contentView.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // IPC handlers
  ipcMain.on('minimize-window', () => {
    mainWindow.minimize();
  });

  ipcMain.on('maximize-window', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      console.log('Window unmaximized');
    } else {
      // Force full screen mode
      const { width, height } = require('electron').screen.getPrimaryDisplay().workAreaSize;
      mainWindow.setSize(width, height);
      mainWindow.maximize();
      console.log('Window maximized to full screen');
    }
  });

  ipcMain.on('close-window', () => {
    if (store.get('minimizeToTray')) {
      mainWindow.hide();
      // Show tray notification the first time the app is minimized to tray
      if (!store.get('hasShownTrayNotification')) {
        tray.displayBalloon({
          title: 'Gangio is still running',
          content: 'The app is now minimized to the system tray. Click the tray icon to restore.',
          iconType: 'info'
        });
        store.set('hasShownTrayNotification', true);
      }
    } else {
      mainWindow.close();
    }
  });

  // Settings window handlers
  ipcMain.on('open-settings', () => {
    createSettingsWindow();
  });

  ipcMain.on('close-settings', () => {
    if (settingsWindow) {
      settingsWindow.close();
    }
  });

  // App version is already handled at the top level

  // Listen for maximize/unmaximize events to update titlebar
  mainWindow.on('maximize', () => {
    if (contentView && contentView.webContents) {
      contentView.webContents.send('maximized-state-changed', true);
    }
  });

  mainWindow.on('unmaximize', () => {
    if (contentView && contentView.webContents) {
      contentView.webContents.send('maximized-state-changed', false);
    }
  });

  // IPC handlers for updates
  ipcMain.on('check-for-updates', () => {
    checkForUpdates();
  });

  ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall(false, true);
  });

  // Handle window close event - minimize to tray instead of quitting if enabled
  mainWindow.on('close', (event) => {
    if (!forceQuit && store.get('minimizeToTray')) {
      event.preventDefault();
      mainWindow.hide();
      
      // Show notification when minimizing to tray for the first time
      if (!store.get('hasShownTrayNotification')) {
        new Notification({
          title: 'Gangio is still running',
          body: 'Gangio has been minimized to the system tray. Click the tray icon to restore.',
          icon: path.join(__dirname, '../assets/titlebar-logo.png')
        }).show();
        
        // Remember that we've shown this notification
        store.set('hasShownTrayNotification', true);
      }
      
      return false;
    }
    return true;
  });
  
  // Handle window closed event
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Check for updates manually
function checkForUpdates() {
  console.log('Manually checking for updates...');
  autoUpdater.checkForUpdates();
  
  if (mainWindow) {
    mainWindow.webContents.send('checking-for-update');
  }
}

// Create system tray icon
function createTray() {
  try {
    // Try multiple possible paths for the tray icon
    const iconPaths = [
      path.join(__dirname, '..', 'resources', 'icons', 'tray-icon.png'),
      path.join(__dirname, '..', 'resources', 'icons', 'icon.ico'),
      path.join(process.resourcesPath, 'resources', 'icons', 'tray-icon.png'),
      path.join(process.resourcesPath, 'resources', 'icons', 'icon.ico'),
      path.join(app.getAppPath(), 'resources', 'icons', 'tray-icon.png'),
      path.join(app.getAppPath(), 'resources', 'build', 'png', '32x32.png'),
      path.join(process.resourcesPath, 'resources', 'build', 'png', '32x32.png')
    ];
    
    // Find the first path that exists
    let trayIconPath = null;
    for (const testPath of iconPaths) {
      if (fs.existsSync(testPath)) {
        trayIconPath = testPath;
        console.log('Found tray icon at:', trayIconPath);
        break;
      }
    }
    
    // If no icon found, use a default path
    if (!trayIconPath) {
      trayIconPath = path.join(__dirname, '..', 'resources', 'icons', 'tray-icon.png');
      console.warn('No tray icon found, using default path:', trayIconPath);
    }
    
    console.log('Using tray icon path:', trayIconPath);
    
    // Create a native image from the icon path
    const trayIcon = nativeImage.createFromPath(trayIconPath);
    
    // Check if the icon was loaded successfully
    if (trayIcon.isEmpty()) {
      console.warn('Tray icon is empty, trying alternative paths');
      
      // Try alternative icon paths
      const alternativePaths = [
        resolveResourcePath('resources/icons/icon.ico'),
        resolveResourcePath('resources/build/png/32x32.png'),
        resolveResourcePath('resources/build/png/16x16.png')
      ];
      
      // Try each alternative path
      let iconLoaded = false;
      for (const altPath of alternativePaths) {
        const altIcon = nativeImage.createFromPath(altPath);
        if (!altIcon.isEmpty()) {
          console.log('Using alternative tray icon:', altPath);
          tray = new Tray(altIcon);
          iconLoaded = true;
          break;
        }
      }
      
      // If still no icon loaded, create an empty one
      if (!iconLoaded) {
        console.warn('No tray icons found, using empty icon');
        tray = new Tray(nativeImage.createEmpty());
      }
    } else {
      // Create the tray with the successfully loaded icon
      console.log('Creating tray with resolved icon');
      tray = new Tray(trayIcon);
    }
  } catch (error) {
    console.error('Error creating tray icon:', error);
    
    // Create a default tray icon as a last resort
    try {
      console.warn('Using empty icon as last resort');
      const emptyIcon = nativeImage.createEmpty();
      tray = new Tray(emptyIcon);
    } catch (fallbackError) {
      console.error('Failed to create fallback tray icon:', fallbackError);
    }
  }
  tray.setToolTip('Gangio Desktop');
  
  // Create context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Gangio',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Preferences',
      submenu: [
        {
          label: 'Start Minimized',
          type: 'checkbox',
          checked: store.get('startMinimized'),
          click: () => {
            store.set('startMinimized', !store.get('startMinimized'));
          }
        },
        {
          label: 'Minimize to Tray on Close',
          type: 'checkbox',
          checked: store.get('minimizeToTray'),
          click: () => {
            store.set('minimizeToTray', !store.get('minimizeToTray'));
          }
        },
        {
          label: 'Launch on Startup',
          type: 'checkbox',
          checked: store.get('launchOnStartup'),
          click: () => {
            const newValue = !store.get('launchOnStartup');
            store.set('launchOnStartup', newValue);
            app.setLoginItemSettings({
              openAtLogin: newValue
            });
          }
        }
      ]
    },
    {
      label: 'Check for Updates',
      click: () => {
        checkForUpdates();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        forceQuit = true;
        app.quit();
      }
    }
  ]);
  
  // Set context menu
  tray.setContextMenu(contextMenu);
  
  // Add click handler to show window
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Configure auto updater
function configureAutoUpdater() {
  if (isDev) {
    console.log('Development mode, auto-updater disabled.');
    return;
  }

  console.log('Configuring auto-updater...');
  autoUpdater.logger = require('electron-log');
  autoUpdater.logger.transports.file.level = 'info';
  autoUpdater.autoDownload = true; // Enable auto-download
  autoUpdater.autoInstallOnAppQuit = true; // Install on quit if downloaded

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...');
    // Optional: send message to titlebar if needed
    // if (mainWindow) {
    //   mainWindow.webContents.send('update-status', { message: 'Checking for updates...' });
    // }
  });

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info);
    if (mainWindow) {
      mainWindow.webContents.send('update-available-from-main', info); // IPC to Titlebar
    }
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.send('splash-update-status', { 
        message: `Update v${info.version} found, downloading...`, 
        version: info.version 
      });
    }
    updateAvailable = true;
    new Notification({
      title: APP_NAME,
      body: `A new version (${info.version}) is available. Downloading now...`
    }).show();
  });

  autoUpdater.on('update-not-available', () => {
    console.log('Update not available.');
    // Optional: send message to titlebar if needed
    // if (mainWindow) {
    //   mainWindow.webContents.send('update-status', { message: 'You are on the latest version.' });
    // }
  });

  autoUpdater.on('error', (err) => {
    console.error('Error in auto-updater:', err);
    // Optional: send message to titlebar if needed
    // if (mainWindow) {
    //   mainWindow.webContents.send('update-status', { message: `Error in auto-updater: ${err.message}`, isError: true });
    // }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = `Download speed: ${progressObj.bytesPerSecond}`;
    log_message = `${log_message} - Downloaded ${progressObj.percent.toFixed(2)}%`;
    log_message = `${log_message} (${progressObj.transferred}/${progressObj.total})`;
    console.log(log_message);
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.send('splash-update-progress', { 
        percent: progressObj.percent 
      });
    }
    // Optional: send progress to titlebar if you want a progress bar there
    // if (mainWindow) {
    //    mainWindow.webContents.send('update-download-progress', progressObj);
    // }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info);
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded-from-main', info); // IPC to Titlebar
    }
    const notification = new Notification({
      title: APP_NAME,
      body: `Version ${info.version} has been downloaded and is ready to install.`,
      actions: [{ type: 'button', text: 'Restart and Install' }]
    });
    notification.on('action', () => {
      autoUpdater.quitAndInstall();
    });
    notification.show();
  });

  // Initial check for updates
  autoUpdater.checkForUpdatesAndNotify();
}

// Check for updates from GitHub repository
function checkForUpdates() {
  // Skip update check in development mode
  if (isDev) {
    console.log('Skipping update check in development mode');
    return Promise.resolve({ updateAvailable: false, isDev: true });
  }
  
  console.log('Checking for updates from korybantes/gangio-legacy repository');
  return autoUpdater.checkForUpdates()
    .then(() => {
      console.log('Update check initiated');
      return { updateAvailable: updateAvailable, isDev: false };
    })
    .catch(err => {
      console.error('Failed to check for updates:', err);
      return { updateAvailable: false, error: err.message };
    });
}

// Hardware acceleration settings
// Comment this line if images aren't visible
// app.disableHardwareAcceleration();

// Set application-level resource optimization
app.commandLine.appendSwitch('disable-smooth-scrolling');
app.commandLine.appendSwitch('disable-gpu-vsync');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,MediaSessionService');

// Get FPS limit from settings or use default (30fps)
const fpsLimit = store.get('fpsLimit', '30');
app.commandLine.appendSwitch('force-max-fps', fpsLimit);

// Additional performance optimizations
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-hang-monitor');
app.commandLine.appendSwitch('ignore-gpu-blacklist');
app.commandLine.appendSwitch('disable-web-security', 'false');

// Initialize app with optimizations
app.whenReady().then(() => {
  // Configure auto updater only if not in development mode
  if (!isDev) {
    configureAutoUpdater();
    console.log('Checking for updates on startup...');
  } else {
    console.log('Running in development mode - update checks disabled');
  }
  
  // Create system tray
  createTray();
  
  // Create splash screen first
  createSplashScreen();
  
  // Set up IPC handlers for updates - only register once
  if (!ipcMain.listenerCount('check-for-updates')) {
    ipcMain.on('check-for-updates', (event) => {
      checkForUpdates()
        .then(result => {
          // If in development mode, send a fake update status to the renderer
          if (result.isDev) {
            console.log('In development mode, not checking for real updates');
            // Optionally notify the renderer that we're in dev mode
            if (mainWindow) {
              mainWindow.webContents.send('update-check-result', { 
                inDevMode: true, 
                message: 'Update checking disabled in development mode'
              });
            }
          }
        })
        .catch(err => {
          console.error('Error in check-for-updates handler:', err);
        });
    });
  }
  
  if (!ipcMain.listenerCount('install-update')) {
    ipcMain.on('install-update', () => {
      autoUpdater.quitAndInstall(false, true);
    });
  }
  
  // Set up IPC handlers for window controls
  ipcMain.on('minimize-window', () => {
    if (mainWindow) mainWindow.minimize();
  });
  
  ipcMain.on('maximize-window', () => {
    if (mainWindow) {
      try {
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
        // Send the new maximized state back to the renderer
        if (titlebarView) {
          setTimeout(() => {
            titlebarView.webContents.send('maximized-state-changed', mainWindow.isMaximized());
          }, 100); // Small delay to ensure the state has changed
        }
      } catch (error) {
        console.error('Error toggling maximize state:', error);
      }
    }
  });
  

  
  ipcMain.on('close-window', () => {
    if (mainWindow) mainWindow.close();
  });
  
  // Add handler to check if window is maximized
  ipcMain.handle('is-window-maximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });
  
  // Set up IPC handlers for tray preferences
  ipcMain.handle('get-tray-preferences', () => {
    return {
      startMinimized: store.get('startMinimized', false),
      minimizeToTray: store.get('minimizeToTray', true),
      launchOnStartup: store.get('launchOnStartup', false),
      // Performance settings
      fpsLimit: store.get('fpsLimit', '30'),
      hardwareAcceleration: store.get('hardwareAcceleration', false),
      backgroundThrottling: store.get('backgroundThrottling', true),
      memoryLimit: store.get('memoryLimit', true),
      // Audio/video settings
      selectedMicrophone: store.get('selectedMicrophone', 'default'),
      selectedCamera: store.get('selectedCamera', 'default'),
      micLevel: store.get('micLevel', 75)
    };
  });

  ipcMain.handle('set-tray-preference', (event, key, value) => {
    store.set(key, value);
    
    // Handle special case for launch on startup
    if (key === 'launchOnStartup') {
      setAutoLaunch(value);
    }
    
    return true;
  });

  // IPC handlers for performance and device settings
  ipcMain.handle('save-setting', (event, key, value) => {
    store.set(key, value);
    
    // Apply settings that need immediate effect
    if (key === 'fpsLimit') {
      // We'll need to restart the app for this to take effect
      // Just save the setting for now
    } else if (key === 'hardwareAcceleration') {
      // This requires app restart to take effect
    }
    
    return true;
  });

  ipcMain.handle('get-settings', () => {
    return {
      fpsLimit: store.get('fpsLimit', '30'),
      hardwareAcceleration: store.get('hardwareAcceleration', false),
      backgroundThrottling: store.get('backgroundThrottling', true),
      memoryLimit: store.get('memoryLimit', true),
      selectedMicrophone: store.get('selectedMicrophone', 'default'),
      selectedCamera: store.get('selectedCamera', 'default'),
      micLevel: store.get('micLevel', 75)
    };
  });

  // Specific handlers for each setting
  ipcMain.handle('set-fps-limit', (event, fps) => {
    store.set('fpsLimit', fps);
    return true;
  });

  ipcMain.handle('set-hardware-acceleration', (event, enabled) => {
    store.set('hardwareAcceleration', enabled);
    return true;
  });

  ipcMain.handle('set-background-throttling', (event, enabled) => {
    store.set('backgroundThrottling', enabled);
    return true;
  });

  ipcMain.handle('set-memory-limit', (event, enabled) => {
    store.set('memoryLimit', enabled);
    return true;
  });

  ipcMain.handle('set-selected-microphone', (event, deviceId) => {
    store.set('selectedMicrophone', deviceId);
    return true;
  });

  // Listen for a request from the titlebar to quit and install the update
  ipcMain.on('quit-and-install-update', () => {
    autoUpdater.quitAndInstall();
  });

  ipcMain.handle('set-selected-camera', (event, deviceId) => {
    store.set('selectedCamera', deviceId);
    return true;
  });

  ipcMain.handle('set-mic-level', (event, level) => {
    store.set('micLevel', level);
    return true;
  });

  // Set up IPC handlers for settings window
  ipcMain.on('open-settings', () => {
    createSettingsWindow();
  });
  
  ipcMain.on('close-settings', () => {
    if (settingsWindow) {
      settingsWindow.close();
    }
  });
  
  // External links handler with error handling
  ipcMain.on('open-external', (event, url) => {
    try {
      if (url && typeof url === 'string' && url.startsWith('http')) {
        shell.openExternal(url).catch(err => {
          console.error('Failed to open external URL:', err);
        });
      } else {
        console.error('Invalid URL format:', url);
      }
    } catch (error) {
      console.error('Error opening external URL:', error);
    }
  });
  
  // Window maximize state handler
  ipcMain.handle('is-window-maximized', () => {
    try {
      return mainWindow ? mainWindow.isMaximized() : false;
    } catch (error) {
      console.error('Error checking maximize state:', error);
      return false;
    }
  });
  
  ipcMain.handle('set-tray-preference', (event, key, value) => {
    if (['startMinimized', 'minimizeToTray', 'launchOnStartup'].includes(key)) {
      store.set(key, value);
      
      // Update login item settings if necessary
      if (key === 'launchOnStartup') {
        app.setLoginItemSettings({
          openAtLogin: value
        });
      }
      
      // Notify renderer process of the change
      if (mainWindow) {
        mainWindow.webContents.send('tray-preference-changed', { key, value });
      }
      
      return true;
    }
    return false;
  });

  // Check for updates immediately on startup
  console.log('Checking for updates on startup...');
  checkForUpdates();
  
  // Schedule periodic update checks
  setInterval(() => {
    console.log('Performing scheduled update check...');
    checkForUpdates();
  }, 60 * 60 * 1000); // Check every hour
});

// Handle before-quit event to set forceQuit flag
app.on('before-quit', () => {
  forceQuit = true;
});

// Handle window-all-closed event
app.on('window-all-closed', () => {
  // On macOS, keep the app running even when all windows are closed
  if (process.platform !== 'darwin') {
    // Don't quit the app, just hide the window
    // The app will stay in the tray
  }
});

// Handle activate event (macOS)
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

// Handle quit event to clean up resources
app.on('quit', () => {
  if (tray) {
    tray.destroy();
    tray = null;
  }
});
