/* QingMusic Kugou source for MusicFree. */
const axios = require('axios');
const CryptoJS = require('crypto-js');

const PLATFORM = '轻酷狗';
const SOURCE = 'kg';
const MUSIC_SERVER = 'https://musicserver.haitangw.cc/v1/music/resolve-url';
const PAGE_SIZE = 30;
const MOBILE_API = 'http://mobilecdn.kugou.com';
const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const QUALITY_LEVELS = {
    low: 'standard',
    standard: 'exhigh',
    high: 'lossless',
    super: 'clear',
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
    const url = String(value || '').replace('{size}', '400');
    if (url.startsWith('//')) return 'https:' + url;
    return url.startsWith('http://') ? 'https://' + url.slice(7) : url;
}

function nativeId(item, type, field) {
    if (field && item && item[field] !== undefined && item[field] !== '')
        return String(item[field]);
    if (item && item.rid !== undefined && item.rid !== '')
        return String(item.rid);
    const value = String((item && item.id) || '');
    const prefix = type + ':';
    if (!value.startsWith(prefix)) throw new Error('酷狗' + type + '标识无效');
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

function splitFilename(value) {
    const parts = cleanText(value).split(' - ');
    return parts.length > 1
        ? {artist: parts.shift(), title: parts.join(' - ')}
        : {artist: '', title: parts[0] || ''};
}

function qualities(row) {
    const result = {};
    const low = row.FileSize || row.filesize;
    const standard = row.HQFileSize || row['320filesize'];
    const high = row.SQFileSize || row.sqfilesize;
    const superSize =
        row.ResFileSize || row.filesize_high || row.filesize_super;
    if (low) result.low = {size: low};
    if (standard) result.standard = {size: standard};
    if (high) result.high = {size: high};
    if (superSize) result.super = {size: superSize};
    return result;
}

function artistNames(row, parsed) {
    const values = row.Singers || row.authors || [];
    const names = values
        .map(item => item && (item.SingerName || item.name || item.author_name))
        .filter(Boolean);
    return (
        [...new Set(names)].join('、') ||
        cleanText(row.SingerName || row.singername || parsed.artist)
    );
}

function music(row) {
    if (!row) return null;
    const hash = String(
        row.FileHash || row.hash || row.req_hash || '',
    ).toUpperCase();
    const parsed = splitFilename(row.FileName || row.filename || row.fileName);
    const title = cleanText(
        row.SongName ||
            row.songname ||
            row.songName ||
            row.remark ||
            parsed.title,
    );
    if (!hash || !title) return null;
    const trans = row.trans_param || {};
    return {
        id: 'music:' + hash,
        platform: PLATFORM,
        rid: hash,
        hash,
        mvHash: String(
            row.MvHash || row.mvhash || row.mvHash || row.mv_hash || '',
        ).toUpperCase(),
        albumId: String(
            row.AlbumID || row.album_id || row.albumid || row.req_albumid || '',
        ),
        audioId: String(
            row.Audioid || row.audio_id || row.audio_group_id || '',
        ),
        title,
        artist: artistNames(row, parsed) || '未知歌手',
        album:
            cleanText(
                row.AlbumName || row.album_name || row.album || row.remark,
            ) || '未知专辑',
        artwork: imageUrl(
            row.Image ||
                row.imgurl ||
                row.album_img ||
                row.album_sizable_cover ||
                trans.union_cover,
        ),
        duration: number(
            row.Duration ||
                row.duration ||
                (row.extra && row.extra['128timelength']) / 1000,
            0,
        ),
        qualities: qualities(row),
    };
}

function album(row) {
    if (!row) return null;
    const rid = String(row.albumid || row.album_id || row.id || '');
    const title = cleanText(row.albumname || row.album_name || row.name);
    if (!rid || !title) return null;
    return {
        id: 'album:' + rid,
        platform: PLATFORM,
        rid,
        title,
        artwork: imageUrl(row.imgurl || row.album_img),
        artist: cleanText(row.singername || row.author_name),
        date: cleanText(row.publishtime || row.publish_date),
        description: cleanText(row.intro),
        worksNum: number(row.songcount || row.total, 0),
    };
}

function artist(row) {
    if (!row) return null;
    const rid = String(
        row.singerid || row.singer_id || row.author_id || row.id || '',
    );
    const name = cleanText(
        row.singername || row.singer_name || row.author_name || row.name,
    );
    if (!rid || !name) return null;
    return {
        id: 'artist:' + rid,
        platform: PLATFORM,
        rid,
        name,
        avatar: imageUrl(row.imgurl || row.avatar || row.sizable_avatar),
        worksNum: number(row.songcount || row.song_num, 0),
    };
}

function sheet(row, type) {
    if (!row) return null;
    const entityType = type || 'sheet';
    const rid = String(
        row.specialid || row.rankid || row.rank_id || row.id || '',
    );
    const title = cleanText(
        row.specialname || row.rankname || row.name || row.title,
    );
    if (!rid || !title) return null;
    return {
        id: entityType + ':' + rid,
        platform: PLATFORM,
        rid,
        title,
        artwork: imageUrl(row.imgurl || row.img_cover || row.bannerurl),
        artist: cleanText(row.nickname || row.singername),
        description: cleanText(row.intro),
        worksNum: number(row.songcount || row.total, 0),
    };
}

async function request(config) {
    const response = await axios({
        timeout: 12000,
        ...config,
        headers: {'User-Agent': USER_AGENT, ...(config.headers || {})},
    });
    const data = response && response.data;
    if (data === undefined || data === null)
        throw new Error('酷狗接口响应为空');
    if (typeof data !== 'object') return data;
    const code = data.error_code !== undefined ? data.error_code : data.errcode;
    if (code !== undefined && number(code, -1) !== 0) {
        throw new Error(data.error_msg || data.error || '酷狗接口返回异常');
    }
    if (data.status !== undefined && data.status !== 0 && data.status !== 1) {
        throw new Error(data.error || '酷狗接口返回异常');
    }
    return data;
}

function mobileRequest(path, params) {
    return request({
        method: 'GET',
        url: MOBILE_API + path,
        params: {format: 'json', ...params},
    });
}

async function search(query, page, type) {
    const searchType = type || 'music';
    const currentPage = pageNumber(page);
    let data;
    let rows;
    let total;
    let convert;
    if (searchType === 'music') {
        data = await request({
            method: 'GET',
            url: 'https://songsearch.kugou.com/song_search_v2',
            params: {
                keyword: query,
                page: currentPage,
                pagesize: PAGE_SIZE,
                userid: 0,
                platform: 'WebFilter',
                filter: 2,
                iscorrection: 1,
                privilege_filter: 0,
                area_code: 1,
            },
        });
        const body = data.data || {};
        rows = body.lists || [];
        total =
            body.total !== undefined
                ? number(body.total, rows.length)
                : undefined;
        convert = music;
    } else {
        const path = {
            album: '/api/v3/search/album',
            artist: '/api/v3/search/singer',
            sheet: '/api/v3/search/special',
        }[searchType];
        if (!path) return {isEnd: true, data: []};
        data = await mobileRequest(path, {
            keyword: query,
            page: currentPage,
            pagesize: PAGE_SIZE,
            showtype: 1,
        });
        const body = data.data || {};
        rows = Array.isArray(body) ? body : body.info || [];
        const reportedTotal =
            data.total !== undefined ? data.total : body.total;
        total =
            reportedTotal !== undefined
                ? number(reportedTotal, rows.length)
                : undefined;
        if (total !== undefined && (currentPage - 1) * PAGE_SIZE >= total)
            rows = [];
        if (
            searchType === 'artist' &&
            currentPage > 1 &&
            total === undefined &&
            rows.length < PAGE_SIZE
        )
            rows = [];
        convert =
            searchType === 'album'
                ? album
                : searchType === 'artist'
                ? artist
                : row => sheet(row, 'sheet');
    }
    return {
        isEnd:
            total !== undefined
                ? currentPage * PAGE_SIZE >= total
                : rows.length < PAGE_SIZE,
        data: rows.map(convert).filter(Boolean),
    };
}

async function songInfo(item) {
    return request({
        method: 'GET',
        url: 'https://m.kugou.com/app/i/getSongInfo.php',
        params: {
            cmd: 'playInfo',
            hash: nativeId(item, 'music', 'hash'),
            album_id: (item && item.albumId) || '',
        },
    });
}

async function getMusicInfo(item) {
    const detail = music(await songInfo(item));
    return detail
        ? compact({
              title: detail.title,
              artist: detail.artist,
              album: detail.album,
              artwork: detail.artwork,
              duration: detail.duration,
              qualities: detail.qualities,
              hash: detail.hash,
              mvHash: detail.mvHash,
              albumId: detail.albumId,
              audioId: detail.audioId,
          })
        : null;
}

async function findMvHash(item) {
    const direct = String(
        (item &&
            (item.mvHash || item.MvHash || item.mvhash || item.mv_hash)) ||
            '',
    ).toUpperCase();
    if (direct) return direct;

    try {
        const detail = await songInfo(item);
        const detailHash = String(
            (detail &&
                (detail.MvHash ||
                    detail.mvHash ||
                    detail.mvhash ||
                    detail.mv_hash)) ||
                '',
        ).toUpperCase();
        if (detailHash) return detailHash;
    } catch (_) {}

    const data = await request({
        method: 'GET',
        url: 'https://songsearch.kugou.com/song_search_v2',
        params: {
            keyword: [item && item.title, item && item.artist]
                .filter(Boolean)
                .join(' '),
            page: 1,
            pagesize: 10,
            userid: 0,
            platform: 'WebFilter',
            filter: 2,
            iscorrection: 1,
            privilege_filter: 0,
            area_code: 1,
        },
    });
    const expectedHash = nativeId(item, 'music', 'hash').toUpperCase();
    const rows = (data.data && data.data.lists) || [];
    const match = rows.find(
        row => String(row.FileHash || row.hash || '').toUpperCase() === expectedHash,
    );
    return String(
        (match &&
            (match.MvHash || match.mvHash || match.mvhash || match.mv_hash)) ||
            '',
    ).toUpperCase();
}

async function getMusicVideo(item) {
    const mvHash = await findMvHash(item);
    if (!mvHash) return null;
    const data = await request({
        method: 'GET',
        url: 'http://trackermv.kugou.com/interface/index/cmd=100',
        params: {
            hash: mvHash,
            key: CryptoJS.MD5(mvHash + 'kugoumvcloud').toString(),
            pid: 6,
            ext: 'mp4',
            ismp3: 0,
        },
    });
    const mvData = data.mvdata || {};
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
                      headers: {
                          Referer: 'https://www.kugou.com/',
                          'User-Agent': USER_AGENT,
                      },
                      mimeType: 'video/mp4',
                  }
                : null;
        })
        .filter(Boolean);
    return sources.length
        ? {
              id: mvHash,
              title: data.songname || (item && item.title),
              artist: data.singer || (item && item.artist),
              artwork: item && item.artwork,
              sources,
          }
        : null;
}

async function getLyric(item) {
    const hash = nativeId(item, 'music', 'hash');
    const time = String(Date.now());
    const signatureText =
        'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwtclienttime=' +
        time +
        'clientver=20000dfid=-hash=' +
        hash +
        'keyword=mid=' +
        time +
        'srcappid=2919timelength=0NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt';
    try {
        const data = await request({
            method: 'GET',
            url: 'https://m3ws.kugou.com/api/v1/krc/get_lyrics',
            params: {
                clienttime: time,
                clientver: 20000,
                dfid: '-',
                hash,
                keyword: '',
                mid: time,
                srcappid: 2919,
                timelength: 0,
                signature: CryptoJS.MD5(signatureText).toString(),
            },
            headers: {
                'User-Agent': 'Android/10 KugouMusic/13.0.0',
                Accept: 'application/json',
            },
        });
        if (data.data && data.data.lrc)
            return {rawLrc: data.data.lrc.replace(/\r/g, '')};
    } catch (_) {}
    const legacy = await request({
        method: 'GET',
        url: 'https://m.kugou.com/app/i/krc.php',
        params: {cmd: 100, hash, timelength: 1},
    });
    const rawLrc = String(legacy || '');
    const start = rawLrc.indexOf('[0');
    return start >= 0 ? {rawLrc: rawLrc.slice(start).replace(/\r/g, '')} : null;
}

async function getAlbumInfo(item, page) {
    const currentPage = pageNumber(page);
    const id = nativeId(item, 'album');
    const data = await mobileRequest('/api/v3/album/song', {
        albumid: id,
        page: currentPage,
        pagesize: PAGE_SIZE,
    });
    const body = data.data || {};
    const rows = body.info || [];
    const result = {
        isEnd: currentPage * PAGE_SIZE >= number(body.total, rows.length),
        musicList: rows.map(music).filter(Boolean),
    };
    if (currentPage === 1) {
        const infoData = await mobileRequest('/api/v3/album/info', {
            albumid: id,
        });
        result.albumItem = album(
            (infoData.data && (infoData.data.info || infoData.data)) || item,
        );
    }
    return result;
}

async function getArtistWorks(item, page, type) {
    const currentPage = pageNumber(page);
    const id = nativeId(item, 'artist');
    if (type !== 'music' && type !== 'album') return {isEnd: true, data: []};
    const path =
        type === 'album' ? '/api/v3/singer/album' : '/api/v3/singer/song';
    const data = await mobileRequest(path, {
        singerid: id,
        page: currentPage,
        pagesize: PAGE_SIZE,
    });
    const body = data.data || {};
    const rows = body.info || [];
    return {
        isEnd: currentPage * PAGE_SIZE >= number(body.total, rows.length),
        data: rows.map(type === 'album' ? album : music).filter(Boolean),
    };
}

async function getMusicSheetInfo(item, page) {
    const currentPage = pageNumber(page);
    const id = nativeId(item, 'sheet');
    const data = await mobileRequest('/api/v3/special/song', {
        specialid: id,
        page: currentPage,
        pagesize: PAGE_SIZE,
    });
    const body = data.data || {};
    const rows = body.info || [];
    const result = {
        isEnd: currentPage * PAGE_SIZE >= number(body.total, rows.length),
        musicList: rows.map(music).filter(Boolean),
    };
    if (currentPage === 1) {
        const infoData = await mobileRequest('/api/v5/special/info', {
            specialid: id,
        });
        result.sheetItem = sheet(
            (infoData.data && (infoData.data.info || infoData.data)) || item,
            'sheet',
        );
    }
    return result;
}

async function getTopLists() {
    const data = await mobileRequest('/api/v3/rank/list', {
        page: 1,
        pagesize: 100,
    });
    const rows = (data.data && data.data.info) || [];
    const groups = new Map();
    rows.forEach(row => {
        const title = cleanText(
            row.classify_name || (row.classify === 1 ? '热门榜单' : '特色榜单'),
        );
        if (!groups.has(title)) groups.set(title, []);
        const item = sheet(row, 'top');
        if (item) groups.get(title).push(item);
    });
    return [...groups].map(([title, dataRows]) => ({title, data: dataRows}));
}

async function getTopListDetail(item, page) {
    const currentPage = pageNumber(page);
    const id = nativeId(item, 'top');
    const data = await mobileRequest('/api/v3/rank/song', {
        rankid: id,
        page: currentPage,
        pagesize: PAGE_SIZE,
    });
    const body = data.data || {};
    const rows = body.info || [];
    const result = {
        isEnd: currentPage * PAGE_SIZE >= number(body.total, rows.length),
        musicList: rows.map(music).filter(Boolean),
    };
    if (currentPage === 1)
        result.topListItem = {...item, id: 'top:' + id, rid: id};
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
                data: {
                    source: SOURCE,
                    rid: nativeId(item, 'music', 'hash'),
                    level,
                },
                headers: {'Content-Type': 'application/json'},
            });
            const result = data.data || {};
            if (data.code !== 0 || !result.url)
                throw new Error(data.message || '酷狗播放解析失败');
            return {
                url: result.url,
                headers: result.playbackHeaders || result.headers || {},
            };
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError || new Error('酷狗播放解析失败');
}

module.exports = {
    platform: PLATFORM,
    appVersion: '>=0.0',
    version: '1.1.0',
    srcUrl: 'http://23.254.235.247:6080/yuan/2.js',
    author: 'MusicFree user adapter',
    cacheControl: 'no-cache',
    primaryKey: ['id', 'rid', 'hash', 'mvHash', 'albumId', 'audioId'],
    supportedSearchType: ['music', 'album', 'artist', 'sheet'],
    defaultSearchType: 'music',
    description:
        '酷狗独立音源。目录使用酷狗公开接口，播放依赖 QingMusic 解析服务。',
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
};
