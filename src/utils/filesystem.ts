import { URL } from 'url';
import * as path from 'path';
import { Endpoint, JavascriptFile } from '../types';

/**
 * Extracts the filename from a URL, mirroring the Go function's logic.
 * @param rawUrl The full URL to process.
 * @returns The extracted and truncated filename.
 */
export function getFileNameFromUrl(rawUrl: string): string {
    try {
        const parsedURL = new URL(rawUrl);

        // Use path.basename to reliably get the last part of the path
        let fileName = path.basename(parsedURL.pathname);

        if (fileName === "") {
            fileName = "index.html"
        }
        // Truncate if the filename is too long
        if (fileName.length > 100) {
            return fileName.substring(0, 100);
        }

        return fileName;
    } catch (error) {
        console.error(`Error parsing URL '${rawUrl}':`, error);
        // Return an empty string or a default name in case of error
        return 'file';
    }
}



export function getPath(storage_dir: string, url: string, hash: string) {
    const parsedURL = new URL(url);
    const domain = parsedURL.hostname;
    const fileName = getFileNameFromUrl(url);
    return path.join(storage_dir, domain, hash, fileName);
}

export function getStoragePath(storage_dir: string, url: string, hash: string) {
    const parsedURL = new URL(url);
    const domain = parsedURL.hostname;
    return path.join(storage_dir, "files", domain, hash);
}


export function getSourcemapDir(storage_dir: string, file: Endpoint | JavascriptFile): string {
    let domain;
    try {
        const url = new URL(file.url);
        domain = url.hostname;
    } catch (e) {
        domain = "unknown";
    }

    return path.join(storage_dir, domain, file.hash, "original");
}