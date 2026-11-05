let sessionPromise;

export function getSession() {
    if (!sessionPromise) {
        sessionPromise = fetch('/users/profile', { credentials: 'same-origin', cache: 'no-store' })
            .then(async response => {
                if (response.status === 401) return null;
                if (!response.ok) throw new Error('Unable to load your session. Please reload.');
                return response.json();
            });
    }
    return sessionPromise;
}

export async function apiFetch(url, options = {}) {
    const session = await getSession();
    const headers = new Headers(options.headers);
    const method = (options.method || 'GET').toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && session?.csrfToken) {
        headers.set('X-CSRF-TOKEN', session.csrfToken);
    }
    return fetch(url, { ...options, headers, credentials: 'same-origin' });
}
