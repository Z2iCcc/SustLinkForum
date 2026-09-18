import {
  Link,
  useLocation,
  useNavigate,
  type LinkProps,
} from "react-router-dom";
import { composeOrigin, profileOriginFrom, listOriginFrom } from "./navigation";

// Capture the scroll position at activation, including clicks on a row's padding.
export function TopicLink({ onClick, ...props }: LinkProps) {
  const location = useLocation(),
    navigate = useNavigate();
  const inherited = profileOriginFrom(location);
  const listInherited = listOriginFrom(location);
  return (
    <Link
      {...props}
      state={
        inherited
          ? { profileOrigin: inherited }
          : listInherited
            ? { listOrigin: listInherited }
            : props.state
      }
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          props.target === "_blank"
        )
          return;
        if (location.pathname === "/profile") {
          event.preventDefault();
          navigate(props.to, {
            state: { profileOrigin: composeOrigin(location) },
          });
        } else if (/^\/(forum|board\/[^/]+|search)$/.test(location.pathname)) {
          event.preventDefault();
          navigate(props.to, {
            state: { listOrigin: composeOrigin(location) },
          });
        }
      }}
    />
  );
}
