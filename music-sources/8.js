/*
 * MusicFree plugin for ChKSz API.
 *
 * Configure the API key from MusicFree's plugin user variables. The key is
 * intentionally not embedded in this file.
 */
/* global env */

const axios = require('axios');
const CryptoJS = require('crypto-js');

const API_BASE = 'https://api.chksz.com';
const KUGOU_DETAIL_API = 'https://m.kugou.com/app/i/getSongInfo.php';
const KUGOU_SEARCH_API = 'https://songsearch.kugou.com/song_search_v2';
const KUGOU_MV_API = 'http://trackermv.kugou.com/interface/index/cmd=100';
const KUGOU_LYRIC_API = 'https://m3ws.kugou.com/api/v1/krc/get_lyrics';
const KUGOU_LEGACY_LYRIC_API = 'https://m.kugou.com/app/i/krc.php';
const PLUGIN_PLATFORM = '智酷狗';
const PAGE_SIZE = 30;
const SOURCE_NETEASE = 'netease';
const SOURCE_QQ = 'qq';
const SOURCE_KUGOU = 'kugou';
const FIXED_SOURCE = SOURCE_KUGOU;
const DETAIL_CACHE_TTL = 30 * 60 * 1000;
const DETAIL_CACHE_LIMIT = 100;
const SEARCH_CACHE_TTL = 2 * 60 * 1000;
const SEARCH_CACHE_LIMIT = 30;
const PUBLIC_REQUEST_TIMEOUT = 3000;
const PUBLIC_CACHE_TTL = 30 * 60 * 1000;
const PUBLIC_NEGATIVE_CACHE_TTL = 30 * 1000;
const PUBLIC_CACHE_LIMIT = 100;
const MEDIA_FAILURE_TTL = 5000;
const MEDIA_FAILURE_LIMIT = 100;

let activeCredential = null;
let credentialSequence = 0;
let blockedCredential = null;
const detailCache = new Map();
const pendingRequests = new Map();
const searchCache = new Map();
const pendingPublicRequests = new Map();
const pendingPublicFallbacks = new Map();
const publicFallbackCache = new Map();
const mediaFailures = new Map();

function getVariables() {
    try {
        return (
            (env && typeof env.getUserVariables === 'function'
                ? env.getUserVariables()
                : {}) || {}
        );
    } catch (_) {
        return {};
    }
}

function makeStatusError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function getCredential() {
    const value = String(getVariables().apikey || '').trim();
    if (!value) {
        throw makeStatusError(
            401,
            '[ChKSz 401] 请先在插件设置中填写个人 API Key',
        );
    }
    if (!activeCredential || activeCredential.value !== value) {
        credentialSequence += 1;
        activeCredential = {
            value,
            fingerprint: String(credentialSequence),
        };
    }
    const credential = activeCredential;
    if (
        blockedCredential &&
        blockedCredential.fingerprint === credential.fingerprint
    ) {
        if (blockedCredential.until > Date.now()) {
            throw makeStatusError(
                blockedCredential.status,
                blockedCredential.message,
            );
        }
        blockedCredential = null;
    }
    if (blockedCredential) {
        blockedCredential = null;
    }
    return credential;
}

function normalizeSource(value) {
    const source = String(value || '')
        .trim()
        .toLowerCase();
    if (
        source === SOURCE_NETEASE ||
        source === '163' ||
        source === '网易云' ||
        source === '网易云音乐'
    ) {
        return SOURCE_NETEASE;
    }
    if (source === SOURCE_KUGOU || source === 'kg' || source === '酷狗') {
        return SOURCE_KUGOU;
    }
    if (source === 'all' || source === '全部' || source === '全部平台') {
        return 'all';
    }
    return FIXED_SOURCE;
}

function getSearchSource() {
    return FIXED_SOURCE;
}

function getErrorMessage(status, body, fallback) {
    const message = body && (body.msg || body.message || body.error);
    if (message) {
        return String(message);
    }
    if (status === 401) {
        return '缺少或无效的 apikey，请检查插件设置';
    }
    if (status === 402) {
        return '免费和付费额度均已用尽';
    }
    if (status === 403) {
        return '用户、Key 或 IP 被封禁';
    }
    if (status === 429) {
        return '超过速率限制，请稍后重试';
    }
    if (status === 503) {
        return '音乐服务暂时不可用，请稍后重试';
    }
    return fallback || '请求失败';
}

function throwApiError(
    status,
    body,
    fallback,
    credential,
    retryAfterMilliseconds,
) {
    const message =
        '[ChKSz ' +
        (status || 'network') +
        '] ' +
        getErrorMessage(status, body, fallback);
    if (
        (status === 401 || status === 402 || status === 403) &&
        credential === activeCredential
    ) {
        blockedCredential = {
            fingerprint: credential.fingerprint,
            status,
            message,
            until: Date.now() + 5000,
        };
    } else if (status === 429 && credential === activeCredential) {
        blockedCredential = {
            fingerprint: credential.fingerprint,
            status,
            message,
            until: Date.now() + Math.max(1000, retryAfterMilliseconds || 0),
        };
    }
    throw makeStatusError(status, message);
}

function wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function getRetryAfterMilliseconds(headers) {
    const rawValue =
        headers && (headers['retry-after'] || headers['Retry-After']);
    if (rawValue === undefined || rawValue === null || rawValue === '') {
        return 1000;
    }
    const seconds = Number(rawValue);
    if (isFinite(seconds)) {
        return Math.max(0, seconds * 1000);
    }
    const retryAt = Date.parse(String(rawValue));
    return isFinite(retryAt) ? Math.max(0, retryAt - Date.now()) : 1000;
}

function stableStringify(value) {
    if (!value || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return '[' + value.map(stableStringify).join(',') + ']';
    }
    return (
        '{' +
        Object.keys(value)
            .sort()
            .map(key => JSON.stringify(key) + ':' + stableStringify(value[key]))
            .join(',') +
        '}'
    );
}

async function performRequest(path, params, credential, hasRetried) {
    let response;
    try {
        response = await axios.get(API_BASE + path, {
            params: Object.assign({}, params || {}, {
                apikey: credential.value,
            }),
            timeout: 10000,
        });
    } catch (error) {
        const status = error && error.response && error.response.status;
        const body = error && error.response && error.response.data;
        const retryAfterMilliseconds = getRetryAfterMilliseconds(
            error && error.response && error.response.headers,
        );
        if (status === 429 && !hasRetried) {
            await wait(retryAfterMilliseconds);
            return performRequest(path, params, credential, true);
        }
        throwApiError(
            status,
            body,
            error && error.message,
            credential,
            retryAfterMilliseconds,
        );
    }

    const body = response && response.data;
    const businessCode =
        body && body.code !== undefined ? Number(body.code) : 200;
    if (businessCode !== 200) {
        if (businessCode === 429 && !hasRetried) {
            await wait(1000);
            return performRequest(path, params, credential, true);
        }
        throwApiError(businessCode, body, body.msg, credential, 1000);
    }
    return body || {};
}

function request(path, params) {
    const credential = getCredential();
    const requestKey =
        credential.fingerprint +
        '|' +
        path +
        '|' +
        stableStringify(params || {});
    const existing = pendingRequests.get(requestKey);
    if (existing) {
        return existing;
    }

    let pending = performRequest(path, params, credential, false);
    pending = pending.then(
        result => {
            if (pendingRequests.get(requestKey) === pending) {
                pendingRequests.delete(requestKey);
            }
            return result;
        },
        error => {
            if (pendingRequests.get(requestKey) === pending) {
                pendingRequests.delete(requestKey);
            }
            throw error;
        },
    );
    pendingRequests.set(requestKey, pending);
    return pending;
}

function cloneSearchResult(result) {
    return Object.assign({}, result, {
        data: Array.isArray(result && result.data)
            ? result.data.map(item => Object.assign({}, item))
            : [],
    });
}

function getCachedSearch(key) {
    const cached = searchCache.get(key);
    if (!cached) {
        return null;
    }
    if (cached.expiresAt <= Date.now()) {
        searchCache.delete(key);
        return null;
    }
    searchCache.delete(key);
    searchCache.set(key, cached);
    return cloneSearchResult(cached.result);
}

function rememberSearch(key, result) {
    searchCache.delete(key);
    searchCache.set(key, {
        result: cloneSearchResult(result),
        expiresAt: Date.now() + SEARCH_CACHE_TTL,
    });
    while (searchCache.size > SEARCH_CACHE_LIMIT) {
        searchCache.delete(searchCache.keys().next().value);
    }
}

function publicGet(url, params, headers) {
    const requestHeaders = Object.assign(
        {
            'User-Agent': 'Mozilla/5.0',
        },
        headers || {},
    );
    const requestKey =
        url +
        '|' +
        stableStringify(params || {}) +
        '|' +
        stableStringify(requestHeaders);
    const existing = pendingPublicRequests.get(requestKey);
    if (existing) {
        return existing;
    }

    let pending = axios
        .get(url, {
            params: params || {},
            timeout: PUBLIC_REQUEST_TIMEOUT,
            headers: requestHeaders,
        })
        .then(response => response && response.data);
    pending = pending.then(
        result => {
            if (pendingPublicRequests.get(requestKey) === pending) {
                pendingPublicRequests.delete(requestKey);
            }
            return result;
        },
        error => {
            if (pendingPublicRequests.get(requestKey) === pending) {
                pendingPublicRequests.delete(requestKey);
            }
            throw error;
        },
    );
    while (pendingPublicRequests.size >= PUBLIC_CACHE_LIMIT) {
        pendingPublicRequests.delete(pendingPublicRequests.keys().next().value);
    }
    pendingPublicRequests.set(requestKey, pending);
    return pending;
}

function clonePublicFallback(value) {
    return value && typeof value === 'object'
        ? Object.assign({}, value)
        : value;
}

function getCachedPublicFallback(key) {
    const cached = publicFallbackCache.get(key);
    if (!cached) {
        return null;
    }
    if (cached.expiresAt <= Date.now()) {
        publicFallbackCache.delete(key);
        return null;
    }
    publicFallbackCache.delete(key);
    publicFallbackCache.set(key, cached);
    return {value: clonePublicFallback(cached.value)};
}

function rememberPublicFallback(key, value) {
    publicFallbackCache.delete(key);
    publicFallbackCache.set(key, {
        value: clonePublicFallback(value),
        expiresAt:
            Date.now() + (value ? PUBLIC_CACHE_TTL : PUBLIC_NEGATIVE_CACHE_TTL),
    });
    while (publicFallbackCache.size > PUBLIC_CACHE_LIMIT) {
        publicFallbackCache.delete(publicFallbackCache.keys().next().value);
    }
}

function getOrLoadPublicFallback(key, loader) {
    const cached = getCachedPublicFallback(key);
    if (cached) {
        return Promise.resolve(cached.value);
    }
    const existing = pendingPublicFallbacks.get(key);
    if (existing) {
        return existing;
    }

    let pending = Promise.resolve().then(loader);
    pending = pending.then(
        value => {
            if (pendingPublicFallbacks.get(key) === pending) {
                pendingPublicFallbacks.delete(key);
            }
            rememberPublicFallback(key, value);
            return clonePublicFallback(value);
        },
        error => {
            if (pendingPublicFallbacks.get(key) === pending) {
                pendingPublicFallbacks.delete(key);
            }
            rememberPublicFallback(key, null);
            throw error;
        },
    );
    while (pendingPublicFallbacks.size >= PUBLIC_CACHE_LIMIT) {
        pendingPublicFallbacks.delete(
            pendingPublicFallbacks.keys().next().value,
        );
    }
    pendingPublicFallbacks.set(key, pending);
    return pending;
}

function parseDuration(value) {
    if (typeof value === 'number' && isFinite(value)) {
        return value > 1000 ? value / 1000 : value;
    }
    const text = String(value || '').trim();
    if (!text) {
        return 0;
    }
    if (/^\d+(?:\.\d+)?$/.test(text)) {
        const number = Number(text);
        return number > 1000 ? number / 1000 : number;
    }
    const parts = text.split(':').map(Number);
    if (parts.some(part => !isFinite(part))) {
        return 0;
    }
    if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
}

function normalizeArtwork(value) {
    const artwork = String(value || '')
        .trim()
        .replace(/\{size\}/gi, '400');
    if (artwork.indexOf('//') === 0) {
        return 'https:' + artwork;
    }
    return artwork.replace(/^http:\/\//i, 'https://');
}

function makeMusic(source, rawId, title, artist, album, artwork, duration) {
    const id = String(rawId || '');
    return {
        id: source + ':' + id,
        platform: PLUGIN_PLATFORM,
        title: String(title || '未知歌曲'),
        artist: String(artist || '未知歌手'),
        album: String(album || '未知专辑'),
        artwork: normalizeArtwork(artwork),
        duration: parseDuration(duration),
        _chkszSource: source,
        _chkszId: id,
    };
}

function attachSearchContext(music, item) {
    const query = String((item && item._chkszQuery) || '').trim();
    const position = Number(item && item.n);
    if (query) {
        music._chkszQuery = query;
    }
    if (Number.isInteger(position) && position > 0) {
        music._chkszN = position;
    }
    return music;
}

function joinArtists(value) {
    if (Array.isArray(value)) {
        return value
            .map(item =>
                typeof item === 'string'
                    ? item
                    : item && (item.name || item.title),
            )
            .filter(Boolean)
            .join(' / ');
    }
    return String(value || '');
}

function isKugouHash(value) {
    return /^[A-Fa-f0-9]{32}$/.test(String(value || ''));
}

async function getKugouOfficialDetail(hash) {
    if (!isKugouHash(hash)) {
        return null;
    }
    const cacheKey = 'kugou-detail:' + String(hash).toUpperCase();
    return getOrLoadPublicFallback(cacheKey, async function () {
        const body = await publicGet(KUGOU_DETAIL_API, {
            cmd: 'playInfo',
            hash,
        });
        const returnedHash = body && (body.hash || body.req_hash);
        const detail =
            String(returnedHash || '').toUpperCase() ===
            String(hash).toUpperCase()
                ? {
                      id: returnedHash,
                      name: body.songName || body.fileName,
                      singer: body.singerName || body.author_name,
                      album: body.albumName || body.album_name,
                      cover:
                          body.album_img ||
                          (body.trans_param && body.trans_param.union_cover),
                      interval: body.timeLength || body.duration,
                  }
                : null;
        return detail && normalizeArtwork(detail.cover) ? detail : null;
    });
}

async function getKugouOfficialLyric(hash) {
    if (!isKugouHash(hash)) {
        return null;
    }
    const cacheKey = 'kugou-lyric:' + String(hash).toUpperCase();
    return getOrLoadPublicFallback(cacheKey, async function () {
        const clientTime = String(Date.now());
        const secret = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt';
        const signatureText =
            secret +
            'clienttime=' +
            clientTime +
            'clientver=20000dfid=-hash=' +
            hash +
            'keyword=mid=' +
            clientTime +
            'srcappid=2919timelength=0' +
            secret;
        try {
            const body = await publicGet(
                KUGOU_LYRIC_API,
                {
                    clienttime: clientTime,
                    clientver: 20000,
                    dfid: '-',
                    hash,
                    keyword: '',
                    mid: clientTime,
                    srcappid: 2919,
                    timelength: 0,
                    signature: CryptoJS.MD5(signatureText).toString(),
                },
                {
                    Accept: 'application/json',
                    'User-Agent': 'Android/10 KugouMusic/13.0.0',
                },
            );
            const lyric = body && body.data && body.data.lrc;
            if (lyric) {
                return String(lyric).replace(/\r/g, '');
            }
        } catch (_) {}
        try {
            const legacy = await publicGet(KUGOU_LEGACY_LYRIC_API, {
                cmd: 100,
                hash,
                timelength: 1,
            });
            const lyric = String(legacy || '');
            const start = lyric.indexOf('[0');
            return start >= 0 ? lyric.slice(start).replace(/\r/g, '') : null;
        } catch (_) {
            return null;
        }
    });
}

function parseNeteaseItem(item) {
    const artist = joinArtists(
        item && (item.artists || item.artist || item.ar),
    );
    const rawAlbum = item && (item.album || item.al);
    const album =
        rawAlbum && typeof rawAlbum === 'object'
            ? rawAlbum.name || rawAlbum.title
            : rawAlbum;
    const artwork =
        item && (item.picUrl || item.artwork || (item.al && item.al.picUrl));
    return makeMusic(
        SOURCE_NETEASE,
        item && item.id,
        item && item.name,
        artist,
        album,
        artwork,
        item && (item.duration || item.dt),
    );
}

function parseQqItem(item) {
    return attachSearchContext(
        makeMusic(
            SOURCE_QQ,
            item && (item.mid || item.id),
            item && item.name,
            item && (item.singer || item.artist),
            item && item.album,
            item && (item.cover || item.picUrl),
            item && (item.interval || item.duration),
        ),
        item,
    );
}

function parseKugouItem(item) {
    return attachSearchContext(
        makeMusic(
            SOURCE_KUGOU,
            item && (item.id || item.hash),
            item && item.name,
            item && (item.singer || item.artist),
            item && item.album,
            item && (item.cover || item.picUrl),
            item && (item.interval || item.duration),
        ),
        item,
    );
}

function getRawMusicRef(musicItem) {
    const id = String((musicItem && musicItem.id) || '');
    const prefixed = id.match(/^(netease|qq|kugou):(.+)$/i);
    const source = FIXED_SOURCE;
    const explicitId = musicItem && musicItem._chkszId;
    const query = String((musicItem && musicItem._chkszQuery) || '').trim();
    const position = Number(musicItem && musicItem._chkszN);
    return {
        source,
        id: explicitId ? String(explicitId) : prefixed ? prefixed[2] : id,
        query: query || undefined,
        n: Number.isInteger(position) && position > 0 ? position : undefined,
    };
}

function qualityFor(source, quality) {
    if (source === SOURCE_NETEASE) {
        return (
            {
                low: 'standard',
                standard: 'exhigh',
                high: 'lossless',
                super: 'jymaster',
            }[quality] || 'exhigh'
        );
    }
    return (
        {
            low: '128k',
            standard: '320k',
            high: 'flac',
            super: 'master',
        }[quality] || '320k'
    );
}

function hasNonEmptyValue(value) {
    return (
        value !== undefined &&
        value !== null &&
        (typeof value !== 'string' || value.trim() !== '')
    );
}

function assignNonEmpty(target, source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
        return target;
    }
    Object.keys(source).forEach(key => {
        const value = source[key];
        if (hasNonEmptyValue(value)) {
            target[key] = value;
        }
    });
    return target;
}

function assignMissing(target, source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
        return target;
    }
    Object.keys(source).forEach(key => {
        const current = target[key];
        const value = source[key];
        if (!hasNonEmptyValue(current) && hasNonEmptyValue(value)) {
            target[key] = value;
        }
    });
    return target;
}

function unwrapDetailBody(body) {
    const detail = {};
    assignNonEmpty(detail, body && body.data);
    assignNonEmpty(detail, body);
    delete detail.data;
    return detail;
}

function getDetailCacheKey(source, id) {
    return source + ':' + id;
}

function rememberDetail(source, id, detail) {
    const key = getDetailCacheKey(source, id);
    const cached = detailCache.get(key);
    const merged = assignNonEmpty(
        assignNonEmpty({}, cached && cached.detail),
        detail,
    );
    detailCache.delete(key);
    detailCache.set(key, {
        detail: merged,
        expiresAt: Date.now() + DETAIL_CACHE_TTL,
    });
    while (detailCache.size > DETAIL_CACHE_LIMIT) {
        detailCache.delete(detailCache.keys().next().value);
    }
    return merged;
}

function getRememberedDetail(source, id) {
    const key = getDetailCacheKey(source, id);
    const cached = detailCache.get(key);
    if (!cached) {
        return null;
    }
    if (cached.expiresAt <= Date.now()) {
        detailCache.delete(key);
        return null;
    }
    detailCache.delete(key);
    detailCache.set(key, cached);
    return cached.detail;
}

function getReturnedDetailId(source, detail) {
    return source === SOURCE_QQ
        ? detail && (detail.mid || detail.songmid)
        : detail && (detail.id || detail.hash);
}

function detailIdMatches(source, expectedId, detail) {
    const returnedId = getReturnedDetailId(source, detail);
    if (!hasNonEmptyValue(returnedId)) {
        return true;
    }
    if (source === SOURCE_KUGOU) {
        return (
            String(returnedId).toUpperCase() ===
            String(expectedId).toUpperCase()
        );
    }
    return String(returnedId) === String(expectedId);
}

function makeDetailMismatchError() {
    const error = new Error('[ChKSz 404] 返回的歌曲与请求 ID 不匹配');
    error.status = 404;
    return error;
}

async function getDetail(source, id, quality, context, requirePlayback) {
    if (source === SOURCE_NETEASE) {
        const body = await request('/api/163_music', {
            id,
            level: qualityFor(source, quality),
        });
        return body.data || {};
    }
    const path = source === SOURCE_QQ ? '/api/qq_music' : '/api/kugou_music';
    const size = qualityFor(source, quality);
    let directDetail = null;
    let directError = null;
    try {
        const directBody = await request(
            path,
            source === SOURCE_QQ
                ? {mid: id, size, type: 'json'}
                : {id, size, type: 'json'},
        );
        directDetail = unwrapDetailBody(directBody);
    } catch (error) {
        if (!error || (error.status !== 400 && error.status !== 404)) {
            throw error;
        }
        directError = error;
    }

    const directMatches =
        directDetail && detailIdMatches(source, id, directDetail);
    const needsContextFallback =
        directError ||
        !directMatches ||
        (requirePlayback && !hasNonEmptyValue(directDetail.url));
    if (!needsContextFallback) {
        return directDetail;
    }

    if (context && context.query && context.n) {
        try {
            const contextualBody = await request(path, {
                msg: context.query,
                n: context.n,
                size,
                type: 'json',
            });
            const contextualDetail = unwrapDetailBody(contextualBody);
            const returnedId = getReturnedDetailId(source, contextualDetail);
            if (
                hasNonEmptyValue(returnedId) &&
                detailIdMatches(source, id, contextualDetail)
            ) {
                return contextualDetail;
            }
        } catch (error) {
            if (!error || (error.status !== 400 && error.status !== 404)) {
                throw error;
            }
        }
    }
    if (directDetail && directMatches) {
        return directDetail;
    }
    throw directError || makeDetailMismatchError();
}

async function getRememberedOrFetchDetail(source, id, context) {
    const cached = getRememberedDetail(source, id);
    if (cached) {
        return cached;
    }
    const detail = await getDetail(source, id, 'standard', context);
    return rememberDetail(source, id, detail);
}

async function searchNetease(query, page) {
    const body = await request('/api/163_search', {
        keyword: query,
        limit: PAGE_SIZE,
        offset: Math.max(0, page - 1) * PAGE_SIZE,
    });
    const list = Array.isArray(body.data)
        ? body.data
        : Array.isArray(body.data && body.data.songs)
        ? body.data.songs
        : Array.isArray(body.data && body.data.result && body.data.result.songs)
        ? body.data.result.songs
        : Array.isArray(body.result && body.result.songs)
        ? body.result.songs
        : [];
    return {
        isEnd: list.length < PAGE_SIZE,
        data: list.map(parseNeteaseItem),
    };
}

async function searchQq(query, page) {
    if (page > 1) {
        return {isEnd: true, data: []};
    }
    const body = await request('/api/qq_music', {
        msg: query,
        num: PAGE_SIZE,
        type: 'json',
    });
    const list = Array.isArray(body.list) ? body.list : [];
    return {
        isEnd: true,
        data: list.map(item =>
            parseQqItem(
                Object.assign({}, item, {
                    _chkszQuery: query,
                }),
            ),
        ),
    };
}

async function searchKugou(query, page) {
    if (page > 1) {
        return {isEnd: true, data: []};
    }
    const body = await request('/api/kugou_music', {
        msg: query,
        type: 'json',
    });
    const list = Array.isArray(body.list) ? body.list : [];
    return {
        isEnd: true,
        data: list.map(item =>
            parseKugouItem(
                Object.assign({}, item, {
                    _chkszQuery: query,
                }),
            ),
        ),
    };
}

async function search(query, page, type) {
    const searchType = String(type || 'music').toLowerCase();
    if (searchType !== 'music') {
        return {isEnd: true, data: []};
    }
    const normalizedQuery = String(query || '').trim();
    const normalizedPage = Math.max(1, Math.floor(Number(page) || 1));
    const searchKey =
        getCredential().fingerprint +
        '|' +
        normalizedQuery.toLowerCase() +
        '|' +
        normalizedPage +
        '|' +
        searchType;
    const cached = getCachedSearch(searchKey);
    if (cached) {
        return cached;
    }
    const source = getSearchSource();
    let result;
    if (source === SOURCE_NETEASE) {
        result = await searchNetease(normalizedQuery, normalizedPage);
    } else if (source === SOURCE_KUGOU) {
        result = await searchKugou(normalizedQuery, normalizedPage);
    } else if (source === 'all') {
        if (normalizedPage > 1) {
            result = {isEnd: true, data: []};
        } else {
            const results = [];
            // Keep requests sequential so an explicit all-platform search does not
            // create a burst against the service rate limit.
            results.push((await searchQq(normalizedQuery, 1)).data);
            results.push((await searchNetease(normalizedQuery, 1)).data);
            results.push((await searchKugou(normalizedQuery, 1)).data);
            result = {isEnd: true, data: [].concat.apply([], results)};
        }
    } else {
        result = await searchQq(normalizedQuery, normalizedPage);
    }
    rememberSearch(searchKey, result);
    return cloneSearchResult(result);
}

function parseImportRef(value) {
    const text = String(value || '').trim();
    const prefixed = text.match(/^(netease|163|qq|kugou|kg)\s*[:/|@]\s*(.+)$/i);
    if (prefixed) {
        return {
            source: normalizeSource(prefixed[1]),
            id: prefixed[2].trim(),
        };
    }
    if (/music\.163\.com/i.test(text)) {
        const id = text.match(/[?&]id=(\d+)/) || text.match(/song[/:](\d+)/i);
        return id ? {source: SOURCE_NETEASE, id: id[1]} : null;
    }
    if (/y\.qq\.com/i.test(text)) {
        const id = text.match(/(?:songDetail|song)\/(\w+)/i);
        return id ? {source: SOURCE_QQ, id: id[1]} : null;
    }
    if (/kugou\.com/i.test(text)) {
        const id = text.match(/(?:song|hash)[/:=]([A-Za-z0-9]+)/i);
        return id ? {source: SOURCE_KUGOU, id: id[1]} : null;
    }
    return text ? {source: FIXED_SOURCE, id: text} : null;
}

function normalizeDetail(source, id, detail) {
    if (source === SOURCE_NETEASE) {
        return parseNeteaseItem(Object.assign({}, detail, {id}));
    }
    return source === SOURCE_QQ
        ? parseQqItem(Object.assign({}, detail, {mid: id}))
        : parseKugouItem(Object.assign({}, detail, {id}));
}

function makePartialMusicInfo(source, detail) {
    const info = {};
    const rawArtist =
        source === SOURCE_NETEASE
            ? detail && (detail.artists || detail.artist || detail.ar)
            : detail && (detail.singer || detail.artist);
    const rawAlbum = detail && (detail.album || detail.al);
    const rawArtwork =
        detail &&
        (detail.cover ||
            detail.picUrl ||
            detail.artwork ||
            (detail.al && detail.al.picUrl));
    const title = String(
        (detail && (detail.name || detail.title)) || '',
    ).trim();
    const artist = joinArtists(rawArtist).trim();
    const album = String(
        rawAlbum && typeof rawAlbum === 'object'
            ? rawAlbum.name || rawAlbum.title || ''
            : rawAlbum || '',
    ).trim();
    const artwork = normalizeArtwork(rawArtwork);
    const duration = parseDuration(
        detail && (detail.interval || detail.duration || detail.dt),
    );

    if (title) {
        info.title = title;
    }
    if (artist) {
        info.artist = artist;
    }
    if (album) {
        info.album = album;
    }
    if (artwork) {
        info.artwork = artwork;
    }
    if (duration > 0) {
        info.duration = duration;
    }
    return Object.keys(info).length ? info : null;
}

function hasPrimaryText(value, placeholder) {
    const text = String(value || '').trim();
    return text && text !== placeholder ? text : '';
}

function makePrimaryDetail(source, musicBase) {
    const detail = {};
    const title = hasPrimaryText(musicBase && musicBase.title, '未知歌曲');
    const artist = hasPrimaryText(musicBase && musicBase.artist, '未知歌手');
    const album = hasPrimaryText(musicBase && musicBase.album, '未知专辑');
    const artwork = normalizeArtwork(musicBase && musicBase.artwork);
    const duration = parseDuration(musicBase && musicBase.duration);
    if (title) {
        detail.name = title;
    }
    if (artist) {
        detail[source === SOURCE_NETEASE ? 'artist' : 'singer'] = artist;
    }
    if (album) {
        detail.album = album;
    }
    if (artwork) {
        detail.cover = artwork;
    }
    if (duration > 0) {
        detail[source === SOURCE_NETEASE ? 'duration' : 'interval'] = duration;
    }
    return detail;
}

function hasCompleteMusicInfo(info) {
    return Boolean(
        info &&
            hasNonEmptyValue(info.title) &&
            hasNonEmptyValue(info.artist) &&
            hasNonEmptyValue(info.album) &&
            hasNonEmptyValue(info.artwork) &&
            Number(info.duration) > 0,
    );
}

function onlyArtworkIsMissing(info) {
    return Boolean(
        info &&
            hasNonEmptyValue(info.title) &&
            hasNonEmptyValue(info.artist) &&
            hasNonEmptyValue(info.album) &&
            !hasNonEmptyValue(info.artwork) &&
            Number(info.duration) > 0,
    );
}

function getDetailArtwork(detail) {
    return normalizeArtwork(
        detail &&
            (detail.cover ||
                detail.picUrl ||
                detail.artwork ||
                (detail.al && detail.al.picUrl)),
    );
}

async function fillMissingArtwork(source, id, detail) {
    if (source !== SOURCE_KUGOU || getDetailArtwork(detail)) {
        return detail;
    }
    try {
        const officialDetail = await getKugouOfficialDetail(id);
        if (officialDetail) {
            assignMissing(detail, {cover: getDetailArtwork(officialDetail)});
        }
    } catch (_) {}
    return detail;
}

function getMediaFailure(key) {
    const expiresAt = mediaFailures.get(key);
    if (!expiresAt) {
        return false;
    }
    if (expiresAt <= Date.now()) {
        mediaFailures.delete(key);
        return false;
    }
    mediaFailures.delete(key);
    mediaFailures.set(key, expiresAt);
    return true;
}

function rememberMediaFailure(key) {
    mediaFailures.delete(key);
    mediaFailures.set(key, Date.now() + MEDIA_FAILURE_TTL);
    while (mediaFailures.size > MEDIA_FAILURE_LIMIT) {
        mediaFailures.delete(mediaFailures.keys().next().value);
    }
}

async function getMediaSource(musicItem, quality) {
    const ref = getRawMusicRef(musicItem);
    const sourceFailureKey = ref.source + ':' + ref.id + ':*';
    const qualityFailureKey =
        ref.source + ':' + ref.id + ':' + String(quality || 'standard');
    if (
        getMediaFailure(sourceFailureKey) ||
        getMediaFailure(qualityFailureKey)
    ) {
        return null;
    }
    try {
        const detail = await getDetail(ref.source, ref.id, quality, ref, true);
        rememberDetail(ref.source, ref.id, detail);
        const url = String(detail.url || '').trim();
        if (url) {
            return {url};
        }
        rememberMediaFailure(qualityFailureKey);
    } catch (error) {
        const status = error && Number(error.status);
        if (status === 400) {
            rememberMediaFailure(qualityFailureKey);
        } else if (!status || status === 404 || status >= 500) {
            rememberMediaFailure(sourceFailureKey);
        }
    }
    return null;
}

async function getMusicInfo(musicBase) {
    const ref = getRawMusicRef(musicBase);
    const cachedDetail = getRememberedDetail(ref.source, ref.id);
    const mergedDetail = assignNonEmpty(
        makePrimaryDetail(ref.source, musicBase),
        cachedDetail,
    );
    let info = makePartialMusicInfo(ref.source, mergedDetail);
    if (hasCompleteMusicInfo(info)) {
        return info;
    }
    if (onlyArtworkIsMissing(info)) {
        await fillMissingArtwork(ref.source, ref.id, mergedDetail);
        return makePartialMusicInfo(ref.source, mergedDetail);
    }
    if (!cachedDetail) {
        const detail = await getRememberedOrFetchDetail(
            ref.source,
            ref.id,
            ref,
        );
        assignNonEmpty(mergedDetail, detail);
    }
    await fillMissingArtwork(ref.source, ref.id, mergedDetail);
    info = makePartialMusicInfo(ref.source, mergedDetail);
    return info;
}

async function getLyric(musicItem) {
    const ref = getRawMusicRef(musicItem);
    if (ref.source === SOURCE_NETEASE) {
        const body = await request('/api/163_lyric', {id: ref.id});
        const data = body.data || {};
        return data.lrc || data.tlyric
            ? {
                  rawLrc: data.lrc || undefined,
                  translation: data.tlyric || undefined,
              }
            : null;
    }
    const detail = await getRememberedOrFetchDetail(ref.source, ref.id, ref);
    if (detail.lrc) {
        return {rawLrc: String(detail.lrc)};
    }
    if (ref.source === SOURCE_KUGOU) {
        const lyric = await getKugouOfficialLyric(ref.id);
        return lyric ? {rawLrc: lyric} : null;
    }
    return null;
}

async function getMusicVideo(musicItem) {
    const ref = getRawMusicRef(musicItem);
    if (ref.source !== SOURCE_KUGOU || !isKugouHash(ref.id)) return null;
    const query = [musicItem && musicItem.title, musicItem && musicItem.artist]
        .filter(Boolean)
        .join(' ');
    const searchBody = await publicGet(KUGOU_SEARCH_API, {
        keyword: query,
        page: 1,
        pagesize: 10,
        userid: 0,
        platform: 'WebFilter',
        filter: 2,
        iscorrection: 1,
        privilege_filter: 0,
        area_code: 1,
    });
    const rows = (searchBody.data && searchBody.data.lists) || [];
    const match = rows.find(
        row =>
            String(row.FileHash || row.hash || '').toUpperCase() ===
            String(ref.id).toUpperCase(),
    );
    const mvHash = String(
        (match &&
            (match.MvHash || match.mvHash || match.mvhash || match.mv_hash)) ||
            '',
    ).toUpperCase();
    if (!mvHash) return null;

    const mvBody = await publicGet(KUGOU_MV_API, {
        hash: mvHash,
        key: CryptoJS.MD5(mvHash + 'kugoumvcloud').toString(),
        pid: 6,
        ext: 'mp4',
        ismp3: 0,
    });
    const mvData = mvBody.mvdata || {};
    const qualityMap = {
        rq: {quality: '1080p', height: 1080},
        sq: {quality: '720p', height: 720},
        hd: {quality: '480p', height: 480},
        sd: {quality: '360p', height: 360},
    };
    const sources = Object.keys(qualityMap)
        .map(key => {
            const row = mvData[key];
            const url = row && row.downurl;
            return /^https?:\/\//i.test(String(url || ''))
                ? {
                      ...qualityMap[key],
                      url,
                      headers: {Referer: 'https://www.kugou.com/'},
                      mimeType: 'video/mp4',
                  }
                : null;
        })
        .filter(Boolean);
    return sources.length
        ? {
              id: mvHash,
              title: mvBody.songname || (musicItem && musicItem.title),
              artist: mvBody.singer || (musicItem && musicItem.artist),
              artwork: musicItem && musicItem.artwork,
              sources,
          }
        : null;
}

async function importMusicItem(urlLike) {
    const ref = parseImportRef(urlLike);
    if (!ref || !ref.id || ref.source !== FIXED_SOURCE) {
        return null;
    }
    const detail = await getDetail(ref.source, ref.id, 'standard');
    return normalizeDetail(ref.source, ref.id, detail);
}

module.exports = {
    platform: PLUGIN_PLATFORM,
    version: '1.1.0',
    srcUrl: 'http://23.254.235.247:6080/yuan/8.js',
    author: 'MusicFree',
    description: 'ChKSz 酷狗音乐源。固定使用酷狗音乐，只需配置 API Key。',
    defaultSearchType: 'music',
    supportedSearchType: ['music'],
    cacheControl: 'no-cache',
    userVariables: [
        {
            key: 'apikey',
            name: 'ChKSz API Key',
            hint: '登录 https://api.chksz.com/login 获取，以 chksz_ 开头',
        },
    ],
    hints: {
        importMusicItem: ['酷狗: kugou:歌曲ID 或酷狗音乐歌曲链接'],
    },
    search,
    getMediaSource,
    getMusicVideo,
    getMusicInfo,
    getLyric,
    importMusicItem,
};
