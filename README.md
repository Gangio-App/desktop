# Gangio Desktop App

A modern desktop client for the Gangio web application with enhanced features and a beautiful UI.

[![GitHub license](https://img.shields.io/github/license/Gangio-App/desktop)](https://github.com/Gangio-App/desktop/blob/main/LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/Gangio-App/desktop)](https://github.com/Gangio-App/desktop/releases/latest)
[![GitHub issues](https://img.shields.io/github/issues/Gangio-App/desktop)](https://github.com/korybantes/Gangio-App/desktop/issues)

## Overview

This Electron-based desktop application provides a premium native desktop experience for the Gangio web app. It features a modern glassmorphic design with animated elements, system tray integration, and customizable settings. The app directly loads the web application from https://gangio.vercel.app while adding valuable desktop-specific features.

## Features

- **Modern UI**: Beautiful glassmorphic design with animated particles and modern aesthetics
- **System Tray Integration**: Minimize to tray functionality keeps the app running in the background
- **Custom Titlebar**: Sleek custom titlebar with window controls and settings access
- **Settings Panel**: Configure app behavior including startup options
- **Performance Optimization**: Adjustable FPS settings and resource usage controls
- **Audio & Video Settings**: Microphone and camera selection with testing capabilities
- **Auto Updates**: Receive automatic updates when new versions are released
- **Splash Screen**: Stylish splash screen with loading progress and fun facts
- **Auto Launch**: Option to automatically start the app when your system boots
- **External Links**: Open external links in your default browser
- **Error Handling**: Graceful error handling with retry options

## Author

**Gangio** - A modern platform for digital interaction

- Website: [https://gangio.pro](https://gangio.pro)
- GitHub: [@korybantes](https://github.com/korybantes)

### Prerequisites

- Node.js (v14 or later)
- npm or pnpm

### Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
   or with pnpm:
   ```
   pnpm install
   ```

### Running the App

To start the application in development mode:

```
npm start
```

### Building the App

To build the application for distribution:

```
npm run build
```

This will create distributable packages in the `dist` folder.

#### Platform-Specific Builds

Build for Windows only:
```
npm run build:win
```

Build for macOS only:
```
npm run build:mac
```

Build for Linux only:
```
npm run build:linux
```

Build for all platforms:
```
npm run build:all
```

### Custom Installer

The app includes a custom installer with the following features:

- Branded installer with Gangio logo and colors
- Option to choose installation directory
- Desktop and Start Menu shortcuts
- Auto-launch on system startup option
- Proper uninstaller

The installer is built using electron-builder with NSIS for Windows. The configuration is in the `build` section of `package.json`.

### Publishing Updates

To build and publish an update:

1. Update the version number in `package.json`
2. Run:
   ```
   npm run publish
   ```

## Project Structure

- `src/main.js` - Main Electron process
- `src/preload.js` - Preload script for secure IPC communication
- `src/splash.html` - Splash screen displayed during startup
- `resources/` - Application resources (icons, etc.)

## License

MIT
"# gangiodesktop" 
