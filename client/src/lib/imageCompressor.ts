import { sharedColors } from '../theme/colorTokens';

export const MAX_COMPRESSED_IMAGE_SIZE_BYTES = 4.5 * 1024 * 1024;

const COMPRESSION_ATTEMPTS = [
  { scale: 1, quality: 1 },
  { scale: 1, quality: 0.85 },
  { scale: 1, quality: 0.7 },
  { scale: 0.8, quality: 0.8 },
  { scale: 0.64, quality: 0.75 },
  { scale: 0.512, quality: 0.7 },
  { scale: 0.41, quality: 0.65 },
  { scale: 0.33, quality: 0.6 },
];

function readImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const img = new Image();
      img.src = reader.result as string;
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
  });
}

function encodeJpeg(
  img: HTMLImageElement,
  width: number,
  height: number,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    ctx.fillStyle = sharedColors.white;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas toBlob failed'));
          return;
        }
        if (blob.type !== 'image/jpeg') {
          reject(new Error('Browser could not encode the image as JPEG'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality
    );
  });
}

export async function compressImage(
  file: File,
  maxDimension = 1280,
  quality = 0.8,
  maxSizeBytes = MAX_COMPRESSED_IMAGE_SIZE_BYTES
): Promise<Blob> {
  const img = await readImage(file);
  const scaleToMaxDimension = Math.min(1, maxDimension / img.width, maxDimension / img.height);
  const baseWidth = Math.max(1, Math.round(img.width * scaleToMaxDimension));
  const baseHeight = Math.max(1, Math.round(img.height * scaleToMaxDimension));

  for (const attempt of COMPRESSION_ATTEMPTS) {
    const width = Math.max(1, Math.round(baseWidth * attempt.scale));
    const height = Math.max(1, Math.round(baseHeight * attempt.scale));
    const blob = await encodeJpeg(img, width, height, quality * attempt.quality);
    if (blob.size <= maxSizeBytes) return blob;
  }

  throw new Error(`Image could not be compressed below ${maxSizeBytes} bytes`);
}
