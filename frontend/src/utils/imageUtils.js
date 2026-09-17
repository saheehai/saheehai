/**
 * Turn a chosen file into the small square picture the profile stores.
 *
 * Everything happens in the browser. The image is decoded, centre-cropped
 * to a square, drawn at AVATAR_SIZE and re-encoded as JPEG. Re-encoding is
 * what makes this safe to store as-is: whatever the file was (an SVG, an
 * animated GIF, a photo with GPS data in its EXIF), the result is a plain
 * bitmap with no metadata. The server checks the bytes again.
 */

export const AVATAR_SIZE = 128;
const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const JPEG_QUALITY = 0.85;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    img.src = url;
  });
}

export async function fileToAvatarDataUrl(file) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('That image is too large. Please choose one under 10 MB.');
  }

  const img = await loadImage(file);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  if (!side) throw new Error('That file could not be read as an image.');

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');
  // A cream backdrop so transparent PNGs do not turn black in a JPEG.
  ctx.fillStyle = '#FFF8E7';
  ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.drawImage(
    img,
    (img.naturalWidth - side) / 2,
    (img.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE
  );
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}
