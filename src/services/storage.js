import { open } from '@tauri-apps/plugin-dialog';
import { readFile, writeFile, mkdir, BaseDirectory, exists } from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';
import { appLocalDataDir, join } from '@tauri-apps/api/path';

/**
 * Saves an image to the app's local data directory
 * @returns {Promise<string|null>} The relative path to the saved image or null if cancelled
 */
export async function pickAndSaveImage() {
  try {
    // 1. Pick a file
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: 'Image',
          extensions: ['png', 'jpeg', 'jpg', 'webp', 'gif'],
        },
      ],
    });

    if (!selected || typeof selected !== 'string') return null;

    // 2. Load the file data
    const fileData = await readFile(selected);

    // 3. Ensure the 'images' directory exists in AppLocalData
    if (!(await exists('images', { baseDir: BaseDirectory.AppLocalData }))) {
      await mkdir('images', { baseDir: BaseDirectory.AppLocalData });
    }

    // 4. Create a unique filename
    const extension = selected.split('.').pop();
    const filename = `img_${Date.now()}.${extension}`;
    const targetPath = `images/${filename}`;

    // 5. Write the file to AppLocalData
    await writeFile(targetPath, fileData, { baseDir: BaseDirectory.AppLocalData });

    console.log('Image saved successfully to:', targetPath);
    return targetPath;
  } catch (err) {
    console.error('Failed to save image:', err);
    throw err;
  }
}

/**
 * Resolves a stored image path to a URL that can be displayed in the UI
 * @param {string} path Stored path (e.g. 'images/img_123.png') 
 */
export async function resolveImagePath(path) {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('blob:') || path.startsWith('data:')) return path;
  
  try {
    // Read the file directly using the FS plugin (which we know has permissions)
    const fileData = await readFile(path, { baseDir: BaseDirectory.AppLocalData });
    const extension = path.split('.').pop()?.toLowerCase();
    const mimeType = extension === 'png' ? 'image/png' 
                   : extension === 'webp' ? 'image/webp'
                   : extension === 'gif' ? 'image/gif' 
                   : 'image/jpeg';
                   
    const blob = new Blob([fileData], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error('Error resolving image path:', err);
    return null;
  }
}

