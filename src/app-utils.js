const { app } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * Resolves a resource path that works in both development and production environments
 * @param {string} resourcePath - Path relative to the app root
 * @returns {string} - Resolved absolute path
 */
function resolveResourcePath(resourcePath) {
  // Log the current execution environment
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  console.log(`Resolving path in ${isDev ? 'development' : 'production'} mode:`, resourcePath);
  
  try {
    // Try multiple possible locations
    const possiblePaths = [
      // Development paths
      path.join(__dirname, '..', resourcePath),
      path.join(__dirname, resourcePath),
      
      // Production paths
      path.join(process.resourcesPath, 'app', resourcePath),
      path.join(process.resourcesPath, resourcePath),
      path.join(app.getAppPath(), resourcePath),
      
      // Additional fallbacks
      path.join(app.getPath('exe'), '..', resourcePath),
      path.join(app.getPath('userData'), resourcePath)
    ];
    
    // Find the first path that exists
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        console.log('Found resource at:', possiblePath);
        return possiblePath;
      }
    }
    
    // If no path exists, return the most likely path and log a warning
    console.warn(`Resource not found: ${resourcePath}. Using best guess.`);
    return isDev 
      ? path.join(__dirname, '..', resourcePath) 
      : path.join(process.resourcesPath, 'app', resourcePath);
  } catch (error) {
    console.error(`Error resolving resource path for ${resourcePath}:`, error);
    // Return a simple fallback as last resort
    return path.join(__dirname, resourcePath);
  }
}

module.exports = {
  resolveResourcePath
};
