/* QingMusic QQ Music source for MusicFree. */
const axios = require('axios');

const PLATFORM = '轻QQ';
const SOURCE = 'tx';
const MUSIC_SERVER = 'https://musicserver.haitangw.cc/v1/music/resolve-url';
const PAGE_SIZE = 30;
const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const SEARCH_TYPES = {music: 0, artist: 1, album: 2, sheet: 3, lyric: 7};
const SEARCH_KEYS = {
    music: 'song',
    artist: 'singer',
    album: 'album',
    sheet: 'songlist',
    lyric: 'song',
};
const QUALITY_LEVELS = {
    low: 'standard',
    standard: 'exhigh',
    high: 'lossless',
    super: 'lossless',
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
        .replace(/&#38;/g, '&')
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

function names(values) {
    return [
        ...new Set((values || []).map(row => row && row.name).filter(Boolean)),
    ].join('、');
}

function nativeId(item, type, field) {
    if (field && item && item[field]) return String(item[field]);
    if (item && item.rid) return String(item.rid);
    const value = String((item && item.id) || '');
    const prefix = type + ':';
    if (!value.startsWith(prefix))
        throw new Error('QQ音乐' + type + '标识无效');
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
    const file = (row && row.file) || {};
    const result = {};
    const low = file.size_128mp3 || row.size128;
    const standard = file.size_320mp3 || row.size320;
    const high = file.size_flac || row.sizeflac;
    const superSize = file.size_hires;
    if (low) result.low = {size: low};
    if (standard) result.standard = {size: standard};
    if (high) result.high = {size: high};
    if (superSize) result.super = {size: superSize};
    return result;
}

function music(row) {
    if (row && row.songInfo) row = row.songInfo;
    if (row && row.data) row = row.data;
    if (!row) return null;
    const songMid = String(row.mid || row.songmid || row.strMediaMid || '');
    const rid = String(row.id || row.songid || songMid);
    const title = cleanText(row.name || row.title || row.songname);
    if (!songMid || !title) return null;
    const albumData = row.album || {};
    const albumMid = row.albummid || albumData.mid || '';
    return {
        id: 'music:' + songMid,
        platform: PLATFORM,
        rid: songMid,
        songId: rid,
        songMid,
        mvVid: String((row.mv && row.mv.vid) || row.vid || row.mvvid || ''),
        title,
        artist: names(row.singer) || '未知歌手',
        album:
            cleanText(row.albumname || albumData.name || albumData.title) ||
            '未知专辑',
        artwork: albumMid
            ? 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' +
              albumMid +
              '.jpg'
            : '',
        duration: number(row.interval, 0),
        qualities: qualities(row),
    };
}

function album(row) {
    if (!row) return null;
    const albumMid = String(
        row.albumMID || row.albumMid || row.album_mid || row.mid || '',
    );
    const rid = String(row.albumID || row.albumid || row.id || albumMid);
    const title = cleanText(
        row.albumName || row.album_name || row.name || row.title,
    );
    if (!albumMid || !title) return null;
    return {
        id: 'album:' + albumMid,
        platform: PLATFORM,
        rid: albumMid,
        albumId: rid,
        albumMid,
        title,
        artwork:
            imageUrl(row.albumPic) ||
            'https://y.gtimg.cn/music/photo_new/T002R300x300M000' +
                albumMid +
                '.jpg',
        date: cleanText(row.publicTime || row.pub_time || row.time_public),
        artist: cleanText(
            row.singerName || row.singer_name || names(row.singer_list),
        ),
        description: cleanText(row.desc),
        worksNum: number(row.song_count || row.songnum, 0),
    };
}

function artist(row) {
    if (!row) return null;
    const singerMid = String(
        row.singerMID || row.singerMid || row.singer_mid || row.mid || '',
    );
    const rid = String(row.singerID || row.singerid || row.id || singerMid);
    const name = cleanText(row.singerName || row.singer_name || row.name);
    if (!singerMid || !name) return null;
    return {
        id: 'artist:' + singerMid,
        platform: PLATFORM,
        rid: singerMid,
        singerId: rid,
        singerMid,
        name,
        avatar: imageUrl(row.singerPic || row.pic),
        worksNum: number(row.songNum || row.songnum, 0),
    };
}

function sheet(row, type) {
    if (!row) return null;
    const entityType = type || 'sheet';
    const rid = String(row.dissid || row.topID || row.id || '');
    const title = cleanText(
        row.dissname || row.topTitle || row.ListName || row.title,
    );
    if (!rid || !title) return null;
    return {
        id: entityType + ':' + rid,
        platform: PLATFORM,
        rid,
        title,
        artwork: imageUrl(row.imgurl || row.picUrl || row.pic_v12 || row.pic),
        artist: cleanText(row.creator && row.creator.name),
        description: cleanText(row.introduction || row.info),
        worksNum: number(row.song_count || row.total_song_num, 0),
    };
}

function safeJson(value) {
    if (value && typeof value === 'object') return value;
    const text = String(value || '')
        .trim()
        .replace(/^(?:callback|MusicJsonCallback|jsonCallback)\(/, '')
        .replace(/\)\s*;?$/, '');
    try {
        return JSON.parse(text);
    } catch (_) {
        throw new Error('QQ音乐响应不是有效 JSON');
    }
}

async function request(config) {
    const response = await axios({
        timeout: 12000,
        ...config,
        headers: {
            Referer: 'https://y.qq.com/',
            'User-Agent': USER_AGENT,
            ...(config.headers || {}),
        },
    });
    const data = safeJson(response && response.data);
    if (data.code !== undefined && data.code !== 0)
        throw new Error(data.message || 'QQ音乐接口返回异常');
    return data;
}

async function musicu(payload) {
    return request({
        method: 'POST',
        url: 'https://u.y.qq.com/cgi-bin/musicu.fcg',
        data: payload,
        headers: {'Content-Type': 'application/json'},
    });
}

async function search(query, page, type) {
    const searchType = type || 'music';
    if (SEARCH_TYPES[searchType] === undefined) return {isEnd: true, data: []};
    const currentPage = pageNumber(page);
    const data = await musicu({
        req_1: {
            method: 'DoSearchForQQMusicDesktop',
            module: 'music.search.SearchCgiService',
            param: {
                num_per_page: PAGE_SIZE,
                page_num: currentPage,
                query,
                search_type: SEARCH_TYPES[searchType],
            },
        },
    });
    const body = (data.req_1 && data.req_1.data) || {};
    if (body.code !== undefined && body.code !== 0)
        throw new Error('QQ音乐搜索失败');
    const container = body.body && body.body[SEARCH_KEYS[searchType]];
    const rows = (container && container.list) || [];
    const convert =
        searchType === 'album'
            ? album
            : searchType === 'artist'
            ? artist
            : searchType === 'sheet'
            ? row => sheet(row, 'sheet')
            : music;
    const converted = rows
        .map(row => {
            const item = convert(row);
            if (item && searchType === 'lyric') {
                item.rawLrcTxt = cleanText(row.lyric || row.content || '');
            }
            return item;
        })
        .filter(Boolean);
    const total = number(
        (container && container.meta && container.meta.sum) ||
            (body.meta && body.meta.sum),
        rows.length,
    );
    return {
        isEnd: total
            ? currentPage * PAGE_SIZE >= total
            : rows.length < PAGE_SIZE,
        data: converted,
    };
}

async function songDetail(item) {
    const songMid = nativeId(item, 'music', 'songMid');
    const data = await musicu({
        songinfo: {
            module: 'music.pf_song_detail_svr',
            method: 'get_song_detail_yqq',
            param: {song_mid: songMid},
        },
        comm: {ct: 24, cv: 0},
    });
    return (
        data.songinfo &&
        data.songinfo.data &&
        (data.songinfo.data.track_info || data.songinfo.data)
    );
}

async function getMusicInfo(item) {
    const detail = music(await songDetail(item));
    if (!detail) return null;
    return compact({
        title: detail.title,
        artist: detail.artist,
        album: detail.album,
        artwork: detail.artwork,
        duration: detail.duration,
        qualities: detail.qualities,
        songId: detail.songId,
        songMid: detail.songMid,
        mvVid: detail.mvVid,
    });
}

async function getMusicVideo(item) {
    const detail = await songDetail(item);
    const vid = String(
        (item && item.mvVid) ||
            (detail && detail.mv && detail.mv.vid) ||
            (detail && (detail.vid || detail.mvvid)) ||
            '',
    );
    if (!vid) return null;

    const data = await musicu({
        mvinfo: {
            module: 'gosrf.Stream.MvUrlProxy',
            method: 'GetMvUrls',
            param: {
                vids: [vid],
                request_type: 10001,
                addrtype: 3,
                format: 264,
            },
        },
        comm: {ct: 24, cv: 0},
    });
    const mvData =
        data.mvinfo && data.mvinfo.data && data.mvinfo.data[vid];
    const heightMap = {10: 360, 20: 480, 30: 720, 40: 1080, 50: 2160};
    const sources = ((mvData && mvData.mp4) || [])
        .map(row => {
            const urls = row.freeflow_url || row.url || row.comm_url || [];
            const url = (Array.isArray(urls) ? urls : [urls]).find(value =>
                /^https?:\/\//i.test(String(value || '')),
            );
            const height = heightMap[number(row.filetype, 0)];
            return url && height
                ? {
                      quality: height + 'p',
                      height,
                      url,
                      headers: {
                          Referer: 'https://y.qq.com/',
                          'User-Agent': USER_AGENT,
                      },
                      mimeType: 'video/mp4',
                  }
                : null;
        })
        .filter(Boolean);
    return sources.length
        ? {
              id: vid,
              title: item && item.title,
              artist: item && item.artist,
              artwork: item && item.artwork,
              sources,
          }
        : null;
}

async function getLyric(item) {
    const data = await request({
        method: 'GET',
        url: 'https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg',
        params: {
            g_tk: 5381,
            format: 'json',
            inCharset: 'utf-8',
            outCharset: 'utf-8',
            notice: 0,
            platform: 'h5',
            needNewCode: 1,
            nobase64: 1,
            songmid: nativeId(item, 'music', 'songMid'),
        },
    });
    return data.lyric ? {rawLrc: data.lyric, translation: data.trans} : null;
}

async function getAlbumInfo(item, page) {
    const currentPage = pageNumber(page);
    const data = await musicu({
        comm: {ct: 24, cv: 10000},
        albumSonglist: {
            method: 'GetAlbumSongList',
            module: 'music.musichallAlbum.AlbumSongList',
            param: {
                albumMid: nativeId(item, 'album', 'albumMid'),
                albumID: 0,
                begin: (currentPage - 1) * PAGE_SIZE,
                num: PAGE_SIZE,
                order: 2,
            },
        },
    });
    const body = data.albumSonglist && data.albumSonglist.data;
    if (!body) throw new Error('QQ音乐专辑详情为空');
    const rows = body.songList || [];
    return {
        isEnd: currentPage * PAGE_SIZE >= number(body.totalNum, rows.length),
        albumItem:
            currentPage === 1
                ? {...item, rid: nativeId(item, 'album', 'albumMid')}
                : undefined,
        musicList: rows.map(music).filter(Boolean),
    };
}

async function getArtistWorks(item, page, type) {
    const currentPage = pageNumber(page);
    const singerMid = nativeId(item, 'artist', 'singerMid');
    if (type === 'album') {
        const data = await musicu({
            singerAlbum: {
                method: 'get_singer_album',
                module: 'music.web_singer_info_svr',
                param: {
                    singermid: singerMid,
                    order: 'time',
                    begin: (currentPage - 1) * PAGE_SIZE,
                    num: PAGE_SIZE,
                    exstatus: 1,
                },
            },
            comm: {ct: 24, cv: 0},
        });
        const body = data.singerAlbum && data.singerAlbum.data;
        const rows = (body && body.list) || [];
        return {
            isEnd:
                currentPage * PAGE_SIZE >=
                number(body && body.total, rows.length),
            data: rows.map(album).filter(Boolean),
        };
    }
    if (type !== 'music') return {isEnd: true, data: []};
    const data = await musicu({
        singer: {
            method: 'get_singer_detail_info',
            module: 'music.web_singer_info_svr',
            param: {
                sort: 5,
                singermid: singerMid,
                sin: (currentPage - 1) * PAGE_SIZE,
                num: PAGE_SIZE,
            },
        },
        comm: {ct: 24, cv: 0},
    });
    const body = data.singer && data.singer.data;
    const rows = (body && body.songlist) || [];
    return {
        isEnd:
            currentPage * PAGE_SIZE >=
            number(body && body.total_song, rows.length),
        data: rows.map(music).filter(Boolean),
    };
}

async function playlistPage(item, page) {
    const currentPage = pageNumber(page);
    const data = await request({
        method: 'GET',
        url: 'https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg',
        params: {
            type: 1,
            utf8: 1,
            disstid: nativeId(item, 'sheet'),
            loginUin: 0,
            format: 'json',
        },
    });
    const detail = data.cdlist && data.cdlist[0];
    if (!detail) throw new Error('QQ音乐歌单详情为空');
    const rows = detail.songlist || [];
    const start = (currentPage - 1) * PAGE_SIZE;
    const result = {
        isEnd: start + PAGE_SIZE >= rows.length,
        musicList: rows
            .slice(start, start + PAGE_SIZE)
            .map(music)
            .filter(Boolean),
    };
    if (currentPage === 1)
        result.sheetItem = sheet(
            {
                ...detail,
                dissid: nativeId(item, 'sheet'),
                dissname: detail.dissname,
                imgurl: detail.logo,
                introduction: detail.desc,
                song_count: rows.length,
            },
            'sheet',
        );
    return result;
}

function getMusicSheetInfo(item, page) {
    return playlistPage(item, page);
}

async function getTopLists() {
    const data = await request({
        method: 'GET',
        url: 'https://c.y.qq.com/v8/fcg-bin/fcg_myqq_toplist.fcg',
        params: {
            format: 'json',
            g_tk: 5381,
            uin: 0,
            inCharset: 'utf-8',
            outCharset: 'utf-8',
            notice: 0,
            platform: 'h5',
            needNewCode: 1,
        },
    });
    const rows = (data.data && data.data.topList) || [];
    return [
        {
            title: 'QQ音乐榜单',
            data: rows.map(row => sheet(row, 'top')).filter(Boolean),
        },
    ];
}

async function getTopListDetail(item, page) {
    const currentPage = pageNumber(page);
    const data = await request({
        method: 'GET',
        url: 'https://c.y.qq.com/v8/fcg-bin/fcg_v8_toplist_cp.fcg',
        params: {
            format: 'json',
            topid: nativeId(item, 'top'),
            song_begin: (currentPage - 1) * PAGE_SIZE,
            song_num: PAGE_SIZE,
            g_tk: 5381,
            uin: 0,
            inCharset: 'utf-8',
            outCharset: 'utf-8',
            notice: 0,
            platform: 'h5',
            needNewCode: 1,
        },
    });
    const rows = data.songlist || [];
    const result = {
        isEnd:
            currentPage * PAGE_SIZE >= number(data.total_song_num, rows.length),
        musicList: rows.map(music).filter(Boolean),
    };
    if (currentPage === 1 && data.topinfo)
        result.topListItem = sheet(
            {...data.topinfo, id: nativeId(item, 'top')},
            'top',
        );
    return result;
}

async function getRecommendSheetTags() {
    const data = await request({
        method: 'GET',
        url: 'https://c.y.qq.com/splcloud/fcgi-bin/fcg_get_diss_tag_conf.fcg',
        params: {
            format: 'json',
            g_tk: 5381,
            uin: 0,
            inCharset: 'utf-8',
            outCharset: 'utf-8',
            notice: 0,
            platform: 'yqq.json',
            needNewCode: 0,
        },
    });
    const groups = (data.data && data.data.categories) || [];
    const convert = row => ({
        id: 'tag:' + row.categoryId,
        platform: PLATFORM,
        rid: String(row.categoryId),
        title: cleanText(row.categoryName),
    });
    return {
        pinned: groups
            .flatMap(group => group.items || [])
            .slice(0, 8)
            .map(convert),
        data: groups.map(group => ({
            title: cleanText(group.categoryGroupName),
            data: (group.items || []).map(convert),
        })),
    };
}

async function getRecommendSheetsByTag(tag, page) {
    const currentPage = pageNumber(page);
    const start = (currentPage - 1) * PAGE_SIZE;
    const data = await request({
        method: 'GET',
        url: 'https://c.y.qq.com/splcloud/fcgi-bin/fcg_get_diss_by_tag.fcg',
        params: {
            format: 'json',
            categoryId: nativeId(tag, 'tag'),
            sortId: 3,
            sin: start,
            ein: start + PAGE_SIZE - 1,
            g_tk: 5381,
            uin: 0,
            inCharset: 'utf-8',
            outCharset: 'utf-8',
            notice: 0,
            platform: 'yqq.json',
            needNewCode: 0,
        },
    });
    const body = data.data || {};
    const rows = body.list || [];
    return {
        isEnd: start + rows.length >= number(body.sum, rows.length),
        data: rows.map(row => sheet(row, 'sheet')).filter(Boolean),
    };
}

async function getMediaSource(item, quality) {
    const order = ['low', 'standard', 'high', 'super'];
    const index = Math.max(0, order.indexOf(quality || 'standard'));
    const levels = order
        .slice(0, index + 1)
        .reverse()
        .map(key => QUALITY_LEVELS[key])
        .filter((value, offset, values) => values.indexOf(value) === offset);
    let lastError;
    for (const level of levels) {
        try {
            const data = await request({
                method: 'POST',
                url: MUSIC_SERVER,
                data: {
                    source: SOURCE,
                    rid: nativeId(item, 'music', 'songMid'),
                    level,
                },
                headers: {'Content-Type': 'application/json'},
            });
            const result = data.data || {};
            if (data.code !== 0 || !result.url)
                throw new Error(data.message || 'QQ音乐播放解析失败');
            return {
                url: result.url,
                headers: result.playbackHeaders || result.headers || {},
            };
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError || new Error('QQ音乐播放解析失败');
}

module.exports = {
    platform: PLATFORM,
    appVersion: '>=0.0',
    version: '1.1.0',
    srcUrl: 'http://23.254.235.247:6080/yuan/1.js',
    author: 'MusicFree user adapter',
    cacheControl: 'no-cache',
    primaryKey: [
        'id',
        'rid',
        'songId',
        'songMid',
        'mvVid',
        'albumId',
        'albumMid',
        'singerId',
        'singerMid',
    ],
    supportedSearchType: ['music', 'album', 'artist', 'sheet', 'lyric'],
    defaultSearchType: 'music',
    description:
        'QQ音乐独立音源。目录使用 QQ 音乐公开接口，播放依赖 QingMusic 解析服务。',
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
