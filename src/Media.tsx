import { useEffect, useRef, useState } from "react";
import { TopicLink } from "./TopicLink";
import {
  ImagePlus,
  Image as ImageIcon,
  Video,
  Paperclip,
  Download,
  FileText,
  FileArchive,
  X,
  ImageOff,
  Play,
  LoaderCircle,
  Camera,
} from "lucide-react";
import type { Attachment } from "./types";
import {
  ACCEPT,
  formatBytes,
  getFile,
  putFiles,
  prepareAvatar,
} from "./media-store";

export function useAssetUrl(id?: string) {
  const [result, setResult] = useState<{
    id?: string;
    url?: string;
    error?: string;
  }>({});
  useEffect(() => {
    if (!id) {
      setResult({});
      return;
    }
    let live = true,
      url: string | undefined;
    getFile(id)
      .then((blob) => {
        if (!live) return;
        if (!blob) {
          setResult({ id, error: "本地文件已不存在，请重新上传" });
          return;
        }
        url = URL.createObjectURL(blob);
        setResult({ id, url });
      })
      .catch(() => {
        if (live)
          setResult({ id, error: "文件暂时无法读取，请检查浏览器存储" });
      });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  return result.id === id ? result : {};
}
function FileIcon({ name }: { name: string }) {
  return /\.(zip|rar|7z)$/i.test(name) ? (
    <FileArchive size={22} />
  ) : (
    <FileText size={22} />
  );
}
function MediaItem({
  item,
  compact = false,
}: {
  item: Attachment;
  compact?: boolean;
}) {
  const { url, error } = useAssetUrl(item.id);
  const [decodeError, setDecodeError] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  if (compact) {
    return (
      <div className="media-thumb" aria-label={item.name}>
        {item.kind === "image" && url && !decodeError ? (
          <img
            src={url}
            alt=""
            loading="lazy"
            onError={() => setDecodeError(true)}
          />
        ) : item.kind === "video" ? (
          <Play size={24} />
        ) : (
          <ImageOff size={21} />
        )}
      </div>
    );
  }
  if (item.kind === "file")
    return (
      <div className="file-attachment content-hit-area">
        <span className="file-type-icon">
          <FileIcon name={item.name} />
        </span>
        <div>
          <strong title={item.name}>{item.name}</strong>
          <small>
            {item.name.split(".").pop()?.toUpperCase()} ·{" "}
            {formatBytes(item.size)}
            {error ? ` · ${error}` : ""}
          </small>
        </div>
        {url ? (
          <a
            href={url}
            download={item.name}
            className="attachment-download content-hit-link"
            aria-label={`下载 ${item.name}`}
          >
            <Download size={17} />
            <span>下载</span>
          </a>
        ) : (
          <span className="file-status">{error ? "不可用" : "读取中"}</span>
        )}
      </div>
    );
  return (
    <figure className={`media-figure ${item.kind}`}>
      {url && !decodeError ? (
        item.kind === "image" ? (
          <button
            type="button"
            className="image-open"
            aria-label={`放大图片 ${item.name}`}
            onClick={() => dialog.current?.showModal()}
          >
            <img
              src={url}
              alt={item.name}
              loading="lazy"
              onError={() => setDecodeError(true)}
            />
            <span>查看大图</span>
          </button>
        ) : (
          <video
            src={url}
            controls
            preload="metadata"
            playsInline
            aria-label={item.name}
            onError={() => setDecodeError(true)}
          />
        )
      ) : (
        <div className="media-placeholder">
          {error || decodeError ? (
            <>
              <ImageOff size={23} />
              <span>{error ?? "浏览器无法预览此格式，可下载后查看"}</span>
            </>
          ) : (
            <>
              <LoaderCircle size={21} className="busy-spin" />
              <span>正在读取文件</span>
            </>
          )}
        </div>
      )}
      <figcaption>
        <span title={item.name}>{item.name}</span>
        <small>{formatBytes(item.size)}</small>
        {url && (
          <a href={url} download={item.name} aria-label={`下载 ${item.name}`}>
            <Download size={15} />
          </a>
        )}
      </figcaption>
      {item.kind === "image" && (
        <dialog
          className="image-lightbox"
          ref={dialog}
          aria-label={`图片预览 ${item.name}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) dialog.current?.close();
          }}
        >
          <header>
            <span>{item.name}</span>
            <button
              type="button"
              aria-label="关闭图片预览"
              onClick={() => dialog.current?.close()}
            >
              <X size={22} />
            </button>
          </header>
          <img src={url} alt={item.name} />
        </dialog>
      )}
    </figure>
  );
}
export function Attachments({ items = [] }: { items?: Attachment[] }) {
  if (!items.length) return null;
  const visuals = items.filter((i) => i.kind !== "file"),
    files = items.filter((i) => i.kind === "file");
  return (
    <div className="post-attachments">
      {visuals.length > 0 && (
        <div
          className={`media-gallery ${visuals.length === 1 ? "single" : ""}`}
        >
          {visuals.map((item) => (
            <MediaItem item={item} key={item.id} />
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="attachment-files">
          {files.map((item) => (
            <MediaItem item={item} key={item.id} />
          ))}
        </div>
      )}
    </div>
  );
}
export function AttachmentSummary({ items = [] }: { items?: Attachment[] }) {
  if (!items.length) return null;
  const images = items.filter((a) => a.kind === "image"),
    videos = items.filter((a) => a.kind === "video"),
    files = items.filter((a) => a.kind === "file");
  return (
    <div className="topic-media-summary">
      {images.length > 0 && (
        <div className="topic-thumbnails">
          {images.slice(0, 3).map((item) => (
            <MediaItem key={item.id} item={item} compact />
          ))}
        </div>
      )}
      <div className="media-counts">
        {images.length > 0 && (
          <span>
            <ImagePlus size={13} />
            {images.length} 张图片
          </span>
        )}
        {videos.length > 0 && (
          <span>
            <Video size={13} />
            {videos.length} 个视频
          </span>
        )}
        {files.length > 0 && (
          <span>
            <Paperclip size={13} />
            {files.length} 个附件
          </span>
        )}
      </div>
    </div>
  );
}
export function AttachmentIndicators({
  items = [],
  topicId,
}: {
  items?: Attachment[];
  topicId: string;
}) {
  if (!items.length) return null;
  const kinds = (["image", "video", "file"] as const)
    .map((kind) => ({
      kind,
      count: items.filter((item) => item.kind === kind).length,
    }))
    .filter((item) => item.count);
  const description = kinds
    .map(
      ({ kind, count }) =>
        `${count} ${kind === "image" ? "张图片" : kind === "video" ? "个视频" : "个附件"}`,
    )
    .join("、");
  return (
    <TopicLink
      to={`/topic/${topicId}`}
      className="topic-attachment-hints"
      tabIndex={-1}
      title={description}
      aria-label={`含 ${description}，查看主题`}
    >
      {kinds.map(({ kind }) => {
        const Icon =
          kind === "image" ? ImageIcon : kind === "video" ? Video : Paperclip;
        return (
          <Icon key={kind} size={14} strokeWidth={1.7} aria-hidden="true" />
        );
      })}
    </TopicLink>
  );
}
export function UploadPicker({
  items = [],
  onAdd,
  onRemove,
  onBusy,
  disabled = false,
  label = "主题",
}: {
  items?: Attachment[];
  onAdd: (items: Attachment[]) => void;
  onRemove: (id: string) => void;
  onBusy?: (busy: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const busyRef = useRef(false);
  async function choose(input: HTMLInputElement, kind: Attachment["kind"]) {
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (!files.length || busyRef.current) return;
    if (items.length + files.length > 10) {
      setError("每条内容最多添加 10 个文件，请先移除部分文件。");
      return;
    }
    setError("");
    busyRef.current = true;
    setBusy(true);
    onBusy?.(true);
    try {
      onAdd(await putFiles(files, kind));
    } catch (e) {
      setError(e instanceof Error ? e.message : "文件添加失败，请重试");
    } finally {
      busyRef.current = false;
      setBusy(false);
      onBusy?.(false);
    }
  }
  return (
    <div
      className={`upload-picker ${disabled ? "disabled" : ""}`}
      aria-busy={busy}
    >
      <div className="upload-toolbar">
        {(["image", "video", "file"] as const).map((kind, i) => {
          const Icon = [ImagePlus, Video, Paperclip][i];
          const title = ["添加图片", "添加视频", "添加附件"][i];
          return (
            <label
              className="upload-action"
              key={kind}
              aria-disabled={busy || disabled}
            >
              <input
                type="file"
                accept={ACCEPT[kind]}
                multiple
                aria-label={`${label}${title}`}
                disabled={busy || disabled}
                onChange={(e) => void choose(e.currentTarget, kind)}
              />
              <Icon size={17} />
              {title}
            </label>
          );
        })}
        <span>
          {busy ? (
            <>
              <LoaderCircle size={14} className="busy-spin" />
              正在保存文件
            </>
          ) : (
            `${items.length} / 10`
          )}
        </span>
      </div>
      <p className="upload-hint">
        图片 ≤ 10 MB · 视频 ≤ 100 MB · 附件 ≤ 30 MB，支持
        PDF、Word、压缩包等。仅本地保存。
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {items.length > 0 && (
        <div className="upload-list">
          {items.map((item) => (
            <div className="upload-file" key={item.id}>
              {item.kind === "image" ? (
                <MediaItem item={item} compact />
              ) : item.kind === "video" ? (
                <span className="upload-file-icon">
                  <Video size={22} />
                </span>
              ) : (
                <span className="upload-file-icon">
                  <FileIcon name={item.name} />
                </span>
              )}
              <div>
                <strong title={item.name}>{item.name}</strong>
                <small>{formatBytes(item.size)} · 已添加</small>
              </div>
              <button
                type="button"
                aria-label={`移除 ${item.name}`}
                disabled={busy}
                onClick={() => {
                  onRemove(item.id);
                  setError("");
                }}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export function AvatarPicker({
  children,
  onSaved,
}: {
  children: React.ReactNode;
  onSaved: (id: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function select(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = "";
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      const avatar = await prepareAvatar(file);
      const [record] = await putFiles([avatar], "image");
      onSaved(record.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "头像更换失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="avatar-control">
      <button
        type="button"
        className="change-avatar"
        aria-label="更换头像"
        title="点击更换头像"
        disabled={busy}
        onClick={() => ref.current?.click()}
      >
        {children}
        <span className="avatar-camera">
          {busy ? (
            <LoaderCircle size={15} className="busy-spin" />
          ) : (
            <Camera size={15} />
          )}
        </span>
      </button>
      <input
        ref={ref}
        className="visually-hidden"
        type="file"
        aria-label="选择头像图片"
        accept={ACCEPT.image}
        onChange={(e) => void select(e.currentTarget)}
      />
      {error && (
        <span className="avatar-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
