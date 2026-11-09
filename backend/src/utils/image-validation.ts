import { imageSize } from 'image-size';
import fs from 'fs';

export const MIN_PROFILE_IMAGE_DIMENSION = 100;
export const MAX_PROFILE_IMAGE_DIMENSION = 250;

export function hasAllowedProfileImageDimensions(filePath: string): boolean {
    try {
        const dimensions = imageSize(fs.readFileSync(filePath));
        return dimensions.width >= MIN_PROFILE_IMAGE_DIMENSION
            && dimensions.width <= MAX_PROFILE_IMAGE_DIMENSION
            && dimensions.height >= MIN_PROFILE_IMAGE_DIMENSION
            && dimensions.height <= MAX_PROFILE_IMAGE_DIMENSION;
    } catch {
        return false;
    }
}

export function isProductImage(filePath: string): boolean {
    try {
        const image = imageSize(fs.readFileSync(filePath));
        return ['jpg', 'png', 'gif'].includes(image.type || '') && image.width > 0 && image.height > 0;
    } catch {
        return false;
    }
}
