import type { Attachment } from "./types";
export const MEDIA_DB = "sustlink.media.v1";
const STORE = "files";
const MB = 1024 * 1024;
export const ACCEPT = {
  image: "image/jpeg,image/png,image/webp,image/gif,image/avif",
  video: "video/mp4,video/webm,video/ogg,video/quicktime,.mov",
  file: ".zip,.rar,.7z,.doc,.docx,.pdf,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md",
};
const EXTENSIONS = {
  image: /\.(jpe?g|png|webp|gif|avif)$/i,
  video: /\.(mp4|webm|og[gv]|mov)$/i,
  file: /\.(zip|rar|7z|docx?|pdf|xlsx?|pptx?|txt|csv|md)$/i,
};
export function validateFile(
  file: Pick<File, "name" | "size" | "type">,
  kind: Attachment["kind"],
) {
  if (!EXTENSIONS[kind].test(file.name))
    throw new Error(
      `${file.name}：请选择支持的${kind === "image" ? "图片" : kind === "video" ? "视频" : "附件"}格式`,
    );
  if (!file.size) throw new Error(`${file.name} 是空文件`);
  const limit = kind === "image" ? 10 : kind === "video" ? 100 : 30;
  if (file.size > limit * MB)
    throw new Error(`${file.name} 超过 ${limit} MB 上限`);
}
export function formatBytes(size: number) {
  return size < MB
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / MB).toFixed(1)} MB`;
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("浏览器不支持本地文件保存"));
      return;
    }
    const request = indexedDB.open(MEDIA_DB, 1);
    let expired = false;
    const timeout = setTimeout(() => {
      expired = true;
      reject(new Error("本地文件库暂时不可用，请关闭其他旧页面后重试"));
    }, 8000);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => {
      clearTimeout(timeout);
      if (expired) request.result.close();
      else resolve(request.result);
    };
    request.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("无法打开本地文件库，请检查浏览器存储设置"));
    };
    request.onblocked = () => {
      clearTimeout(timeout);
      expired = true;
      reject(new Error("文件库被其他页面占用，请关闭旧页面后重试"));
    };
  });
}
export async function putFiles(
  files: File[],
  kind: Attachment["kind"],
): Promise<Attachment[]> {
  files.forEach((file) => validateFile(file, kind));
  const metadata = files.map((file) => ({
    id: crypto.randomUUID(),
    name: file.name,
    kind,
    mime: file.type || "application/octet-stream",
    size: file.size,
  }));
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const fail = () => {
      db.close();
      reject(
        new Error(
          "文件未保存，浏览器空间不足或存储不可用。请移除较大的文件后重试。",
        ),
      );
    };
    let tx: IDBTransaction | undefined;
    try {
      tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => {
        db.close();
        resolve(metadata);
      };
      tx.onabort = tx.onerror = fail;
      const store = tx.objectStore(STORE);
      metadata.forEach((item, i) => store.put({ id: item.id, blob: files[i] }));
    } catch {
      try {
        tx?.abort();
      } catch {}
      fail();
    }
  });
}
export async function getFile(id: string): Promise<Blob | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly"),
      request = tx.objectStore(STORE).get(id);
    tx.oncomplete = () => {
      db.close();
      resolve(request.result?.blob);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(new Error("无法读取文件"));
    };
  });
}
export async function deleteFile(id: string) {
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(new Error("文件未能删除"));
    };
  });
}
export async function prepareAvatar(file: File): Promise<File> {
  validateFile(file, "image");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("无法读取这张图片，请选择 JPG、PNG 或 WebP 图片");
  });
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器暂不支持头像处理");
    const side = Math.min(bitmap.width, bitmap.height);
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      256,
      256,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("头像处理失败"))),
        "image/webp",
        0.88,
      ),
    );
    return new File([blob], "avatar.webp", { type: "image/webp" });
  } finally {
    bitmap.close();
  }
}
