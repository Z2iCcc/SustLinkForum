import {
  Link,
  useLocation,
  useNavigate,
  type LinkProps,
  type Location,
} from "react-router-dom";
import { listOriginFrom } from "../navigation";
import { readingScrollY } from "../scroll";

type ChatOrigin = { kind: "messages" | "topic"; path: string; y: number };
export type ReturnOrigin = {
  path: string;
  key: string;
  y: number;
  index: number;
  state?: unknown;
};

export function captureReturnOrigin(location: Location): ReturnOrigin {
  return {
    path: location.pathname + location.search + location.hash,
    key: location.key,
    y: readingScrollY(),
    index: window.history.state?.idx ?? 0,
    state: location.state,
  };
}

export function SourceLink({ onClick, ...props }: LinkProps) {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <Link
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          (props.target && props.target !== "_self") ||
          event.button !== 0 ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        navigate(props.to, {
          state: {
            ...props.state,
            returnOrigin: captureReturnOrigin(location),
          },
        });
      }}
    />
  );
}

// Entry context belongs to this history entry, never to the shared conversation.
export function ChatEntryLink({
  source,
  onClick,
  ...props
}: LinkProps & { source: ChatOrigin["kind"] }) {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <Link
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          (props.target && props.target !== "_self") ||
          event.button !== 0 ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        const y = readingScrollY();
        const chatOrigin: ChatOrigin = {
          kind: source,
          path: location.pathname + location.search + location.hash,
          y,
        };
        navigate(props.to, {
          state: {
            chatOrigin,
            ...(source === "topic"
              ? { listOrigin: listOriginFrom(location), restoreTopicY: y }
              : {}),
          },
        });
      }}
    />
  );
}

export function chatReturnTarget(location: Location, topicId?: string) {
  const origin = location.state?.chatOrigin as ChatOrigin | undefined;
  if (
    origin &&
    typeof origin.path === "string" &&
    Number.isFinite(origin.y) &&
    origin.y >= 0
  ) {
    if (
      origin.kind === "messages" &&
      /^\/messages([?#].*)?$/.test(origin.path)
    ) {
      return { to: origin.path, state: { restoreScroll: origin.y } };
    }
    if (
      origin.kind === "topic" &&
      topicId &&
      origin.path.split(/[?#]/)[0] === "/topic/" + topicId
    ) {
      return {
        to: origin.path,
        state: {
          restoreScroll: origin.y,
          listOrigin: listOriginFrom(location),
        },
      };
    }
  }
  // A direct URL or missing/deleted source has no reliable parent page.
  return { to: "/messages", state: { restoreScroll: 0 } };
}
