export function getEndpointDisplayName(rawUrl: string): string {
    const url = new URL(rawUrl);
    let path = url.pathname;

    if (path === '/' || !path) {
        return '/';
    }

    // Limpiar el path
    path = path.replace(/\/+/g, '/');
    if (path.endsWith('/')) {
        path = path.slice(0, -1);
    }

    // Retornar el path completo, sin truncar
    return path;
}

export function getDomainFromUrl(urlString: string): string {
    try {
        const url = new URL(urlString);
        return url.hostname;
    } catch (e) {
        console.error('Invalid URL:', urlString);
    }
    return '';
}

export function getFullPath(url: string): string {
    try {
        const urlObj = new URL(url);
        return urlObj.pathname;
    } catch {
        return url;
    }
}