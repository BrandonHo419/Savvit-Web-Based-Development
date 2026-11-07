// Browser checks provide early feedback; the server independently checks bytes.
export function uploadError(file) {
    if (!file) return 'Please select an image.';
    if (file.size > 10_000_000) return 'Image must be no larger than 10 MB (10,000,000 bytes).';
    if (!file.size) return 'Please select a nonempty image.';
    const extension = file.name.split('.').pop().toLowerCase();
    const expected = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[extension];
    if (!expected || (file.type && file.type !== 'application/octet-stream' && file.type !== expected)) {
        return 'Use a JPEG, PNG or WebP image with a matching file extension.';
    }
    return '';
}
