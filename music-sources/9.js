/*
 * MusicFree plugin for ChKSz API.
 *
 * Configure the API key from MusicFree's plugin user variables. The key is
 * intentionally not embedded in this file.
 */
/* global env */

const axios = require('axios');

const API_BASE = 'https://api.chksz.com';
const NETEASE_DETAIL_API = 'https://interface.music.163.com/api/song/detail';
const NETEASE_MV_API =
    'https://interface.music.163.com/api/song/enhance/play/mv/url';
const PLUGIN_PLATFORM = '智网易';
const PAGE_SIZE = 30;
const SOURCE_NETEASE = 'netease';
const SOURCE_QQ = 'qq';
const SOURCE_KUGOU = 'kugou';
const FIXED_SOURCE = SOURCE_NETEASE;
const DETAIL_CACHE_TTL = 30 * 60 * 1000;
const DETAIL_CACHE_LIMIT = 100;
const SEARCH_CACHE_TTL = 2 * 60 * 1000;
const SEARCH_CACHE_LIMIT = 30;
const MEDIA_FAILURE_TTL = 5000;
const MEDIA_FAILURE_LIMIT = 100;

let activeCredential = null;
let credentialSequence = 0;
let blockedCredential = null;
const detailCache = new Map();
const pendingRequests = new Map();
const searchCache = new Map();
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
    return String(value || '')
        .trim()
        .replace(/^http:\/\//i, 'https://');
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

function parseSheetId(value) {
    const text = String(value || '').trim();
    if (/^\d+$/.test(text)) {
        return text;
    }
    const match =
        text.match(/[?&]id=(\d+)/) || text.match(/playlist[/:](\d+)/i);
    return match ? match[1] : null;
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
    const info = makePartialMusicInfo(ref.source, mergedDetail);
    if (hasCompleteMusicInfo(info)) {
        return info;
    }
    if (!cachedDetail) {
        const detail = await getRememberedOrFetchDetail(
            ref.source,
            ref.id,
            ref,
        );
        assignNonEmpty(mergedDetail, detail);
    }
    return makePartialMusicInfo(ref.source, mergedDetail);
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
    return detail.lrc ? {rawLrc: String(detail.lrc)} : null;
}

async function getMusicVideo(musicItem) {
    const ref = getRawMusicRef(musicItem);
    if (ref.source !== SOURCE_NETEASE || !ref.id) return null;
    const detailResponse = await axios.get(NETEASE_DETAIL_API, {
        timeout: 8000,
        params: {
            ids: JSON.stringify([ref.id]),
            c: JSON.stringify([{id: Number(ref.id) || ref.id}]),
        },
        headers: {Referer: 'https://music.163.com/'},
    });
    const detailBody = detailResponse && detailResponse.data;
    const song = detailBody && detailBody.songs && detailBody.songs[0];
    const mvId = String((song && (song.mvid || song.mv)) || '');
    if (!mvId || mvId === '0') return null;

    const sources = [];
    for (const requestedHeight of [1080, 720, 480, 240]) {
        try {
            const response = await axios.get(NETEASE_MV_API, {
                timeout: 8000,
                params: {id: mvId, r: requestedHeight},
                headers: {Referer: 'https://music.163.com/'},
            });
            const body = response && response.data;
            const data = body && body.data;
            const url = data && data.url;
            if (/^https?:\/\//i.test(String(url || ''))) {
                const height = Number(data.r) || requestedHeight;
                sources.push({
                    quality: height + 'p',
                    height,
                    url,
                    headers: {Referer: 'https://music.163.com/'},
                    mimeType: 'video/mp4',
                });
            }
        } catch (_) {}
    }
    const uniqueSources = sources.filter(
        (source, index, values) =>
            values.findIndex(value => value.height === source.height) === index,
    );
    return uniqueSources.length
        ? {
              id: mvId,
              title: musicItem && musicItem.title,
              artist: musicItem && musicItem.artist,
              artwork: musicItem && musicItem.artwork,
              sources: uniqueSources,
          }
        : null;
}

function parseNeteasePlaylist(data) {
    const playlist = data || {};
    const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
    return {
        sheetItem: {
            id: String(playlist.id || ''),
            platform: PLUGIN_PLATFORM,
            title: playlist.name || '网易云歌单',
            artist: playlist.creator && playlist.creator.nickname,
            coverImg: playlist.coverImgUrl || '',
            artwork: playlist.coverImgUrl || '',
            worksNum: playlist.trackCount || tracks.length,
            description: playlist.description || '',
            _chkszSource: SOURCE_NETEASE,
            _chkszId: String(playlist.id || ''),
        },
        musicList: tracks.map(parseNeteaseItem),
    };
}

async function getMusicSheetInfo(sheetItem, page) {
    const source = normalizeSource(sheetItem && sheetItem._chkszSource);
    const id = String(
        (sheetItem && sheetItem._chkszId) || (sheetItem && sheetItem.id) || '',
    ).replace(/^netease:/i, '');
    if (source !== SOURCE_NETEASE || !id || page > 1) {
        return {sheetItem, musicList: [], isEnd: true};
    }
    const body = await request('/api/163_playlist', {id});
    const parsed = parseNeteasePlaylist(body.data);
    return {
        sheetItem: parsed.sheetItem,
        musicList: parsed.musicList,
        isEnd: true,
    };
}

async function importMusicSheet(urlLike) {
    const id = parseSheetId(urlLike);
    if (!id) {
        return null;
    }
    const body = await request('/api/163_playlist', {id});
    return (parseNeteasePlaylist(body.data).musicList || []).map(item => item);
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
    srcUrl: 'http://23.254.235.247:6080/yuan/9.js',
    author: 'MusicFree',
    description: 'ChKSz 网易云音乐源。固定使用网易云音乐，只需配置 API Key。',
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
        importMusicItem: ['网易云: 歌曲 ID、netease:歌曲ID 或歌曲链接'],
        importMusicSheet: ['网易云歌单 ID 或歌单链接'],
    },
    search,
    getMediaSource,
    getMusicVideo,
    getMusicInfo,
    getLyric,
    getMusicSheetInfo,
    importMusicSheet,
    importMusicItem,
};
