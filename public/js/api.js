let sessionPromise;

export function clearSession() {
    sessionPromise = undefined;
}

export function getSession({ refresh = false } = {}) {
    if (refresh) clearSession();
    if (!sessionPromise) {
        const pending = fetch('/users/profile', { credentials: 'same-origin', cache: 'no-store' })
            .then(async response => {
                if (response.status === 401) {
                    if (sessionPromise === pending) clearSession();
                    return null;
                }
                if (!response.ok) throw new Error('Unable to load your session. Please retry.');
                return response.json();
            })
            .catch(error => {
                // An older request must not discard a newer session refresh.
                if (sessionPromise === pending) clearSession();
                throw error;
            });
        sessionPromise = pending;
    }
    return sessionPromise;
}

export async function apiFetch(url, options = {}) {
    const pending = getSession();
    const usedPromise = sessionPromise;
    const session = await pending;
    const headers = new Headers(options.headers);
    const method = (options.method || 'GET').toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && session?.csrfToken) {
        headers.set('X-CSRF-TOKEN', session.csrfToken);
    }
    const response = await fetch(url, { ...options, headers, credentials: 'same-origin' });
    // Return the failed response without replaying a possibly destructive operation.
    if ((response.status === 401 || response.status === 403) && sessionPromise === usedPromise) clearSession();
    return response;
}
