/*
 * QingMusic Kuwo source for MusicFree.
 * Catalogue data comes from Kuwo public endpoints. Playback is resolved by
 * QingMusic's resolver service.
 */
const axios = require('axios');

const PLATFORM = '轻酷我';
const SOURCE = 'kw';
const MUSIC_SERVER = 'https://musicserver.haitangw.cc/v1/music/resolve-url';
const PAGE_SIZE = 30;
const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const QUALITY_LEVELS = {
    low: 'standard',
    standard: 'exhigh',
    high: 'lossless',
    super: 'master',
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
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
}

function imageUrl(value) {
    let url = String(value || '').replace('{size}', '500');
    if (!url) return '';
    if (/^(120|240|500)\//.test(url))
        url = 'https://img1.kuwo.cn/star/albumcover/' + url;
    if (url.startsWith('//')) return 'https:' + url;
    return url.startsWith('http://') ? 'https://' + url.slice(7) : url;
}

function nativeId(item, type) {
    if (item && item.rid) return String(item.rid);
    const value = String((item && item.id) || '');
    const prefix = type + ':';
    if (!value.startsWith(prefix)) throw new Error('酷我' + type + '标识无效');
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

function parseQualities(value) {
    const result = {};
    String(value || '')
        .split(';')
        .forEach(entry => {
            const match = entry.match(/bitrate:(\d+).*?size:([\w.]+)/);
            if (!match) return;
            const bitrate = number(match[1]);
            const info = {size: match[2]};
            if (bitrate >= 4000) result.super = info;
            else if (bitrate >= 1000) result.high = info;
            else if (bitrate >= 300) result.standard = info;
            else result.low = info;
        });
    return result;
}

function music(row) {
    if (!row) return null;
    const rid = String(
        row.rid || row.musicrid || row.MUSICRID || row.id || '',
    ).replace(/^MUSIC_/, '');
    const title = cleanText(
        row.name || row.songname || row.SONGNAME || row.NAME,
    );
    if (!rid || !title) return null;
    return {
        id: 'music:' + rid,
        platform: PLATFORM,
        rid,
        mvId: String(
            row.MVID ||
                row.mvid ||
                (row.mvpayinfo && row.mvpayinfo.vid) ||
                '',
        ),
        title,
        artist:
            cleanText(row.artist || row.ARTIST).replace(/&/g, '、') ||
            '未知歌手',
        album: cleanText(row.album || row.ALBUM) || '未知专辑',
        artwork: imageUrl(
            row.pic || row.pic120 || row.img || row.web_albumpic_short,
        ),
        duration: number(row.duration || row.DURATION || row.song_duration, 0),
        qualities: parseQualities(row.N_MINFO || row.MINFO),
    };
}

function album(row) {
    if (!row) return null;
    const rid = String(row.albumid || row.ALBUMID || row.id || '');
    const title = cleanText(row.name || row.album || row.ALBUM);
    if (!rid || !title) return null;
    return {
        id: 'album:' + rid,
        platform: PLATFORM,
        rid,
        title,
        artwork: imageUrl(
            row.hts_img || row.img || row.pic || row.web_albumpic_short,
        ),
        artist: cleanText(row.artist || row.ARTIST),
        date: cleanText(row.pub || row.releaseDate || row.releasedate),
        description: cleanText(row.info || row.albuminfo),
        worksNum: number(row.musiccnt || row.songnum || row.total, 0),
    };
}

function artist(row) {
    if (!row) return null;
    const rid = String(row.ARTISTID || row.artistid || row.id || '');
    const name = cleanText(row.ARTIST || row.artist || row.name);
    if (!rid || !name) return null;
    return {
        id: 'artist:' + rid,
        platform: PLATFORM,
        rid,
        name,
        avatar: imageUrl(
            row.hts_PICPATH || row.PICPATH || row.artistpic || row.pic,
        ),
        description: cleanText(row.desc),
        worksNum: number(row.SONGNUM || row.musicNum, 0),
    };
}

function sheet(row, type) {
    if (!row) return null;
    const entityType = type || 'sheet';
    const rid = String(row.playlistid || row.id || row.pid || '');
    const title = cleanText(row.name || row.title || row.disname);
    if (!rid || !title) return null;
    return {
        id: entityType + ':' + rid,
        platform: PLATFORM,
        rid,
        title,
        artwork: imageUrl(row.hts_pic || row.pic || row.pic2 || row.img),
        artist: cleanText(row.nickname || row.uname),
        description: cleanText(row.intro || row.info || row.desc),
        worksNum: number(row.songnum || row.total || row.info, 0),
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
        data.success === false ||
        (data.code !== undefined && data.code !== 200 && data.code !== 0)
    ) {
        throw new Error(
            (data && (data.message || data.msg)) || '酷我接口返回异常',
        );
    }
    return data;
}

function searchParams(query, page, type) {
    if (type === 'album') {
        return {
            all: query,
            ft: type,
            itemset: 'web_2013',
            client: 'kt',
            pn: page - 1,
            rn: PAGE_SIZE,
            rformat: 'json',
            encoding: 'utf8',
            pcjson: 1,
        };
    }
    return {
        client: 'kt',
        all: query,
        pn: page - 1,
        rn: PAGE_SIZE,
        uid: 794762570,
        ver: 'kwplayer_ar_9.2.2.1',
        vipver: 1,
        show_copyright_off: 1,
        newver: 1,
        ft: type,
        cluster: 0,
        strategy: 2012,
        encoding: 'utf8',
        rformat: 'json',
        vermerge: 1,
        mobi: 1,
        itemset: 'web_2013',
        pcjson: 1,
    };
}

async function search(query, page, type) {
    const searchType = type || 'music';
    const upstreamType = {music: 'music', album: 'album', artist: 'artist'}[
        searchType
    ];
    if (!upstreamType) return {isEnd: true, data: []};
    const currentPage = pageNumber(page);
    const data = await request({
        method: 'GET',
        url: 'http://search.kuwo.cn/r.s',
        params: searchParams(query, currentPage, upstreamType),
    });
    let rows;
    let convert;
    if (searchType === 'album') {
        rows = data.albumlist || data.abslist || [];
        convert = album;
    } else if (searchType === 'artist') {
        rows = data.artistlist || data.abslist || [];
        convert = artist;
    } else {
        rows = data.abslist || [];
        convert = music;
    }
    const total = number(data.TOTAL || data.total, rows.length);
    return {
        isEnd: total
            ? currentPage * PAGE_SIZE >= total
            : rows.length < PAGE_SIZE,
        data: rows.map(convert).filter(Boolean),
    };
}

async function songInfo(id) {
    const data = await request({
        method: 'GET',
        url: 'https://wapi.kuwo.cn/api/www/music/musicInfo',
        params: {mid: id, httpsStatus: 1},
    });
    return data.data || data;
}

async function getMusicInfo(item) {
    const data = await songInfo(nativeId(item, 'music'));
    const detail = music(data.songinfo || data.songInfo || data);
    if (!detail) return null;
    return compact({
        title: detail.title,
        artist: detail.artist,
        album: detail.album,
        artwork: detail.artwork,
        duration: detail.duration,
        qualities: detail.qualities,
        mvId: detail.mvId,
    });
}

async function getMusicVideo(item) {
    const detail = await songInfo(nativeId(item, 'music'));
    const song = detail.songinfo || detail.songInfo || detail;
    const mvInfo = (song && song.mvpayinfo) || {};
    const mvId = String(
        (item && item.mvId) || mvInfo.vid || (song && song.mvid) || '',
    );
    if (!mvId || (mvInfo.play !== undefined && !number(mvInfo.play, 0)))
        return null;
    const result = await request({
        method: 'GET',
        url: 'https://antiserver.kuwo.cn/anti.s',
        params: {
            type: 'convert_url',
            rid: 'MV_' + mvId,
            format: 'mp4|mkv',
            response: 'url',
        },
        headers: {Referer: 'https://www.kuwo.cn/'},
    });
    const url = String(
        typeof result === 'string' ? result : result.url || '',
    ).trim();
    if (!/^https?:\/\//i.test(url)) return null;
    return {
        id: mvId,
        title: item && item.title,
        artist: item && item.artist,
        artwork: item && item.artwork,
        sources: [
            {
                quality: '平台默认',
                height: 720,
                url,
                headers: {
                    Referer: 'https://www.kuwo.cn/',
                    'User-Agent': USER_AGENT,
                },
                mimeType: 'video/mp4',
            },
        ],
    };
}

function lrcTime(value) {
    const seconds = number(value, 0);
    const minutes = Math.floor(seconds / 60);
    return (
        String(minutes).padStart(2, '0') +
        ':' +
        (seconds - minutes * 60).toFixed(2).padStart(5, '0')
    );
}

async function getLyric(item) {
    const data = await request({
        method: 'GET',
        url: 'https://wapi.kuwo.cn/openapi/v1/www/lyric/getlyric',
        params: {musicId: nativeId(item, 'music'), httpsStatus: 1},
    });
    const body = data.data || data;
    const lines = body.lrclist || body.lrcList || [];
    if (!lines.length) return null;
    return {
        rawLrc: lines
            .map(
                line =>
                    '[' + lrcTime(line.time) + ']' + cleanText(line.lineLyric),
            )
            .join('\n'),
    };
}

async function getAlbumInfo(item, page) {
    const currentPage = pageNumber(page);
    const data = await request({
        method: 'GET',
        url: 'http://search.kuwo.cn/r.s',
        params: {
            stype: 'albuminfo',
            albumid: nativeId(item, 'album'),
            pn: 0,
            rn: 1000,
            encoding: 'utf8',
            rformat: 'json',
            sortby: 0,
            alflac: 1,
            show_copyright_off: 1,
            pcmp4: 1,
            plat: 'pc',
            thost: 'search.kuwo.cn',
            vipver: 'MUSIC_9.1.1.2_BCS2',
            devid: '38668888',
            newver: 1,
            pcjson: 1,
        },
    });
    const rows = data.musiclist || [];
    const start = (currentPage - 1) * PAGE_SIZE;
    const result = {
        isEnd: start + PAGE_SIZE >= rows.length,
        musicList: rows
            .slice(start, start + PAGE_SIZE)
            .map(music)
            .filter(Boolean),
    };
    if (currentPage === 1) result.albumItem = album(data);
    return result;
}

async function getArtistWorks(item, page, type) {
    const currentPage = pageNumber(page);
    const id = nativeId(item, 'artist');
    const data = await request({
        method: 'GET',
        url: 'http://search.kuwo.cn/r.s',
        params: {
            stype: type === 'album' ? 'albumlist' : 'artist2music',
            artistid: id,
            pn: currentPage - 1,
            rn: PAGE_SIZE,
            encoding: 'utf8',
            rformat: 'json',
            sortby: 0,
            alflac: 1,
            show_copyright_off: 1,
            pcmp4: 1,
            plat: 'pc',
            thost: 'search.kuwo.cn',
            vipver: 1,
            devid: '38668888',
            newver: 1,
            itemset: 'web_2013',
            pcjson: 1,
        },
    });
    if (type === 'album') {
        const rows = data.albumlist || [];
        const total = number(data.total || data.TOTAL, rows.length);
        return {
            isEnd: total
                ? currentPage * PAGE_SIZE >= total
                : rows.length < PAGE_SIZE,
            data: rows.map(album).filter(Boolean),
        };
    }
    if (type !== 'music') return {isEnd: true, data: []};
    const rows = data.musiclist || [];
    const total = number(data.total || data.TOTAL, rows.length);
    return {
        isEnd: total
            ? currentPage * PAGE_SIZE >= total
            : rows.length < PAGE_SIZE,
        data: rows.map(music).filter(Boolean),
    };
}

function collectTopGroups(root) {
    const result = [];
    function visit(node, groupTitle) {
        const children = (node && node.child) || [];
        if (!children.length && node && node.sourceid) {
            return sheet({...node, id: node.sourceid}, 'top');
        }
        const rows = children
            .map(child => visit(child, node.name || groupTitle))
            .filter(Boolean);
        if (rows.length)
            result.push({
                title: cleanText(node.name || groupTitle || '榜单'),
                data: rows,
            });
        return null;
    }
    visit(root, '榜单');
    return result;
}

async function getTopLists() {
    const data = await request({
        method: 'GET',
        url: 'https://wapi.kuwo.cn/api/pc/bang/list',
    });
    return collectTopGroups(data.data || data);
}

async function getTopListDetail(item, page) {
    const currentPage = pageNumber(page);
    const data = await request({
        method: 'GET',
        url: 'http://kbangserver.kuwo.cn/ksong.s',
        params: {
            from: 'pc',
            fmt: 'json',
            pn: currentPage - 1,
            rn: PAGE_SIZE,
            type: 'bang',
            data: 'content',
            id: nativeId(item, 'top'),
            show_copyright_off: 1,
            isbang: 1,
        },
    });
    const rows = data.musiclist || [];
    const total = number(data.num, rows.length);
    const result = {
        isEnd: total
            ? currentPage * PAGE_SIZE >= total
            : rows.length < PAGE_SIZE,
        musicList: rows.map(music).filter(Boolean),
    };
    if (currentPage === 1)
        result.topListItem = sheet({...data, id: nativeId(item, 'top')}, 'top');
    return result;
}

async function getMediaSource(item, quality) {
    const order = ['low', 'standard', 'high', 'super'];
    const index = Math.max(0, order.indexOf(quality || 'standard'));
    const levels = order
        .slice(0, index + 1)
        .reverse()
        .map(key => QUALITY_LEVELS[key]);
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
                throw new Error(data.message || '酷我播放解析失败');
            return {
                url: result.url,
                headers: result.playbackHeaders || result.headers || {},
            };
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError || new Error('酷我播放解析失败');
}

module.exports = {
    platform: PLATFORM,
    appVersion: '>=0.0',
    version: '1.1.0',
    srcUrl: 'http://23.254.235.247:6080/yuan/3.js',
    author: 'MusicFree user adapter',
    cacheControl: 'no-cache',
    primaryKey: ['id', 'rid', 'mvId'],
    supportedSearchType: ['music', 'album', 'artist'],
    defaultSearchType: 'music',
    description:
        '酷我独立音源。目录使用酷我公开接口，播放依赖 QingMusic 解析服务。',
    search,
    getMediaSource,
    getMusicVideo,
    getMusicInfo,
    getLyric,
    getAlbumInfo,
    getArtistWorks,
    getTopLists,
    getTopListDetail,
};
