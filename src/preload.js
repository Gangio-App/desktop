const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electronAPI', {
    // Updates
    checkForUpdates: () => ipcRenderer.send('check-for-updates'),
    installUpdate: () => ipcRenderer.send('install-update'),
    
    // App info and settings
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    
    // Splash screen
    splashScreenReady: () => ipcRenderer.send('splash-screen-ready'),
    
    // Window controls for custom titlebar
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    maximizeWindow: () => ipcRenderer.send('maximize-window'),
    closeWindow: () => ipcRenderer.send('close-window'),
    openSettings: () => ipcRenderer.send('open-settings'),
    closeSettings: () => ipcRenderer.send('close-settings'),
    
    // Update listeners
    onUpdateAvailable: (callback) => {
      ipcRenderer.on('update-available', () => callback());
      return () => ipcRenderer.removeListener('update-available', callback);
    },
    
    onUpdateDownloaded: (callback) => {
      ipcRenderer.on('update-downloaded', () => callback());
      return () => ipcRenderer.removeListener('update-downloaded', callback);
    },
    
    onUpdateCheckResult: (callback) => {
      ipcRenderer.on('update-check-result', (event, result) => callback(result));
      return () => ipcRenderer.removeListener('update-check-result', callback);
    },
    
    // Tray preferences
    getTrayPreferences: () => ipcRenderer.invoke('get-tray-preferences'),
    setTrayPreference: (key, value) => ipcRenderer.invoke('set-tray-preference', key, value),
    onTrayPreferenceChanged: (callback) => {
      ipcRenderer.on('tray-preference-changed', callback);
      return () => ipcRenderer.removeListener('tray-preference-changed', callback);
    },
    
    // Performance and device settings
    saveSetting: (key, value) => ipcRenderer.invoke('save-setting', key, value),
    getSettings: (callback) => {
      ipcRenderer.invoke('get-settings').then(settings => callback(settings));
    },
    setFpsLimit: (fps) => ipcRenderer.invoke('set-fps-limit', fps),
    setHardwareAcceleration: (enabled) => ipcRenderer.invoke('set-hardware-acceleration', enabled),
    setBackgroundThrottling: (enabled) => ipcRenderer.invoke('set-background-throttling', enabled),
    setMemoryLimit: (enabled) => ipcRenderer.invoke('set-memory-limit', enabled),
    setSelectedMicrophone: (deviceId) => ipcRenderer.invoke('set-selected-microphone', deviceId),
    setSelectedCamera: (deviceId) => ipcRenderer.invoke('set-selected-camera', deviceId),
    setMicLevel: (level) => ipcRenderer.invoke('set-mic-level', level),
    
    // Window state
    onMaximizedStateChanged: (callback) => {
      const wrappedCallback = (event, isMaximized) => callback(isMaximized);
      ipcRenderer.on('maximized-state-changed', wrappedCallback);
      return () => ipcRenderer.removeListener('maximized-state-changed', wrappedCallback);
    },
    isWindowMaximized: () => ipcRenderer.invoke('is-window-maximized'),
    
    // External links
    openExternal: (url) => ipcRenderer.send('open-external', url),
    
    // Environment info
    isElectron: true
  }
);
