/**
 * Клиент backend API Saran (регистрация/вход + серверный прогресс).
 * Подключается как обычный <script> ДО основного инлайн-скрипта index.html
 * и не зависит от остального кода приложения — просто предоставляет
 * window.SaranAPI с методами для работы с /api/auth/* и /api/progress/*.
 *
 * Access-токен живёт в sessionStorage (в памяти вкладки), refresh-токен —
 * в httpOnly cookie на стороне бэкенда, поэтому руками его не трогаем.
 * Все запросы идут с credentials:'include', чтобы cookie долетала.
 */
(function (global) {
    'use strict';

    // Базовый URL API. Пустая строка = относительные пути (/api/...), которые
    // на проде проходят через прокси Vercel на тот же домен, что и фронтенд —
    // это избавляет от CORS-возни и позволяет refresh-cookie работать как same-site.
    // Можно переопределить до подключения этого файла: window.SARAN_API_BASE = 'https://...'
    var API_BASE = typeof global.SARAN_API_BASE === 'string' ? global.SARAN_API_BASE : '';

    var ACCESS_TOKEN_KEY = 'saran_access_token_v1';
    var USER_CACHE_KEY = 'saran_auth_user_v1';

    var state = {
        accessToken: null,
        user: null,
        refreshPromise: null,
    };

    function readSession(key) {
        try {
            return sessionStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    function writeSession(key, value) {
        try {
            if (value === null || value === undefined) sessionStorage.removeItem(key);
            else sessionStorage.setItem(key, value);
        } catch (e) {
            /* ignore (приватный режим / отключено хранилище) */
        }
    }

    // Восстанавливаем то, что уже было получено в этой вкладке.
    state.accessToken = readSession(ACCESS_TOKEN_KEY);
    try {
        var cachedUser = readSession(USER_CACHE_KEY);
        state.user = cachedUser ? JSON.parse(cachedUser) : null;
    } catch (eParseUser) {
        state.user = null;
    }

    function setSession(accessToken, user) {
        state.accessToken = accessToken || null;
        state.user = user || null;
        writeSession(ACCESS_TOKEN_KEY, state.accessToken);
        writeSession(USER_CACHE_KEY, state.user ? JSON.stringify(state.user) : null);
    }

    function clearSession() {
        setSession(null, null);
    }

    function isLoggedIn() {
        return !!state.accessToken;
    }

    function getUser() {
        return state.user;
    }

    function parseJsonSafe(res) {
        return res
            .json()
            .catch(function () {
                return null;
            });
    }

    function rawRequest(path, options) {
        options = options || {};
        var headers = {};
        for (var k in options.headers || {}) headers[k] = options.headers[k];

        var hasBody = options.body !== undefined && options.body !== null;
        if (hasBody && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
        if (state.accessToken) headers['Authorization'] = 'Bearer ' + state.accessToken;

        return fetch(API_BASE + path, {
            method: options.method || 'GET',
            headers: headers,
            credentials: 'include', // обязательно для refresh-cookie
            body: hasBody
                ? typeof options.body === 'string'
                    ? options.body
                    : JSON.stringify(options.body)
                : undefined,
        });
    }

    /**
     * Запрос с автоматическим "тихим" рефрешем access-токена по refresh-cookie
     * при 401 и одной повторной попыткой.
     */
    function request(path, options, isRetry) {
        return rawRequest(path, options).then(function (res) {
            if (res.status === 401 && !isRetry && path !== '/api/auth/refresh') {
                return tryRefresh().then(function (refreshed) {
                    if (refreshed) return request(path, options, true);
                    return finalizeResponse(res);
                });
            }
            return finalizeResponse(res);
        });
    }

    function finalizeResponse(res) {
        return parseJsonSafe(res).then(function (data) {
            if (!res.ok) {
                var err = new Error((data && data.message) || 'HTTP ' + res.status);
                err.status = res.status;
                err.code = data && data.error;
                err.details = data && data.details;
                throw err;
            }
            return data;
        });
    }

    function tryRefresh() {
        if (state.refreshPromise) return state.refreshPromise;
        state.refreshPromise = rawRequest('/api/auth/refresh', { method: 'POST' })
            .then(function (res) {
                return parseJsonSafe(res).then(function (data) {
                    if (!res.ok || !data || !data.accessToken) {
                        clearSession();
                        return false;
                    }
                    setSession(data.accessToken, data.user);
                    return true;
                });
            })
            .catch(function () {
                clearSession();
                return false;
            })
            .finally(function () {
                state.refreshPromise = null;
            });
        return state.refreshPromise;
    }

    // --- Публичное API ---

    function register(payload) {
        return request('/api/auth/register', { method: 'POST', body: payload }).then(function (data) {
            setSession(data.accessToken, data.user);
            return data;
        });
    }

    function login(payload) {
        return request('/api/auth/login', { method: 'POST', body: payload }).then(function (data) {
            setSession(data.accessToken, data.user);
            return data;
        });
    }

    function logout() {
        return request('/api/auth/logout', { method: 'POST' })
            .catch(function () {
                /* игнорируем сетевые ошибки при выходе — всё равно чистим локально */
            })
            .then(function () {
                clearSession();
            });
    }

    function me() {
        return request('/api/auth/me', { method: 'GET' }).then(function (data) {
            state.user = data.user;
            writeSession(USER_CACHE_KEY, JSON.stringify(data.user));
            return data.user;
        });
    }

    function forgotPassword(email) {
        return request('/api/auth/forgot-password', { method: 'POST', body: { email: email } });
    }

    function resetPassword(token, newPassword) {
        return request('/api/auth/reset-password', {
            method: 'POST',
            body: { token: token, newPassword: newPassword },
        });
    }

    function getProgress() {
        return request('/api/progress', { method: 'GET' }).then(function (data) {
            return data.progress;
        });
    }

    function saveProgress(payload) {
        return request('/api/progress', { method: 'PUT', body: payload }).then(function (data) {
            return data.progress;
        });
    }

    function mergeProgress(payload) {
        return request('/api/progress/merge', { method: 'POST', body: payload }).then(function (data) {
            return data.progress;
        });
    }

    /**
     * Пытается тихо восстановить сессию по refresh-cookie (например, после
     * перезагрузки страницы или в новой вкладке), не требуя явного логина.
     * Возвращает Promise<boolean> — восстановлена ли сессия.
     */
    function restoreSession() {
        if (state.accessToken) return Promise.resolve(true);
        return tryRefresh();
    }

    global.SaranAPI = {
        isLoggedIn: isLoggedIn,
        getUser: getUser,
        register: register,
        login: login,
        logout: logout,
        me: me,
        forgotPassword: forgotPassword,
        resetPassword: resetPassword,
        getProgress: getProgress,
        saveProgress: saveProgress,
        mergeProgress: mergeProgress,
        restoreSession: restoreSession,
    };
})(window);
