import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { useForum } from "../context";
import { ME } from "../seed";
import type { Topic } from "../types";

export function DirectMessageLink({
  topic,
  userId,
  name,
}: {
  topic: Topic;
  userId: string;
  name: string;
}) {
  const { requireLogin } = useForum();
  if (topic.boardId === "tree" || userId === ME) return null;
  return (
    <Link
      className="author-chat-link"
      to={"/messages/people/" + encodeURIComponent(userId)}
      aria-label={`私聊${name}`}
      title={`私聊${name}`}
      onClick={(event) => {
        if (!requireLogin()) event.preventDefault();
      }}
    >
      <MessageCircle size={14} aria-hidden="true" />
    </Link>
  );
}
