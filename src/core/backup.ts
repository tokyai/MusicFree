/** 备份与恢复 */
/** 歌单、插件 */
import { compare } from "compare-versions";
import PluginManager from "./pluginManager";
import MusicSheet from "@/core/musicSheet";
import { ResumeMode } from "@/constants/commonConst.ts";

/**
 * 结果：一份大的json文件
 * {
 *     musicSheets: [],
 *     plugins: [],
 * }
 */

export interface IBackJson {
    musicSheets: IMusic.IMusicSheetItem[];
    plugins: Array<{ srcUrl: string; version?: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

/**
 * Parse and validate a backup payload before any restore side effects run.
 * The shape intentionally matches the object emitted by backup().
 */
export function parseBackupPayload(raw: unknown): IBackJson {
    let value: unknown = raw;
    if (typeof raw === "string") {
        try {
            value = JSON.parse(raw) as unknown;
        } catch {
            throw new Error("备份文件格式无效");
        }
    }

    if (!isRecord(value)) {
        throw new Error("备份文件结构无效");
    }
    const musicSheets = value.musicSheets;
    const plugins = value.plugins;
    if (!Array.isArray(musicSheets) || !Array.isArray(plugins)) {
        throw new Error("备份文件缺少歌单或插件数据");
    }
    if (
        !plugins.every(plugin => {
            if (!isRecord(plugin) || typeof plugin.srcUrl !== "string") {
                return false;
            }
            return plugin.version === undefined || typeof plugin.version === "string";
        })
    ) {
        throw new Error("备份文件中的插件数据无效");
    }
    if (
        !musicSheets.every(
            musicSheet => isRecord(musicSheet) && typeof musicSheet.id === "string",
        )
    ) {
        throw new Error("备份文件中的歌单数据无效");
    }

    return {
        musicSheets: musicSheets as IMusic.IMusicSheetItem[],
        plugins: plugins as IBackJson["plugins"],
    };
}

function backup() {
    const musicSheets = MusicSheet.backupSheets();
    const plugins = PluginManager.getEnabledPlugins();
    const normalizedPlugins = plugins.map(_ => ({
        srcUrl: _.instance.srcUrl,
        version: _.instance.version,
    }));

    return JSON.stringify({
        musicSheets: musicSheets,
        plugins: normalizedPlugins,
    });
}

async function resume(
    raw: string | Object,
    resumeMode: ResumeMode = ResumeMode.Append,
) {
    const obj = parseBackupPayload(raw);

    const { plugins, musicSheets } = obj ?? {};
    /** 恢复插件 */
    const validPlugins = PluginManager.getEnabledPlugins();
    const resumePlugins = plugins?.map(_ => {
        // 校验是否安装过: 同源且本地版本更高就忽略掉
        if (
            validPlugins.find(
                plugin =>
                    plugin.instance.srcUrl === _.srcUrl &&
                    compare(
                        plugin.instance.version ?? "0.0.0",
                        _.version ?? "0.0.1",
                        ">=",
                    ),
            )
        ) {
            return;
        }
        return PluginManager.installPluginFromUrl(_.srcUrl);
    });

    /** 恢复歌单 */
    const resumeMusicSheets = MusicSheet.resumeSheets(musicSheets, resumeMode);

    return Promise.all([...(resumePlugins ?? []), resumeMusicSheets]);
}

const Backup = {
    backup,
    resume,
};
export default Backup;
