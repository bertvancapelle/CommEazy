/**
 * Image Service — Profile photo processing
 *
 * Handles:
 * - Image selection from camera/gallery
 * - Cropping to square
 * - Resizing to 256x256
 * - JPEG compression (80% quality)
 * - Saving to Documents/avatars/
 *
 * Senior-inclusive considerations:
 * - Simple 2-option menu (Camera / Photo library)
 * - Automatic processing (no manual resize needed)
 * - Clear error messages
 *
 * Note: All native module imports are lazy to avoid Hermes race conditions.
 * See .claude/MOCK_MODE_CHANGES.md for details.
 *
 * @see .claude/skills/ui-designer/SKILL.md
 */

import { Alert } from 'react-native';

// Avatar specifications
const AVATAR_SIZE = 256; // pixels (good for 120px display @ 2x retina)
const AVATAR_QUALITY = 80; // JPEG quality percentage

// Lazy-loaded native modules to avoid Hermes race conditions
let _ImageCropPicker: typeof import('react-native-image-crop-picker').default | null = null;
let _RNFS: typeof import('react-native-fs') | null = null;
let _ImageResizer: typeof import('@bam.tech/react-native-image-resizer').default | null = null;
let _avatarsDirectory: string | null = null;

async function getImageCropPicker() {
  if (!_ImageCropPicker) {
    const module = await import('react-native-image-crop-picker');
    _ImageCropPicker = module.default;
  }
  return _ImageCropPicker;
}

async function getRNFS() {
  if (!_RNFS) {
    _RNFS = await import('react-native-fs');
  }
  return _RNFS;
}

async function getImageResizer() {
  if (!_ImageResizer) {
    const module = await import('@bam.tech/react-native-image-resizer');
    _ImageResizer = module.default;
  }
  return _ImageResizer;
}

async function getAvatarsDirectory() {
  if (!_avatarsDirectory) {
    const RNFS = await getRNFS();
    _avatarsDirectory = `${RNFS.DocumentDirectoryPath}/avatars`;
  }
  return _avatarsDirectory;
}

export interface ProcessedImage {
  path: string;
  width: number;
  height: number;
  size: number; // bytes
}

/**
 * Ensure the avatars directory exists
 */
async function ensureAvatarsDirectory(): Promise<void> {
  const RNFS = await getRNFS();
  const avatarsDir = await getAvatarsDirectory();
  const exists = await RNFS.exists(avatarsDir);
  if (!exists) {
    await RNFS.mkdir(avatarsDir);
  }
}

/**
 * Open image picker from camera
 */
export async function pickImageFromCamera(): Promise<ProcessedImage | null> {
  try {
    const ImageCropPicker = await getImageCropPicker();
    const image = await ImageCropPicker.openCamera({
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      cropping: true,
      cropperCircleOverlay: true, // Circle preview (looks nice for avatars)
      mediaType: 'photo',
      compressImageQuality: AVATAR_QUALITY / 100,
      forceJpg: true, // Always output JPEG
    });

    return processImage(image);
  } catch (error: unknown) {
    if (isUserCancellation(error)) {
      return null;
    }
    console.error('[ImageService] Camera error:', error);
    throw error;
  }
}

/**
 * Open image picker from photo library
 */
export async function pickImageFromGallery(): Promise<ProcessedImage | null> {
  try {
    const ImageCropPicker = await getImageCropPicker();
    const image = await ImageCropPicker.openPicker({
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      cropping: true,
      cropperCircleOverlay: true,
      mediaType: 'photo',
      compressImageQuality: AVATAR_QUALITY / 100,
      forceJpg: true,
    });

    return processImage(image);
  } catch (error: unknown) {
    if (isUserCancellation(error)) {
      return null;
    }
    console.error('[ImageService] Gallery error:', error);
    throw error;
  }
}

/**
 * Process and resize image to avatar specifications
 */
async function processImage(image: { path: string }): Promise<ProcessedImage> {
  const ImageResizer = await getImageResizer();

  // Resize to exact avatar size
  const resized = await ImageResizer.createResizedImage(
    image.path,
    AVATAR_SIZE,
    AVATAR_SIZE,
    'JPEG',
    AVATAR_QUALITY,
    0, // rotation
    undefined, // outputPath (auto)
    false, // keepMeta
    {
      mode: 'cover',
      onlyScaleDown: false,
    }
  );

  return {
    path: resized.uri.replace('file://', ''),
    width: resized.width,
    height: resized.height,
    size: resized.size,
  };
}

/**
 * Save processed image as avatar for a contact or user
 *
 * @param processedImage - The processed image from picker
 * @param identifier - JID or unique identifier for the avatar file
 * @returns Final path to the saved avatar
 */
export async function saveAvatar(
  processedImage: ProcessedImage,
  identifier: string
): Promise<string> {
  await ensureAvatarsDirectory();

  const RNFS = await getRNFS();
  const avatarsDir = await getAvatarsDirectory();

  // Sanitize identifier for filename
  const safeId = identifier.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${safeId}.jpg`;
  const destinationPath = `${avatarsDir}/${filename}`;

  // Remove old avatar if exists
  const exists = await RNFS.exists(destinationPath);
  if (exists) {
    await RNFS.unlink(destinationPath);
  }

  // Copy processed image to avatars directory
  await RNFS.copyFile(processedImage.path, destinationPath);

  // Clean up temporary file
  try {
    await RNFS.unlink(processedImage.path);
  } catch {
    // Ignore cleanup errors
  }

  return destinationPath;
}

/**
 * Delete an avatar file
 */
export async function deleteAvatar(identifier: string): Promise<void> {
  const RNFS = await getRNFS();
  const avatarsDir = await getAvatarsDirectory();

  const safeId = identifier.replace(/[^a-zA-Z0-9]/g, '_');
  const filepath = `${avatarsDir}/${safeId}.jpg`;

  const exists = await RNFS.exists(filepath);
  if (exists) {
    await RNFS.unlink(filepath);
  }
}

/**
 * Get the path to an avatar if it exists
 */
export async function getAvatarPath(identifier: string): Promise<string | null> {
  const RNFS = await getRNFS();
  const avatarsDir = await getAvatarsDirectory();

  const safeId = identifier.replace(/[^a-zA-Z0-9]/g, '_');
  const filepath = `${avatarsDir}/${safeId}.jpg`;

  const exists = await RNFS.exists(filepath);
  return exists ? filepath : null;
}

/**
 * Show photo source selection dialog
 *
 * @param t - Translation function
 * @param onCamera - Callback when camera is selected
 * @param onGallery - Callback when gallery is selected
 */
export function showPhotoSourceDialog(
  t: (key: string) => string,
  onCamera: () => void,
  onGallery: () => void
): void {
  Alert.alert(
    t('profile.changePhoto'),
    t('profile.selectSource'),
    [
      {
        text: t('chat.camera'),
        onPress: onCamera,
      },
      {
        text: t('chat.gallery'),
        onPress: onGallery,
      },
      {
        text: t('common.cancel'),
        style: 'cancel',
      },
    ]
  );
}

/**
 * Check if error is a user cancellation (not a real error)
 */
function isUserCancellation(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
    return (
      code === 'E_PICKER_CANCELLED' ||
      code === 'E_NO_IMAGE_DATA_FOUND'
    );
  }
  return false;
}

/**
 * Clean up all temporary image picker files
 */
export async function cleanupTempImages(): Promise<void> {
  try {
    const ImageCropPicker = await getImageCropPicker();
    await ImageCropPicker.clean();
  } catch {
    // Ignore cleanup errors
  }
}
