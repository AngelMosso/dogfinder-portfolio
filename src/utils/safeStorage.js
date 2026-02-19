/**
 * Utilidad para manejar localStorage de forma segura en modo Incógnito
 * Evita crashes "SecurityError: The operation is insecure."
 */
export const safeStorage = {
    getItem: (key) => {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn(`[SafeStorage] Acceso denegado a '${key}':`, e);
            return null;
        }
    },
    setItem: (key, value) => {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn(`[SafeStorage] Escritura denegada en '${key}':`, e);
            // En modo incógnito estricto, no podemos hacer mucho más que no crashear
        }
    },
    removeItem: (key) => {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn(`[SafeStorage] Borrado denegado en '${key}':`, e);
        }
    }
};
