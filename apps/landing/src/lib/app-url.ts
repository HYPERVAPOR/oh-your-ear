/** Where "开始练习" goes. Configurable because the two sites live on different hosts in
 *  production and on different ports in development. */
export const APP_URL = import.meta.env.VITE_APP_URL ?? 'http://localhost:5173'
