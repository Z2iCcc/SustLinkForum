import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  HelpCircle,
  Plus,
  Send,
  X,
  Video,
  FileText,
} from "lucide-react";
import { useForum } from "../context";
import { boards } from "../seed";
import { publishTopic } from "../store";
import { limitTitle, titleLength } from "../format";
import { useAssetUrl } from "../Media";
import { putFiles, validateFile, ACCEPT, formatBytes } from "../media-store";
import type { Attachment, BoardId, Draft } from "../types";
import { bindPublishingControls } from "./controls.js";
import { preserveComposeScroll } from "./preserveScroll";
import {
  publishingFor,
  attachToPublishingDraft,
  publishingErrors,
  reconcilePublishing,
  timeBounds,
  timeValid,
  legacyCategory,
  switchPublishingDraft,
  modes,
  marketCategories,
  lostCategories,
  eventCategories,
  periods,
  type PublishingData,
  type PublishMode,
} from "./model";
import "./controls.css";
import "./publishing.css";

const names: Record<PublishMode, string> = {
  sale: "发布闲置",
  wanted: "发布求购",
  event: "发布活动",
  recruit: "发布招新",
  recap: "发布回顾",
  missing: "发布寻物",
  found: "发布招领",
};
const subtitles: Record<string, string> = {
  market: "把用不到的好物，交给刚好需要的人。",
  clubs: "把时间、地点说清楚，让感兴趣的同学轻松加入。",
  lost: "描述物品和相关线索，让寻找更有方向。",
};
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pub-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
function MediaTile({
  item,
  index,
  cover,
  onRemove,
}: {
  item: Attachment;
  index: number;
  cover: boolean;
  onRemove: () => void;
}) {
  const { url, error } = useAssetUrl(item.id);
  return (
    <div
      className="pub-media-tile"
      title={`${item.name} · ${formatBytes(item.size)}`}
    >
      {item.kind === "image" && url ? (
        <img src={url} alt={item.name} />
      ) : item.kind === "video" ? (
        <Video size={24} />
      ) : (
        <FileText size={24} />
      )}
      <button
        type="button"
        aria-label={`移除第 ${index + 1} 个附件`}
        onClick={onRemove}
      >
        <X size={13} />
      </button>
      {error ? (
        <span className="pub-media-error">请重新上传</span>
      ) : cover ? (
        <span className="pub-cover">封面</span>
      ) : (
        <span className="pub-cover">
          {item.kind === "video" ? "视频" : item.name}
        </span>
      )}
    </div>
  );
}
export function BoardPublisher({
  exit,
  source,
}: {
  exit: () => void;
  source: string;
}) {
  const { state, update, toast, requireLogin, login, storageWarning } =
    useForum();
  const navigate = useNavigate();
  const p = publishingFor(state.draft),
    draft = { ...state.draft, publishing: p };
  const model = useRef(draft);
  model.current = draft;
  const root = useRef<HTMLFormElement>(null),
    upload = useRef<HTMLInputElement>(null),
    composing = useRef(false),
    busyRef = useRef(false);
  const [busy, setBusy] = useState(false),
    [submitted, setSubmitted] = useState(false),
    [uploadError, setUploadError] = useState("");
  const errors = publishingErrors(draft),
    count = titleLength(draft.title);
  useEffect(() => {
    const result = reconcilePublishing(model.current.publishing);
    update((s) => ({
      ...s,
      draft: {
        ...s.draft,
        publishing: result.data,
        categoryId: legacyCategory(result.data),
      },
    }));
    if (result.cleared.length) toast("已清除不一致的时间，请重新选择。");
  }, []);
  useEffect(() => {
    if (!root.current) return;
    return bindPublishingControls(root.current, {
      timeBounds: (id) => timeBounds(model.current.publishing, id),
      timeValid: (id, value) => timeValid(model.current.publishing, id, value),
    });
  }, [p.mode, p.registration]);
  function change(patch: Partial<Draft>, fields: Partial<PublishingData> = {}) {
    const result = reconcilePublishing({
      ...model.current.publishing,
      ...fields,
    });
    update((s) => ({
      ...s,
      draft: {
        ...s.draft,
        ...patch,
        publishing: result.data,
        categoryId: legacyCategory(result.data),
      },
    }));
    if (result.cleared.length) toast("相关时间已清空，请重新选择。");
  }
  const mark = (key: string, required = true) =>
    required ? (
      <b className="pub-required" aria-hidden="true" hidden={!errors[key]}>
        *
      </b>
    ) : (
      <small>选填</small>
    );
  function field(
    key: string,
    label: string,
    {
      required = true,
      type = "text",
      placeholder = "",
      date = false,
      options,
      disabled = false,
    }: {
      required?: boolean;
      type?: string;
      placeholder?: string;
      date?: boolean;
      options?: string[];
      disabled?: boolean;
    } = {},
  ) {
    const value = String((p as unknown as Record<string, unknown>)[key] ?? ""),
      id = "pub-" + key,
      timed = date && key !== "date";
    const needsStart =
      timed &&
      (key === "end" || (key === "deadline" && p.mode === "event")) &&
      !p.start;
    return (
      <div className="pub-field">
        <label id={id + "-label"} htmlFor={id}>
          {label}
          {mark(key, required)}
        </label>
        {options || date ? (
          <>
            <input
              id={id + "-value"}
              type="hidden"
              name={key}
              value={value}
              required={required}
              onInput={(e) => change({}, { [key]: e.currentTarget.value })}
            />
            <button
              id={id}
              type="button"
              className={`field-control ${!value ? "empty-value" : ""}`}
              data-control={options ? "select" : timed ? "datetime" : "date"}
              data-field={id + "-value"}
              data-options={JSON.stringify(options ?? [])}
              data-label={label}
              aria-labelledby={`${id}-label ${id}-text`}
              aria-expanded="false"
              aria-haspopup={options ? "listbox" : "dialog"}
              aria-controls={id + "-popup"}
              disabled={disabled || needsStart}
              aria-invalid={submitted && !!errors[key]}
            >
              <span id={id + "-text"} className="control-value">
                {value
                  ? date
                    ? value.replaceAll("-", " / ").replace("T", " ")
                    : value
                  : needsStart
                    ? "先选择开始时间"
                    : options
                      ? "请选择"
                      : timed
                        ? "选择日期和时间"
                        : "选择日期"}
              </span>
              {options ? (
                <ChevronDown className="control-chevron" size={16} />
              ) : (
                <Calendar size={16} />
              )}
            </button>
          </>
        ) : (
          <input
            className="pub-input"
            id={id}
            name={key}
            type={type}
            value={value}
            required={required}
            disabled={disabled}
            placeholder={placeholder}
            aria-invalid={submitted && !!errors[key]}
            onChange={(e) => change({}, { [key]: e.target.value })}
            step={
              type === "number"
                ? key === "capacity"
                  ? "1"
                  : "0.01"
                : undefined
            }
            min={
              type === "number"
                ? key === "capacity"
                  ? "1"
                  : "0.01"
                : undefined
            }
            maxLength={type === "text" ? 200 : undefined}
          />
        )}
        {submitted && errors[key] && (
          <span className="pub-error">{errors[key]}</span>
        )}
      </div>
    );
  }
  function title(label: string) {
    return (
      <div className="pub-field">
        <label htmlFor="topic-title">
          {label}
          {mark("title")}
        </label>
        <input
          id="topic-title"
          className="pub-input"
          value={draft.title}
          required
          placeholder="写一个清楚的标题"
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={(e) => {
            composing.current = false;
            change({ title: limitTitle(e.currentTarget.value) });
          }}
          onChange={(e) =>
            change({
              title: composing.current
                ? e.target.value
                : limitTitle(e.target.value),
            })
          }
          aria-describedby="pub-title-count"
          aria-invalid={submitted && !!errors.title}
        />
        <span className="pub-count" id="pub-title-count">
          {count} / 20
        </span>
        {submitted && errors.title && (
          <span className="pub-error">{errors.title}</span>
        )}
      </div>
    );
  }
  function body(label: string) {
    return (
      <div className="pub-field">
        <label htmlFor="pub-body">
          {label}
          {mark("body")}
        </label>
        <textarea
          className="pub-input"
          id="pub-body"
          value={draft.body}
          required
          maxLength={3000}
          onChange={(e) => change({ body: e.target.value })}
          aria-invalid={submitted && !!errors.body}
          placeholder="写下需要补充的具体内容…"
        />
        <span className="pub-count">{draft.body.length} / 3000</span>
        {submitted && errors.body && (
          <span className="pub-error">{errors.body}</span>
        )}
      </div>
    );
  }
  async function addFiles(input: HTMLInputElement) {
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (!files.length || busyRef.current) return;
    if ((draft.attachments?.length ?? 0) + files.length > 9) {
      setUploadError("最多添加 9 个文件，请先移除部分文件。");
      return;
    }
    busyRef.current = true;
    const source = model.current;
    setBusy(true);
    setUploadError("");
    const added: Attachment[] = [];
    try {
      // Validate the full batch before writing any files.
      files.forEach((f) =>
        validateFile(
          f,
          /\.(mp4|webm|og[gv]|mov)$/i.test(f.name) ? "video" : "image",
        ),
      );
      for (const file of files)
        added.push(
          ...(await putFiles(
            [file],
            /\.(mp4|webm|og[gv]|mov)$/i.test(file.name) ? "video" : "image",
          )),
        );
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "文件保存失败，请重试。");
    } finally {
      if (added.length)
        update((s) => attachToPublishingDraft(s, source, added));
      busyRef.current = false;
      setBusy(false);
    }
  }
  function media() {
    const attachments = draft.attachments ?? [],
      cover = attachments.find((a) => a.kind === "image")?.id;
    return (
      <div className="pub-media" aria-busy={busy}>
        <div className="pub-media-row">
          {attachments.map((item, index) => (
            <MediaTile
              key={item.id}
              item={item}
              index={index}
              cover={item.id === cover}
              onRemove={() =>
                change({
                  attachments: attachments.filter((a) => a.id !== item.id),
                })
              }
            />
          ))}
          <button
            className="pub-add-media"
            type="button"
            disabled={busy || !state.loggedIn || attachments.length >= 9}
            onClick={() => upload.current?.click()}
          >
            <Plus size={22} />
            <span>{busy ? "正在保存…" : "添加图片 / 视频"}</span>
          </button>
          <div className="pub-media-side">
            {p.mode === "sale" ? "至少 1 张实物图片" : "图片选填"}
            <br />
            第一张图片作为封面
            <br />
            {attachments.length} / 9
          </div>
        </div>
        <input
          ref={upload}
          type="file"
          className="sr-only"
          accept={ACCEPT.image + "," + ACCEPT.video}
          aria-label="添加图片或视频"
          multiple
          disabled={busy || !state.loggedIn}
          onChange={(e) => void addFiles(e.currentTarget)}
        />
        <p className="pub-upload-limits">图片 ≤ 10 MB　视频 ≤ 100 MB</p>
        {(uploadError || (submitted && errors.media)) && (
          <p className="pub-error" role="alert">
            {uploadError || errors.media}
          </p>
        )}
      </div>
    );
  }
  function switchTo(board: BoardId, mode?: PublishMode) {
    if (busyRef.current) return;
    preserveComposeScroll(() => {
      update((s) => switchPublishingDraft(s, board, mode));
      setSubmitted(false);
      setUploadError("");
    });
  }
  const titleLabel =
    p.board === "market"
      ? p.mode === "sale"
        ? "物品标题"
        : "想找什么"
      : p.board === "lost"
        ? "物品标题"
        : p.mode === "event"
          ? "活动名称"
          : p.mode === "recruit"
            ? "招新标题"
            : "回顾标题";
  const categoryOptions =
    p.board === "market"
      ? marketCategories
      : p.board === "lost"
        ? lostCategories
        : p.mode === "event"
          ? eventCategories
          : p.mode === "recruit"
            ? ["社团招新"]
            : ["活动回顾"];
  const metadata = (
    <div
      className={p.board === "clubs" ? "pub-grid" : "pub-grid pub-title-grid"}
    >
      {p.board === "clubs" ? field("organizer", "主办社团") : title(titleLabel)}
      {field("category", p.board === "clubs" ? "内容类别" : "物品类型", {
        options: categoryOptions,
      })}
    </div>
  );
  return (
    <>
      <button
        type="button"
        className="breadcrumb compose-back"
        onClick={() => {
          if (!busyRef.current) exit();
        }}
        disabled={busy}
      >
        <ArrowLeft size={14} />
        {source}
      </button>
      <section className="content-panel compose-panel publishing-panel">
        <div className="page-heading">
          <h1>{names[p.mode]}</h1>
          <p>{subtitles[p.board]}</p>
        </div>
        <form
          className="publishing-form"
          ref={root}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!requireLogin() || busyRef.current) return;
            setSubmitted(true);
            const error = Object.keys(publishingErrors(model.current))[0];
            if (error) {
              const target = document.getElementById(
                error === "title"
                  ? "topic-title"
                  : error === "media"
                    ? "pub-media-section"
                    : "pub-" + error,
              );
              target?.scrollIntoView({ block: "center", behavior: "smooth" });
              target?.focus({ preventScroll: true });
              return;
            }
            const id = crypto.randomUUID();
            if (
              update((s) =>
                publishTopic(
                  s,
                  {
                    ...s.draft,
                    publishing: model.current.publishing,
                    categoryId: legacyCategory(model.current.publishing),
                  },
                  id,
                ),
              )
            ) {
              toast("内容已发布并保存到本浏览器");
              navigate("/topic/" + id);
            }
          }}
        >
          <div className="pub-top">
            <div className="pub-field pub-board">
              <label id="pub-board-label" htmlFor="pub-board">
                发布到
              </label>
              <input
                type="hidden"
                id="pub-board-value"
                value={boards.find((b) => b.id === p.board)?.name}
                onInput={(e) => {
                  const board = boards.find(
                    (b) => b.name === e.currentTarget.value,
                  );
                  if (board) switchTo(board.id);
                }}
              />
              <button
                id="pub-board"
                type="button"
                className="field-control"
                data-control="select"
                data-field="pub-board-value"
                data-options={JSON.stringify(boards.map((b) => b.name))}
                data-label="发布到"
                aria-labelledby="pub-board-label pub-board-text"
                aria-haspopup="listbox"
                aria-expanded="false"
                aria-controls="pub-board-popup"
                disabled={busy}
              >
                <span id="pub-board-text" className="control-value">
                  {boards.find((b) => b.id === p.board)?.name}
                </span>
                <ChevronDown className="control-chevron" size={16} />
              </button>
            </div>
            <span className="draft-status">
              <Check size={14} />
              {storageWarning ? "草稿暂存本页" : "草稿自动保存"}
            </span>
          </div>
          <div className="pub-mode-row">
            <div className="pub-segmented" role="group" aria-label="发布类型">
              {modes[p.board].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={mode === p.mode}
                  disabled={busy}
                  onClick={() => switchTo(p.board, mode)}
                >
                  {label}
                </button>
              ))}
            </div>
            {Object.keys(errors).length > 0 && (
              <span className="pub-required-note">* 为必填项</span>
            )}
          </div>
          {p.board === "market" && (
            <>
              <fieldset className="market-publish-policy"><legend>留言权限</legend>{(["everyone", "seller"] as const).map(value=><label key={value}><input type="radio" name="publish-comment-policy" checked={(p.commentPolicy??"everyone")===value} onChange={()=>change({}, {commentPolicy:value})}/>{value==="everyone"?"所有人可留言":"仅卖家可留言"}</label>)}</fieldset>
              <Section title={p.mode === "sale" ? "物品照片" : "参考图片"}>
                <div id="pub-media-section" tabIndex={-1}>
                  {media()}
                </div>
              </Section>
              <Section title="物品信息">
                {metadata}
                <div className="pub-price-row">
                  {field(
                    p.mode === "sale" ? "price" : "budget",
                    p.mode === "sale" ? "出售价格（元）" : "预算上限（元）",
                    { type: "number", disabled: p.mode === "sale" && p.free },
                  )}
                  {p.mode === "sale" && (
                    <label className="pub-check">
                      <input
                        type="checkbox"
                        checked={p.free}
                        onChange={(e) => change({}, { free: e.target.checked })}
                      />
                      免费赠送
                    </label>
                  )}
                </div>
                {body(p.mode === "sale" ? "物品描述" : "求购说明")}
              </Section>
              <Section title="交接方式">
                <div className="pub-grid pub-title-grid">
                  {field("place", "交接区域")}
                  {field("handover", "交接方式", {
                    options: ["校内面交", "双方协商"],
                  })}
                </div>
                {p.mode === "sale" && (
                  <label className="pub-check pub-space">
                    <input
                      type="checkbox"
                      checked={p.negotiable}
                      onChange={(e) =>
                        change({}, { negotiable: e.target.checked })
                      }
                    />
                    价格可小议
                  </label>
                )}
              </Section>
            </>
          )}
          {p.board === "clubs" && (
            <>
              <Section
                title={
                  p.mode === "recruit"
                    ? "招新介绍"
                    : p.mode === "recap"
                      ? "回顾信息"
                      : "活动信息"
                }
              >
                {title(titleLabel)}
                <div className="pub-space">{metadata}</div>
              </Section>
              <Section title={p.mode === "recruit" ? "加入安排" : "时间与地点"}>
                <div className="pub-grid pub-time-grid">
                  {p.mode === "recruit" ? (
                    <>
                      {field("deadline", "招新截止", { date: true })}
                      {field("audience", "面向同学", {
                        required: false,
                        placeholder: "例如：不限年级",
                      })}
                    </>
                  ) : (
                    <>
                      {field(
                        "start",
                        p.mode === "event" ? "开始时间" : "活动开始",
                        { date: true },
                      )}
                      {field(
                        "end",
                        p.mode === "event" ? "结束时间" : "活动结束",
                        { date: true },
                      )}
                    </>
                  )}
                </div>
                <div className="pub-space">
                  {field(
                    "place",
                    p.mode === "recruit" ? "招新地点" : "活动地点",
                  )}
                </div>
              </Section>
              {p.mode !== "recap" && (
                <Section title="参与方式">
                  <div className="pub-field">
                    <span className="pub-label">
                      报名方式{mark("registration")}
                    </span>
                    <div
                      className="pub-segmented"
                      role="group"
                      aria-label="报名方式"
                    >
                      {[
                        [
                          "none",
                          p.mode === "recruit" ? "现场加入" : "无需报名",
                        ],
                        ["link", "链接报名"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={p.registration === value}
                          onClick={() => change({}, { registration: value })}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {p.registration === "link" && (
                    <div className="pub-space">
                      {field("url", "报名链接", {
                        type: "url",
                        placeholder: "https://…",
                      })}
                      {p.mode === "event" && (
                        <div className="pub-space">
                          {field("deadline", "报名截止", { date: true })}
                        </div>
                      )}
                    </div>
                  )}
                </Section>
              )}
              <Section title={p.mode === "recap" ? "照片与回顾" : "海报与介绍"}>
                {media()}
                <div className="pub-space">
                  {body(
                    p.mode === "recap"
                      ? "这次活动的记录"
                      : p.mode === "recruit"
                        ? "社团介绍与加入要求"
                        : "活动安排与参与要求",
                  )}
                </div>
                {p.mode === "event" && (
                  <details className="pub-more">
                    <summary>更多设置：人数上限</summary>
                    {field("capacity", "人数上限", {
                      required: false,
                      type: "number",
                      placeholder: "不填则不限",
                    })}
                  </details>
                )}
              </Section>
            </>
          )}
          {p.board === "lost" && (
            <>
              <Section title="物品信息">{metadata}</Section>
              <Section title={p.mode === "found" ? "拾获线索" : "丢失线索"}>
                <div className="pub-grid pub-time-grid">
                  {field("date", p.mode === "found" ? "拾获日期" : "丢失日期", {
                    date: true,
                  })}
                  {field("period", "大致时段", {
                    required: false,
                    options: periods,
                  })}
                </div>
                <div className="pub-space">
                  {field(
                    "place",
                    p.mode === "found" ? "拾获地点" : "可能丢失的地点",
                  )}
                </div>
              </Section>
              <Section title="物品图片">{media()}</Section>
              <Section title="补充说明">
                {body("物品特征与线索")}
                {p.mode === "found" && (
                  <div className="pub-space">
                    {field("custody", "物品暂存位置", {
                      required: false,
                      placeholder: "例如：图书馆一楼服务台",
                    })}
                  </div>
                )}
              </Section>
            </>
          )}
          {submitted && Object.keys(errors).length > 0 && (
            <p className="pub-error" role="alert">
              请完善标记的必填内容后发布。
            </p>
          )}
          <div className="pub-bottom">
            <span className="pub-draft-note">
              <Check size={13} />
              草稿仅自己可见
            </span>
            <div className="pub-actions">
              <span className="help-anchor">
                <button
                  type="button"
                  className="help-button"
                  aria-label="发布内容提示"
                  data-help="请勿发布敏感信息"
                >
                  <HelpCircle size={15} />
                </button>
              </span>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => {
                  update((s) => ({ ...s }));
                  toast(
                    storageWarning
                      ? "草稿暂存本页，请检查浏览器存储"
                      : "草稿已保存",
                  );
                }}
              >
                存为草稿
              </button>
              {state.loggedIn ? (
                <button
                  className="primary"
                  type="submit"
                  disabled={busy || count > 20}
                >
                  <Send size={15} />
                  {names[p.mode]}
                </button>
              ) : (
                <button className="primary" type="button" onClick={login}>
                  演示登录后发布
                </button>
              )}
            </div>
          </div>
        </form>
      </section>
    </>
  );
}
