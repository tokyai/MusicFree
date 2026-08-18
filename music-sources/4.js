/*
 * QingMusic NetEase source for MusicFree.
 * Catalogue data comes from NetEase public web APIs. Playback is resolved by
 * QingMusic's resolver service.
 */
const axios = require('axios');

const PLATFORM = '轻网易';
const SOURCE = 'wy';
const MUSIC_SERVER = 'https://musicserver.haitangw.cc/v1/music/resolve-url';
const PAGE_SIZE = 30;
const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const SEARCH_TYPES = {
    music: 1,
    album: 10,
    artist: 100,
    sheet: 1000,
    lyric: 1006,
};
const QUALITY_LEVELS = {
    low: 'standard',
    standard: 'exhigh',
    high: 'lossless',
    super: 'jymaster',
};

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

function artistNames(values) {
    return [
        ...new Set(
            (values || []).map(item => item && item.name).filter(Boolean),
        ),
    ].join('、');
}

function nativeId(item, type) {
    if (item && item.rid) return String(item.rid);
    const value = String((item && item.id) || '');
    const prefix = type + ':';
    if (!value.startsWith(prefix))
        throw new Error('网易云' + type + '标识无效');
    return value.slice(prefix.length);
}

function compact(value) {
    const result = {};
    Object.keys(value || {}).forEach(key => {
        const item = value[key];
        const emptyCollection =
            (Array.isArray(item) && !item.length) ||
            (item &&
                typeof item === 'object' &&
                !Array.isArray(item) &&
                !Object.keys(item).length);
        if (
            item !== undefined &&
            item !== null &&
            item !== '' &&
            !emptyCollection
        )
            result[key] = item;
    });
    return Object.keys(result).length ? result : null;
}

function qualities(row) {
    const result = {};
    if (row && row.l && row.l.size) result.low = {size: row.l.size};
    if (row && row.h && row.h.size) result.standard = {size: row.h.size};
    if (row && row.sq && row.sq.size) result.high = {size: row.sq.size};
    if (row && row.hr && row.hr.size) result.super = {size: row.hr.size};
    return result;
}

function music(row) {
    if (!row || row.id === undefined || !row.name) return null;
    const albumData = row.al || row.album || {};
    const artists = row.ar || row.artists || [];
    return {
        id: 'music:' + row.id,
        platform: PLATFORM,
        rid: String(row.id),
        mvId: String(row.mvid || row.mv || ''),
        title: cleanText(row.name),
        artist: artistNames(artists) || '未知歌手',
        album: cleanText(albumData.name) || '未知专辑',
        artwork: imageUrl(albumData.picUrl || albumData.blurPicUrl),
        duration: Math.round(
            number(row.dt !== undefined ? row.dt : row.duration) / 1000,
        ),
        qualities: qualities(row),
    };
}

function album(row) {
    if (!row || row.id === undefined || !row.name) return null;
    return {
        id: 'album:' + row.id,
        platform: PLATFORM,
        rid: String(row.id),
        title: cleanText(row.name),
        artwork: imageUrl(row.picUrl || row.blurPicUrl),
        artist: cleanText(
            (row.artist && row.artist.name) || artistNames(row.artists),
        ),
        date: row.publishTime
            ? new Date(number(row.publishTime)).toISOString().slice(0, 10)
            : '',
        description: cleanText(row.description || row.briefDesc),
        worksNum: number(row.size || row.songCount, undefined),
    };
}

function artist(row) {
    if (!row || row.id === undefined || !row.name) return null;
    return {
        id: 'artist:' + row.id,
        platform: PLATFORM,
        rid: String(row.id),
        name: cleanText(row.name),
        avatar: imageUrl(row.picUrl || row.img1v1Url),
        description: cleanText(row.briefDesc),
        worksNum: number(row.musicSize, 0),
    };
}

function sheet(row, type) {
    if (!row || row.id === undefined || !row.name) return null;
    const entityType = type || 'sheet';
    return {
        id: entityType + ':' + row.id,
        platform: PLATFORM,
        rid: String(row.id),
        title: cleanText(row.name),
        artwork: imageUrl(row.coverImgUrl || row.picUrl),
        artist: cleanText(row.creator && row.creator.nickname),
        description: cleanText(row.description),
        worksNum: number(
            row.trackCount || (row.trackIds && row.trackIds.length),
            0,
        ),
    };
}

async function request(config) {
    const response = await axios({
        timeout: 12000,
        ...config,
        headers: {'User-Agent': USER_AGENT, ...(config.headers || {})},
    });
    const data = response && response.data;
    if (
        !data ||
        (data.code !== undefined && data.code !== 200 && data.code !== 0)
    ) {
        throw new Error('网易云接口返回异常');
    }
    return data;
}

async function search(query, page, type) {
    const searchType = type || 'music';
    if (!SEARCH_TYPES[searchType]) return {isEnd: true, data: []};
    const currentPage = pageNumber(page);
    const data = await request({
        method: 'POST',
        url: 'https://interface.music.163.com/api/search/get/web',
        data: new URLSearchParams({
            s: query,
            type: String(SEARCH_TYPES[searchType]),
            limit: String(PAGE_SIZE),
            offset: String((currentPage - 1) * PAGE_SIZE),
            total: currentPage === 1 ? 'true' : 'false',
        }).toString(),
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    });
    const result = data.result || {};
    let rows = [];
    let total = 0;
    let convert = music;
    if (searchType === 'music' || searchType === 'lyric') {
        rows = result.songs || [];
        total = number(result.songCount, rows.length);
    } else if (searchType === 'album') {
        rows = result.albums || [];
        total = number(result.albumCount, rows.length);
        convert = album;
    } else if (searchType === 'artist') {
        rows = result.artists || [];
        total = number(result.artistCount, rows.length);
        convert = artist;
    } else if (searchType === 'sheet') {
        rows = result.playlists || [];
        total = number(result.playlistCount, rows.length);
        convert = row => sheet(row, 'sheet');
    }
    const converted = rows
        .map(row => {
            const item = convert(row);
            if (item && searchType === 'lyric')
                item.rawLrcTxt = cleanText(row.lyrics || '');
            return item;
        })
        .filter(Boolean);
    return {
        isEnd: total
            ? currentPage * PAGE_SIZE >= total
            : rows.length < PAGE_SIZE,
        data: converted,
    };
}

async function rawSongDetails(ids) {
    const uniqueIds = [...new Set((ids || []).map(String).filter(Boolean))];
    if (!uniqueIds.length) return [];
    const data = await request({
        method: 'GET',
        url: 'https://interface.music.163.com/api/song/detail',
        params: {
            ids: JSON.stringify(uniqueIds),
            c: JSON.stringify(uniqueIds.map(id => ({id}))),
        },
    });
    return data.songs || [];
}

async function songDetails(ids) {
    return (await rawSongDetails(ids)).map(music).filter(Boolean);
}

async function getMusicInfo(item) {
    const songs = await songDetails([nativeId(item, 'music')]);
    const detail = songs[0];
    return detail
        ? compact({
              title: detail.title,
              artist: detail.artist,
              album: detail.album,
              artwork: detail.artwork,
              duration: detail.duration,
              qualities: detail.qualities,
              mvId: detail.mvId,
          })
        : null;
}

async function getMusicVideo(item) {
    let mvId = String((item && item.mvId) || '');
    if (!mvId) {
        const rows = await rawSongDetails([nativeId(item, 'music')]);
        const detail = rows[0];
        mvId = String((detail && (detail.mvid || detail.mv)) || '');
    }
    if (!mvId || mvId === '0') return null;

    const requestedHeights = [1080, 720, 480, 240];
    const sources = [];
    for (const requestedHeight of requestedHeights) {
        try {
            const data = await request({
                method: 'GET',
                url: 'https://interface.music.163.com/api/song/enhance/play/mv/url',
                params: {id: mvId, r: requestedHeight},
                headers: {Referer: 'https://music.163.com/'},
            });
            const result = data.data || {};
            if (/^https?:\/\//i.test(String(result.url || ''))) {
                const height = number(result.r, requestedHeight);
                sources.push({
                    quality: height + 'p',
                    height,
                    url: result.url,
                    headers: {
                        Referer: 'https://music.163.com/',
                        'User-Agent': USER_AGENT,
                    },
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
              title: item && item.title,
              artist: item && item.artist,
              artwork: item && item.artwork,
              sources: uniqueSources,
          }
        : null;
}

async function getLyric(item) {
    const data = await request({
        method: 'GET',
        url: 'https://interface3.music.163.com/api/song/lyric',
        params: {
            id: nativeId(item, 'music'),
            os: 'Linux',
            lv: -1,
            kv: -1,
            tv: -1,
        },
    });
    if (!data.lrc || !data.lrc.lyric) return null;
    return {
        rawLrc: data.lrc.lyric,
        translation: data.tlyric && data.tlyric.lyric,
    };
}

async function getAlbumInfo(item, page) {
    const currentPage = pageNumber(page);
    const data = await request({
        method: 'GET',
        url:
            'https://interface.music.163.com/api/v1/album/' +
            nativeId(item, 'album'),
    });
    const rows = data.songs || [];
    const start = (currentPage - 1) * PAGE_SIZE;
    const result = {
        isEnd: start + PAGE_SIZE >= rows.length,
        musicList: rows
            .slice(start, start + PAGE_SIZE)
            .map(music)
            .filter(Boolean),
    };
    if (currentPage === 1 && data.album) result.albumItem = album(data.album);
    return result;
}

async function getArtistWorks(item, page, type) {
    const currentPage = pageNumber(page);
    const id = nativeId(item, 'artist');
    const offset = (currentPage - 1) * PAGE_SIZE;
    if (type === 'album') {
        const data = await request({
            method: 'GET',
            url: 'https://interface.music.163.com/api/artist/albums/' + id,
            params: {limit: PAGE_SIZE, offset},
        });
        const rows = data.hotAlbums || [];
        return {isEnd: !data.more, data: rows.map(album).filter(Boolean)};
    }
    if (type !== 'music') return {isEnd: true, data: []};
    const data = await request({
        method: 'GET',
        url: 'https://interface.music.163.com/api/v1/artist/songs',
        params: {id, limit: PAGE_SIZE, offset, order: 'hot'},
    });
    const rows = data.songs || [];
    return {
        isEnd: data.more === undefined ? rows.length < PAGE_SIZE : !data.more,
        data: rows.map(music).filter(Boolean),
    };
}

async function playlistDetail(id) {
    const data = await request({
        method: 'GET',
        url: 'https://interface.music.163.com/api/v6/playlist/detail',
        params: {id, n: 100000, s: 0},
    });
    if (!data.playlist) throw new Error('网易云歌单详情为空');
    return data.playlist;
}

async function playlistPage(item, page, type) {
    const currentPage = pageNumber(page);
    const id = nativeId(item, type);
    const playlist = await playlistDetail(id);
    const trackIds = (playlist.trackIds || [])
        .map(row => row && row.id)
        .filter(Boolean);
    const start = (currentPage - 1) * PAGE_SIZE;
    const selected = trackIds.slice(start, start + PAGE_SIZE);
    let musicList;
    if (selected.length) {
        musicList = await songDetails(selected);
    } else if (currentPage === 1) {
        musicList = (playlist.tracks || [])
            .slice(0, PAGE_SIZE)
            .map(music)
            .filter(Boolean);
    } else {
        musicList = [];
    }
    const result = {
        isEnd:
            start + PAGE_SIZE >=
            (trackIds.length || (playlist.tracks || []).length),
        musicList,
    };
    if (currentPage === 1)
        result[type === 'top' ? 'topListItem' : 'sheetItem'] = sheet(
            playlist,
            type,
        );
    return result;
}

function getMusicSheetInfo(item, page) {
    return playlistPage(item, page, 'sheet');
}

async function getTopLists() {
    const data = await request({
        method: 'GET',
        url: 'https://interface.music.163.com/api/toplist/detail',
    });
    const groups = new Map();
    (data.list || []).forEach(row => {
        const title = cleanText(row.ToplistType ? '官方榜单' : '特色榜单');
        if (!groups.has(title)) groups.set(title, []);
        const item = sheet(row, 'top');
        if (item) groups.get(title).push(item);
    });
    return [...groups].map(([title, rows]) => ({title, data: rows}));
}

function getTopListDetail(item, page) {
    return playlistPage(item, page, 'top');
}

async function getRecommendSheetTags() {
    const data = await request({
        method: 'GET',
        url: 'https://interface.music.163.com/api/playlist/catalogue',
    });
    const categories = data.categories || {};
    const groups = new Map();
    (data.sub || []).forEach(row => {
        const title = categories[row.category] || '其他';
        if (!groups.has(title)) groups.set(title, []);
        groups.get(title).push({
            id: 'tag:' + encodeURIComponent(row.name),
            platform: PLATFORM,
            rid: row.name,
            title: row.name,
        });
    });
    const pinned = (data.all ? [data.all] : []).concat(
        (data.sub || []).filter(row => row.hot).slice(0, 7),
    );
    return {
        pinned: pinned.map(row => ({
            id: 'tag:' + encodeURIComponent(row.name),
            platform: PLATFORM,
            rid: row.name,
            title: row.name,
        })),
        data: [...groups].map(([title, rows]) => ({title, data: rows})),
    };
}

async function getRecommendSheetsByTag(tag, page) {
    const currentPage = pageNumber(page);
    let name = tag && tag.rid;
    if (!name) {
        const id = String((tag && tag.id) || '');
        name = id.startsWith('tag:') ? decodeURIComponent(id.slice(4)) : '全部';
    }
    const data = await request({
        method: 'GET',
        url: 'https://interface.music.163.com/api/playlist/list',
        params: {
            cat: name || '全部',
            order: 'hot',
            limit: PAGE_SIZE,
            offset: (currentPage - 1) * PAGE_SIZE,
            total: currentPage === 1,
        },
    });
    const rows = data.playlists || [];
    return {
        isEnd: data.more === undefined ? rows.length < PAGE_SIZE : !data.more,
        data: rows.map(row => sheet(row, 'sheet')).filter(Boolean),
    };
}

async function getMediaSource(item, quality) {
    const requested = quality || 'standard';
    const order = ['low', 'standard', 'high', 'super'];
    const index = Math.max(0, order.indexOf(requested));
    const levels = order
        .slice(0, index + 1)
        .reverse()
        .map(key => QUALITY_LEVELS[key])
        .filter((level, offset, values) => values.indexOf(level) === offset);
    let lastError;
    for (const level of levels) {
        try {
            const data = await request({
                method: 'POST',
                url: MUSIC_SERVER,
                data: {source: SOURCE, rid: nativeId(item, 'music'), level},
                headers: {'Content-Type': 'application/json'},
            });
            const result = data.data || {};
            if (data.code !== 0 || !result.url)
                throw new Error(data.message || '网易云播放解析失败');
            return {
                url: result.url,
                headers: result.playbackHeaders || result.headers || {},
            };
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError || new Error('网易云播放解析失败');
}

module.exports = {
    platform: PLATFORM,
    appVersion: '>=0.0',
    version: '1.1.0',
    srcUrl: 'http://23.254.235.247:6080/yuan/4.js',
    author: 'MusicFree user adapter',
    cacheControl: 'no-cache',
    primaryKey: ['id', 'rid', 'mvId'],
    supportedSearchType: ['music', 'album', 'artist', 'sheet', 'lyric'],
    defaultSearchType: 'music',
    description:
        '网易云独立音源。目录使用网易云公开接口，播放依赖 QingMusic 解析服务。',
    search,
    getMediaSource,
    getMusicVideo,
    getMusicInfo,
    getLyric,
    getAlbumInfo,
    getArtistWorks,
    getMusicSheetInfo,
    getTopLists,
    getTopListDetail,
    getRecommendSheetTags,
    getRecommendSheetsByTag,
};
