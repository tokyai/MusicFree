/* QingMusic Migu source for MusicFree. */
const axios = require('axios');
const CryptoJS = require('crypto-js');

const PLATFORM = '轻咪咕';
const PAGE_SIZE = 30;
const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const DEVICE_ID = '963B7AA0D21511ED807EE5846EC87D20';
const SIGN_SALT =
    '6cdc72a439cef99a3418d2a78aa28c73yyapp2d16148780a1dcc7408e06336b98cfd50963B7AA0D21511ED807EE5846EC87D20';
const TONE_FLAGS = {low: 'PQ', standard: 'HQ', high: 'SQ', super: 'ZQ24'};

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
    if (url.startsWith('/')) return 'https://d.musicapp.migu.cn' + url;
    return url.startsWith('http://') ? 'https://' + url.slice(7) : url;
}

function nativeId(item, type, field) {
    if (field && item && item[field] !== undefined && item[field] !== '')
        return String(item[field]);
    if (item && item.rid !== undefined && item.rid !== '')
        return String(item.rid);
    const value = String((item && item.id) || '');
    const prefix = type + ':';
    if (!value.startsWith(prefix)) throw new Error('咪咕' + type + '标识无效');
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
    (row.audioFormats || []).forEach(format => {
        const info = {size: format.asize || format.isize};
        if (format.formatType === 'PQ') result.low = info;
        if (format.formatType === 'HQ') result.standard = info;
        if (format.formatType === 'SQ') result.high = info;
        if (format.formatType === 'ZQ24') result.super = info;
    });
    return result;
}

function music(row) {
    if (!row) return null;
    if (row.songData) {
        try {
            row = {...row, ...JSON.parse(row.songData)};
        } catch (_) {}
    }
    const rid = String(row.songId || row.id || '');
    const contentId = String(row.contentId || row.resId || '');
    const title = cleanText(row.songName || row.name || row.txt);
    if ((!rid && !contentId) || !title) return null;
    const singerList = row.singerList || [];
    return {
        id: 'music:' + (rid || contentId),
        platform: PLATFORM,
        rid: rid || contentId,
        contentId,
        copyrightId: String(row.copyrightId || ''),
        resourceType: String(row.resourceType || row.resType || '2'),
        lyricUrls: [row.lyricUrl, row.lrcUrl, row.ext && row.ext.lrcUrl].filter(
            Boolean,
        ),
        title,
        artist:
            [
                ...new Set(
                    singerList
                        .map(item => item && (item.name || item.singerName))
                        .filter(Boolean),
                ),
            ].join('、') ||
            cleanText(row.txt2) ||
            '未知歌手',
        album: cleanText(row.album || row.txt3) || '未知专辑',
        artwork: imageUrl(row.img3 || row.img2 || row.img1 || row.img),
        duration: number(row.duration || row.length || row.timeLength, 0),
        qualities: qualities(row),
    };
}

function top(row) {
    if (!row) return null;
    const rid = String(row.rankId || '');
    const title = cleanText(row.rankName);
    if (!rid || !title) return null;
    return {
        id: 'top:' + rid,
        platform: PLATFORM,
        rid,
        title,
        artwork: imageUrl(row.imageUrl),
    };
}

async function request(config) {
    const response = await axios({
        timeout: 12000,
        ...config,
        headers: {
            'User-Agent': USER_AGENT,
            Referer: 'https://music.migu.cn/',
            ...(config.headers || {}),
        },
    });
    const data = response && response.data;
    if (data === undefined || data === null)
        throw new Error('咪咕接口响应为空');
    if (typeof data !== 'object') return data;
    if (
        data.code !== undefined &&
        !['000000', '0', '200'].includes(String(data.code))
    ) {
        throw new Error(data.info || data.message || '咪咕接口返回异常');
    }
    return data;
}

function searchHeaders(query) {
    const timestamp = String(Date.now());
    return {
        uiVersion: 'A_music_3.6.1',
        deviceId: DEVICE_ID,
        timestamp,
        sign: CryptoJS.MD5(query + SIGN_SALT + timestamp).toString(),
        channel: '0146921',
    };
}

function listenHeaders() {
    return {
        appid: 'h5',
        timestamp: String(Date.now()),
        deviceid: DEVICE_ID,
        subchannel: '014X031',
        channel: '014X031',
        platform: 'H5',
        version: '6.8.8',
        ua: 'Android_migu',
    };
}

function searchSwitch(type) {
    const value = {
        song: 0,
        album: 0,
        singer: 0,
        tagSong: 0,
        mvSong: 0,
        bestShow: 0,
        songlist: 0,
        lyricSong: 0,
    };
    value[type === 'lyric' ? 'lyricSong' : 'song'] = 1;
    return JSON.stringify(value);
}

function normalizeMatchText(value) {
    return cleanText(value)
        .toLowerCase()
        .replace(/[\s\-_.·・,，。!！?？:：;；'"“”‘’()（）\[\]【】]/g, '');
}

function videoSearchSwitch() {
    return JSON.stringify({
        song: 0,
        album: 0,
        singer: 0,
        tagSong: 0,
        mvSong: 1,
        bestShow: 0,
        songlist: 0,
        lyricSong: 0,
    });
}

async function search(query, page, type) {
    const searchType = type || 'music';
    if (searchType !== 'music' && searchType !== 'lyric')
        return {isEnd: true, data: []};
    const currentPage = pageNumber(page);
    const data = await request({
        method: 'GET',
        url: 'https://jadeite.migu.cn/music_search/v3/search/searchAll',
        params: {
            isCorrect: 0,
            isCopyright: 1,
            searchSwitch: searchSwitch(searchType),
            pageSize: PAGE_SIZE,
            text: query,
            pageNo: currentPage,
            sort: 0,
            sid: 'USS',
        },
        headers: searchHeaders(query),
    });
    const body =
        searchType === 'lyric' ? data.lyricResultData : data.songResultData;
    if (!body) throw new Error('咪咕搜索响应结构缺失');
    const sourceRows =
        searchType === 'lyric' ? body.result || [] : body.resultList || [];
    const rows = searchType === 'lyric' ? sourceRows : sourceRows.flat();
    const converted = rows
        .map(row => {
            const item = music(row);
            if (item && searchType === 'lyric')
                item.rawLrcTxt = cleanText(
                    row.multiLyricStr || row.highlightLyricStr || '',
                );
            return item;
        })
        .filter(Boolean);
    const total = number(body.totalCount, rows.length);
    return {
        isEnd:
            data.end === true ||
            (total
                ? currentPage * PAGE_SIZE >= total
                : rows.length < PAGE_SIZE),
        data: converted,
    };
}

async function songDetail(item) {
    const contentId = nativeId(item, 'music', 'contentId');
    const data = await request({
        method: 'GET',
        url: 'https://c.musicapp.migu.cn/MIGUM3.0/resource/song/by-contentids/v2.0',
        params: {contentId},
    });
    return data.data && data.data[0];
}

async function getMusicInfo(item) {
    const detail = music(await songDetail(item));
    return detail
        ? compact({
              title: detail.title,
              artist: detail.artist,
              album: detail.album,
              artwork: detail.artwork,
              duration: detail.duration,
              qualities: detail.qualities,
              contentId: detail.contentId,
              copyrightId: detail.copyrightId,
              resourceType: detail.resourceType,
              lyricUrls: detail.lyricUrls,
          })
        : null;
}

async function listen(item, toneFlag) {
    const data = await request({
        method: 'GET',
        url: 'https://app.c.nf.migu.cn/MIGUM3.0/strategy/pc/listen/v1.0',
        params: {
            resourceType: (item && item.resourceType) || '2',
            copyrightId: item && item.copyrightId,
            contentId: nativeId(item, 'music', 'contentId'),
            toneFlag,
        },
        headers: listenHeaders(),
    });
    return data.data || {};
}

async function getLyric(item) {
    let urls = (item && item.lyricUrls) || [];
    if (!urls.length) {
        try {
            const result = await listen(item, 'PQ');
            urls = [result.lrcUrl, result.lyricUrl].filter(Boolean);
        } catch (_) {
            const detail = await songDetail(item);
            urls = detail
                ? [
                      detail.lyricUrl,
                      detail.lrcUrl,
                      detail.ext && detail.ext.lrcUrl,
                  ].filter(Boolean)
                : [];
        }
    }
    for (const url of urls) {
        try {
            const rawLrc = await request({method: 'GET', url, timeout: 8000});
            if (rawLrc) return {rawLrc: String(rawLrc)};
        } catch (_) {}
    }
    return null;
}

async function getTopLists() {
    const data = await request({
        method: 'GET',
        url: 'https://app.c.nf.migu.cn/pc/bmw/rank/rank-index/v1.0',
    });
    const groups = (data.data && data.data.contents) || [];
    return groups
        .map(group => ({
            title: cleanText(group.style) || '咪咕榜单',
            data: (group.contents || []).map(top).filter(Boolean),
        }))
        .filter(group => group.data.length);
}

async function getTopListDetail(item, page) {
    const currentPage = pageNumber(page);
    const id = nativeId(item, 'top');
    const data = await request({
        method: 'GET',
        url: 'https://app.c.nf.migu.cn/pc/bmw/rank/rank-info/v1.0',
        params: {rankId: id, pageNo: currentPage, pageSize: PAGE_SIZE},
    });
    const body = data.data;
    if (!body || !Array.isArray(body.contents))
        throw new Error('咪咕榜单详情结构缺失');
    const result = {
        isEnd:
            body.hasNextPage === undefined
                ? currentPage * PAGE_SIZE >=
                  number(body.totalCount, body.contents.length)
                : !body.hasNextPage,
        musicList: body.contents.map(music).filter(Boolean),
    };
    if (currentPage === 1) {
        result.topListItem = {
            ...item,
            id: 'top:' + id,
            rid: id,
            title: cleanText(body.title) || item.title,
            artwork: imageUrl(body.titlePic) || item.artwork,
            description: cleanText(body.desc),
            worksNum: number(body.totalCount, 0),
        };
    }
    return result;
}

async function getMediaSource(item, quality) {
    const order = ['low', 'standard', 'high', 'super'];
    const index = Math.max(0, order.indexOf(quality || 'standard'));
    let lastError;
    for (const key of order.slice(0, index + 1).reverse()) {
        try {
            const result = await listen(item, TONE_FLAGS[key]);
            if (!result.url) throw new Error(result.info || '咪咕播放地址为空');
            return {
                url: result.url,
                headers: result.playbackHeaders || result.headers || {},
            };
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError || new Error('咪咕播放解析失败');
}

async function getMusicVideo(item) {
    const title = String((item && item.title) || '').trim();
    const artist = String((item && item.artist) || '').trim();
    if (!title) return null;
    const query = [title, artist].filter(Boolean).join(' ');
    const data = await request({
        method: 'GET',
        url: 'https://jadeite.migu.cn/music_search/v3/search/searchAll',
        params: {
            isCorrect: 0,
            isCopyright: 1,
            searchSwitch: videoSearchSwitch(),
            pageSize: 20,
            text: query,
            pageNo: 1,
            sort: 0,
            sid: 'USS',
        },
        headers: searchHeaders(query),
    });
    const targetTitle = normalizeMatchText(title);
    const targetArtist = normalizeMatchText(artist);
    const rows =
        (data.mvSongResultData && data.mvSongResultData.result) || [];
    const match = rows.find(row => {
        const candidateTitle = normalizeMatchText(row && row.name);
        const candidateArtist = normalizeMatchText(
            ((row && row.singers) || [])
                .map(singer => singer && singer.name)
                .filter(Boolean)
                .join(' '),
        );
        return (
            candidateTitle === targetTitle &&
            (!targetArtist ||
                candidateArtist.includes(targetArtist) ||
                targetArtist.includes(candidateArtist))
        );
    });
    const mv = match && match.mvList && match.mvList[0];
    if (
        !mv ||
        number(mv.price, 0) > 0 ||
        String(mv.vipType || '0') !== '0'
    )
        return null;

    const detailData = await request({
        method: 'GET',
        url: 'https://c.musicapp.migu.cn/MIGUM3.0/v1.0/content/resourceinfo.do',
        params: {
            copyrightId: mv.copyrightId,
            contentId: mv.id,
            resourceType: 'D',
        },
    });
    const detail = detailData.resource && detailData.resource[0];
    const heightMap = {PQ: 480, HQ: 720, SQ: 1080};
    const sources = ((detail && detail.rateFormats) || [])
        .map(format => {
            const height = heightMap[format.formatType];
            let url = String(format.url || '').trim();
            if (url.startsWith('/')) {
                url = 'https://freetyst.nf.migu.cn' + url;
            }
            return height && /^https?:\/\//i.test(url)
                ? {
                      quality: height + 'p',
                      height,
                      url,
                      headers: {
                          Referer: 'https://music.migu.cn/',
                          'User-Agent': USER_AGENT,
                      },
                      mimeType: 'video/mp4',
                  }
                : null;
        })
        .filter(Boolean);
    const artwork =
        mv.mvPicUrl && mv.mvPicUrl[0] && imageUrl(mv.mvPicUrl[0].img);
    if (sources.length) {
        try {
            await axios.head(sources[0].url, {
                timeout: 8000,
                headers: sources[0].headers,
            });
        } catch (_) {
            return null;
        }
    }
    return sources.length
        ? {
              id: String(mv.id),
              title: match.name || title,
              artist,
              artwork: artwork || (item && item.artwork),
              sources,
          }
        : null;
}

module.exports = {
    platform: PLATFORM,
    appVersion: '>=0.0',
    version: '1.1.0',
    srcUrl: 'http://23.254.235.247:6080/yuan/5.js',
    author: 'MusicFree user adapter',
    cacheControl: 'no-cache',
    primaryKey: [
        'id',
        'rid',
        'contentId',
        'copyrightId',
        'resourceType',
        'lyricUrls',
    ],
    supportedSearchType: ['music', 'lyric'],
    defaultSearchType: 'music',
    description: '咪咕独立音源。搜索、榜单、歌词与播放使用咪咕公开免登录接口。',
    search,
    getMediaSource,
    getMusicVideo,
    getMusicInfo,
    getLyric,
    getTopLists,
    getTopListDetail,
};
