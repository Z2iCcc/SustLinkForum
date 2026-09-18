import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { ForumState } from "./types";
import { loadState, persistState } from "./store";
interface ForumContextValue {
  state: ForumState;
  update: (
    fn: (s: ForumState) => ForumState,
    options?: { requirePersistence?: boolean },
  ) => boolean;
  toast: (message: string) => void;
  login: () => void;
  requireLogin: () => boolean;
  storageWarning: string;
}
const ForumContext = createContext<ForumContextValue | null>(null);
export function ForumProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => {
    try {
      return loadState(window.localStorage);
    } catch {
      return loadState();
    }
  });
  const [state, setState] = useState(initial.state);
  const stateRef = useRef(state);
  const [warning, setWarning] = useState(initial.warning);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [message, setMessage] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const toast = useCallback((text: string) => setMessage(text), []);
  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(""), 4200);
    return () => clearTimeout(timeout);
  }, [message]);
  const update = useCallback(
    (
      fn: (s: ForumState) => ForumState,
      options?: { requirePersistence?: boolean },
    ) => {
      try {
        const next = fn(stateRef.current);
        let failure = "";
        try {
          failure = persistState(window.localStorage, next);
        } catch {
          failure = persistState(undefined, next);
        }
        setWarning(failure);
        setWarningDismissed(false);
        if (failure && options?.requirePersistence) {
          toast("删除未保存，原内容仍保留。请检查浏览器存储后重试。");
          return false;
        }
        stateRef.current = next;
        setState(next);
        return true;
      } catch (error) {
        toast(error instanceof Error ? error.message : "操作失败，请重试");
        return false;
      }
    },
    [toast],
  );
  useEffect(() => {
    if (loginOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [loginOpen]);
  function login() {
    setLoginOpen(true);
  }
  function requireLogin() {
    if (stateRef.current.loggedIn) return true;
    login();
    return false;
  }
  return (
    <ForumContext.Provider
      value={{
        state,
        update,
        toast,
        login,
        requireLogin,
        storageWarning: warning,
      }}
    >
      {children}
      {warning && !warningDismissed && (
        <div className="storage-warning" role="alert">
          {warning}
          <button
            aria-label="关闭存储提示"
            onClick={() => setWarningDismissed(true)}
          >
            ×
          </button>
        </div>
      )}
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
      <dialog
        ref={dialog}
        className="login-dialog"
        onCancel={() => setLoginOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setLoginOpen(false);
        }}
        aria-labelledby="login-title"
      >
        <button
          className="dialog-close"
          aria-label="关闭登录"
          onClick={() => setLoginOpen(false)}
        >
          ×
        </button>
        <div className="login-mark">
          S<span>↗</span>
        </div>
        <p className="eyebrow">HELLO, SUSTLINK</p>
        <h2 id="login-title">很高兴，在这里遇见你。</h2>
        <p>以「湖边同学」的身份，开始一次校园交流。</p>
        <div className="demo-note">
          这是演示账号，无需密码或校园认证。内容仅保存在本浏览器，不会发送给其他人。
        </div>
        <button
          className="primary full"
          onClick={() => {
            update((s) => ({ ...s, loggedIn: true }));
            setLoginOpen(false);
            toast("演示登录成功，欢迎回来");
          }}
        >
          使用演示账号
        </button>
        <button
          className="text-button full"
          onClick={() => setLoginOpen(false)}
        >
          先随便逛逛
        </button>
      </dialog>
    </ForumContext.Provider>
  );
}
export function useForum() {
  const c = useContext(ForumContext);
  if (!c) throw new Error("ForumProvider missing");
  return c;
}
