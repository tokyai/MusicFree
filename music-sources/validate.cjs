const path = require("path");

const sourceDirectory = __dirname;
const live = process.argv.includes("--live");

const liveCases = {
    1: { query: "晴天 周杰伦" },
    2: { query: "晴天 周杰伦" },
    3: { query: "晴天 周杰伦" },
    4: {
        item: {
            id: "music:210049",
            rid: "210049",
            platform: "轻网易",
            title: "布拉格广场",
            artist: "周杰伦",
        },
    },
    5: {
        item: {
            id: "music:test",
            rid: "test",
            platform: "轻咪咕",
            title: "动感地带校园新声派常大科教城站——《稻香》",
            artist: "咪咕音乐",
        },
        allowUnavailable: true,
    },
    6: { query: "晴天 周杰伦" },
    7: {
        item: {
            id: "qq:0039MnYb0qxYhV",
            platform: "智QQ",
            title: "晴天",
            artist: "周杰伦",
        },
    },
    8: {
        item: {
            id: "kugou:B3A52A7A958BF0AED0EBFBA2E9A818B7",
            platform: "智酷狗",
            title: "晴天",
            artist: "周杰伦",
        },
    },
    9: {
        item: {
            id: "netease:210049",
            platform: "智网易",
            title: "布拉格广场",
            artist: "周杰伦",
        },
    },
};

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function validateMusicVideoResult(result, fileName) {
    if (result === null) {
        return;
    }
    assert(result && typeof result === "object", `${fileName}: MV 结果必须是对象或 null`);
    assert(typeof result.id === "string" && result.id, `${fileName}: MV id 无效`);
    assert(Array.isArray(result.sources) && result.sources.length, `${fileName}: MV sources 为空`);
    const heights = new Set();
    result.sources.forEach((source, index) => {
        assert(source && typeof source === "object", `${fileName}: source ${index} 无效`);
        assert(/^https?:\/\//i.test(String(source.url || "")), `${fileName}: source ${index} URL 无效`);
        assert(Number.isFinite(source.height) && source.height > 0, `${fileName}: source ${index} 高度无效`);
        assert(!heights.has(source.height), `${fileName}: source ${index} 清晰度重复`);
        heights.add(source.height);
    });
}

async function validateSource(id) {
    const fileName = `${id}.js`;
    const plugin = require(path.join(sourceDirectory, fileName));
    assert(plugin && typeof plugin === "object", `${fileName}: 导出无效`);
    assert(typeof plugin.platform === "string" && plugin.platform, `${fileName}: platform 缺失`);
    assert(typeof plugin.version === "string" && plugin.version, `${fileName}: version 缺失`);
    assert(typeof plugin.search === "function", `${fileName}: search 缺失`);
    assert(typeof plugin.getMediaSource === "function", `${fileName}: getMediaSource 缺失`);
    assert(typeof plugin.getMusicVideo === "function", `${fileName}: getMusicVideo 缺失`);

    if (!live) {
        return `${fileName} ${plugin.platform} ${plugin.version}`;
    }

    const testCase = liveCases[id];
    const item = testCase.item ||
        (await plugin.search(testCase.query, 1, "music")).data[0];
    assert(item, `${fileName}: live 搜索没有结果`);
    const result = await plugin.getMusicVideo(item);
    validateMusicVideoResult(result, fileName);
    if (!result && !testCase.allowUnavailable) {
        throw new Error(`${fileName}: live 样本没有 MV`);
    }
    return result
        ? `${fileName} ${plugin.platform}: ${result.sources
              .map(source => source.quality)
              .join(", ")}`
        : `${fileName} ${plugin.platform}: 当前匿名接口不可用（稳定返回 null）`;
}

(async () => {
    const summaries = [];
    for (let id = 1; id <= 9; id += 1) {
        summaries.push(await validateSource(id));
    }
    summaries.forEach(summary => console.log(summary));
    console.log(live ? "9 个音源 live 校验通过" : "9 个音源导入校验通过");
})().catch(error => {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
});
