import Backup, { parseBackupPayload } from "@/core/backup";
import { ResumeMode } from "@/constants/commonConst";
import LanBackup, {
    type ILanBackupServerInfo,
    type ILanBackupTransferResult,
} from "@/native/lanBackup";

export interface ILanBackupSession extends ILanBackupServerInfo {
    transfer: Promise<ILanBackupTransferResult>;
}

export interface ILanBackupError extends Error {
    code?: string;
}

function lanBackupError(
    code: string,
    message: string,
    cause?: unknown,
): ILanBackupError {
    const error = new Error(message) as ILanBackupError & { cause?: unknown };
    error.code = code;
    error.cause = cause;
    return error;
}

function ensureSupported() {
    if (!LanBackup.isSupported) {
        throw lanBackupError(
            "LAN_UNSUPPORTED",
            "当前平台不支持局域网备份",
        );
    }
}

export async function startLanBackup(): Promise<ILanBackupSession> {
    ensureSupported();
    const info = await LanBackup.startServer({
        mode: "backup",
        backupJson: Backup.backup(),
    });
    return {
        ...info,
        transfer: LanBackup.waitForTransfer(),
    };
}

export async function startLanResume(
    resumeMode: ResumeMode = ResumeMode.Append,
): Promise<ILanBackupSession> {
    ensureSupported();
    const info = await LanBackup.startServer({ mode: "restore" });
    const transfer = LanBackup.waitForTransfer().then(async result => {
        if (typeof result.payload !== "string") {
            throw lanBackupError(
                "LAN_INVALID_BACKUP",
                "上传内容中缺少备份数据",
            );
        }

        let payload: ReturnType<typeof parseBackupPayload>;
        try {
            payload = parseBackupPayload(result.payload);
        } catch (error) {
            throw lanBackupError(
                "LAN_INVALID_BACKUP",
                "上传的文件不是有效的 MusicFree 备份",
                error,
            );
        }
        await Backup.resume(payload, resumeMode);
        return result;
    });
    return { ...info, transfer };
}

export function cancelLanBackup() {
    LanBackup.stopServer();
}

const LanBackupService = {
    isSupported: LanBackup.isSupported,
    startBackup: startLanBackup,
    startResume: startLanResume,
    cancel: cancelLanBackup,
};

export default LanBackupService;
