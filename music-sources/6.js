/* QingMusic Bilibili video-audio source for MusicFree. */
const axios = require('axios');

const PLATFORM = '轻Bili';
const PAGE_SIZE = 20;
const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

function number(value, fallback) {
    const result = Number(value);
    return Number.isFinite(result) ? result : fallback || 0;
}

function pageNumber(value) {
    return Math.max(1, Math.trunc(number(value, 1)));
}

function cleanText(value) {
    return String(value || '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
}

function imageUrl(value) {
    const url = String(value || '');
    if (url.startsWith('//')) return 'https:' + url;
    return url.startsWith('http://') ? 'https://' + url.slice(7) : url;
}

function duration(value) {
    if (typeof value === 'number') return Math.round(value);
    const text = String(value || '');
    if (/^\d+(?:\.\d+)?$/.test(text)) return Math.round(number(text));
    return text
        .split(':')
        .reduce((total, part) => total * 60 + number(part), 0);
}

function compact(value) {
    const result = {};
    Object.keys(value || {}).forEach(key => {
        const item = value[key];
        if (item !== undefined && item !== null && item !== '')
            result[key] = item;
    });
    return Object.keys(result).length ? result : null;
}

function identifiers(item) {
    const id = String((item && item.id) || '');
    const rid = String((item && item.rid) || '');
    const fallback = id.startsWith('music:') ? id.slice(6) : rid;
    const bvid = String(
        (item && item.bvid) || (fallback.startsWith('BV') ? fallback : ''),
    );
    const aid = String((item && item.aid) || (!bvid ? fallback : ''));
    if (!bvid && !aid) throw new Error('Bilibili 视频标识无效');
    return {bvid, aid};
}

function music(row) {
    if (!row) return null;
    const bvid = String(row.bvid || '');
    const aid = String(row.aid || row.id || '');
    const rid = bvid || aid;
    const title = cleanText(row.title);
    if (!rid || !title) return null;
    return {
        id: 'music:' + rid,
        platform: PLATFORM,
        rid,
        bvid,
        aid,
        cid: String(row.cid || ''),
        title,
        artist:
            cleanText(row.author || (row.owner && row.owner.name)) ||
            '未知 UP 主',
        album: bvid || 'AV' + aid,
        artwork: imageUrl(row.pic),
        duration: duration(row.duration),
        qualities: {},
    };
}

async function request(config) {
    const response = await axios({
        timeout: 12000,
        ...config,
        headers: {'User-Agent': USER_AGENT, ...(config.headers || {})},
    });
    const data = response && response.data;
    if (!data || typeof data !== 'object')
        throw new Error('Bilibili 接口响应为空');
    if (data.code !== 0) {
        const message =
            data.code === -412
                ? 'Bilibili 风控校验失败 (412)'
                : data.message || 'Bilibili 接口返回异常';
        throw new Error(message);
    }
    return data;
}

let fingerprint;
async function getFingerprint() {
    if (fingerprint) return fingerprint;
    const data = await request({
        method: 'GET',
        url: 'https://api.bilibili.com/x/frontend/finger/spi',
    });
    if (!data.data || (!data.data.b_3 && !data.data.b_4))
        throw new Error('Bilibili 匿名指纹为空');
    fingerprint = data.data;
    return fingerprint;
}

function cookieHeader(value) {
    return 'buvid3=' + (value.b_3 || '') + '; buvid4=' + (value.b_4 || '');
}

async function search(query, page, type) {
    if (type && type !== 'music') return {isEnd: true, data: []};
    const currentPage = pageNumber(page);
    const cookie = await getFingerprint();
    const data = await request({
        method: 'GET',
        url: 'https://api.bilibili.com/x/web-interface/search/type',
        params: {
            search_type: 'video',
            keyword: query,
            page: currentPage,
            page_size: PAGE_SIZE,
            order: '',
            duration: '',
            tids_1: '',
            tids_2: '',
            highlight: 1,
            platform: 'pc',
        },
        headers: {
            Referer: 'https://search.bilibili.com/',
            Cookie: cookieHeader(cookie),
        },
    });
    const body = data.data;
    if (!body || !Array.isArray(body.result))
        throw new Error('Bilibili 搜索响应结构缺失');
    return {
        isEnd: currentPage >= number(body.numPages, 1),
        data: body.result.map(music).filter(Boolean),
    };
}

async function videoDetail(item) {
    const ids = identifiers(item);
    const cookie = await getFingerprint();
    const data = await request({
        method: 'GET',
        url: 'https://api.bilibili.com/x/web-interface/view',
        params: ids.bvid ? {bvid: ids.bvid} : {aid: ids.aid},
        headers: {Cookie: cookieHeader(cookie)},
    });
    return data.data;
}

async function getMusicInfo(item) {
    const detail = await videoDetail(item);
    if (!detail) return null;
    const converted = music({
        ...detail,
        author: detail.owner && detail.owner.name,
        cid:
            detail.cid ||
            (detail.pages && detail.pages[0] && detail.pages[0].cid),
    });
    return converted
        ? compact({
              title: converted.title,
              artist: converted.artist,
              album: converted.album,
              artwork: converted.artwork,
              duration: converted.duration,
              bvid: converted.bvid,
              aid: converted.aid,
              cid: converted.cid,
          })
        : null;
}

async function getMediaSource(item, quality) {
    const ids = identifiers(item);
    const cookie = await getFingerprint();
    let cid = item && item.cid;
    let detail;
    if (!cid) {
        detail = await videoDetail(item);
        cid =
            detail &&
            (detail.cid ||
                (detail.pages && detail.pages[0] && detail.pages[0].cid));
    }
    if (!cid) throw new Error('Bilibili 视频 CID 为空');
    const pageId = ids.bvid || ids.aid;
    const data = await request({
        method: 'GET',
        url: 'https://api.bilibili.com/x/player/playurl',
        params: {
            ...(ids.bvid ? {bvid: ids.bvid} : {avid: ids.aid}),
            cid,
            fnval: 16,
            platform: 'html5',
        },
        headers: {
            Referer: 'https://www.bilibili.com/video/' + pageId,
            Cookie: cookieHeader(cookie),
        },
    });
    const dash = data.data && data.data.dash;
    const audio =
        dash && Array.isArray(dash.audio)
            ? dash.audio.slice().sort((a, b) => a.bandwidth - b.bandwidth)
            : [];
    const qualityIndex = {low: 0, standard: 1, high: 2, super: 3}[quality] || 0;
    const selected =
        audio[Math.min(qualityIndex, Math.max(0, audio.length - 1))];
    const url =
        (selected && (selected.baseUrl || selected.base_url)) ||
        (data.data &&
            data.data.durl &&
            data.data.durl[0] &&
            data.data.durl[0].url);
    if (!url) throw new Error('Bilibili 播放地址为空');
    return {
        url,
        headers: {
            Referer: 'https://www.bilibili.com/video/' + pageId,
            'User-Agent': USER_AGENT,
        },
        userAgent: USER_AGENT,
    };
}

async function getMusicVideo(item) {
    const ids = identifiers(item);
    const cookie = await getFingerprint();
    let cid = item && item.cid;
    if (!cid) {
        const detail = await videoDetail(item);
        cid =
            detail &&
            (detail.cid ||
                (detail.pages && detail.pages[0] && detail.pages[0].cid));
    }
    if (!cid) return null;

    const pageId = ids.bvid || ids.aid;
    const headers = {
        Referer: 'https://www.bilibili.com/video/' + pageId,
        Cookie: cookieHeader(cookie),
    };
    const qualityMap = {
        6: 240,
        16: 360,
        32: 480,
        64: 720,
        74: 720,
        80: 1080,
        112: 1080,
        116: 1080,
        120: 2160,
        125: 2160,
        126: 2160,
        127: 4320,
    };
    let qualities = [112, 80, 64, 32, 16, 6];
    const sources = [];
    for (let index = 0; index < qualities.length; index += 1) {
        const requestedQuality = qualities[index];
        try {
            const data = await request({
                method: 'GET',
                url: 'https://api.bilibili.com/x/player/playurl',
                params: {
                    ...(ids.bvid ? {bvid: ids.bvid} : {avid: ids.aid}),
                    cid,
                    qn: requestedQuality,
                    fnver: 0,
                    fnval: 1,
                    fourk: 1,
                    platform: 'html5',
                },
                headers,
            });
            const body = data.data || {};
            if (index === 0 && Array.isArray(body.accept_quality)) {
                qualities = body.accept_quality;
            }
            const row = body.durl && body.durl.length === 1 && body.durl[0];
            const url = row && row.url;
            const actualQuality = number(body.quality, requestedQuality);
            const height = qualityMap[actualQuality];
            if (/^https?:\/\//i.test(String(url || '')) && height) {
                sources.push({
                    quality: height + 'p',
                    height,
                    url,
                    headers: {
                        Referer: headers.Referer,
                        'User-Agent': USER_AGENT,
                    },
                    mimeType: 'video/mp4',
                });
            }
        } catch (_) {}
    }
    return sources.length
        ? {
              id: pageId + ':' + cid,
              title: item && item.title,
              artist: item && item.artist,
              artwork: item && item.artwork,
              sources,
          }
        : null;
}

module.exports = {
    platform: PLATFORM,
    appVersion: '>=0.0',
    version: '1.1.0',
    srcUrl: 'http://23.254.235.247:6080/yuan/6.js',
    author: 'MusicFree user adapter',
    cacheControl: 'no-cache',
    primaryKey: ['id', 'rid', 'bvid', 'aid', 'cid'],
    supportedSearchType: ['music'],
    defaultSearchType: 'music',
    description:
        'Bilibili 视频音频独立音源。搜索、详情与播放均使用 Bilibili 官方匿名接口。',
    search,
    getMediaSource,
    getMusicVideo,
    getMusicInfo,
};
