import type { ButtonHTMLAttributes } from 'react';
import { Heart, Bookmark, type LucideIcon } from 'lucide-react';
import { useForum } from './context';
import type { Topic } from './types';

type DetailActionProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> & {
  icon: LucideIcon;
  label: string;
};

// One icon-only control for topic and reply actions; labels remain available to
// keyboard/screen-reader users and as hover hints without occupying reading space.
export function DetailAction({ icon: Icon, label, className = '', title, ...props }: DetailActionProps) {
  return <button {...props} type="button" className={`detail-action ${className}`} aria-label={label} title={title ?? label}>
    <Icon size={16} aria-hidden="true" />
  </button>;
}

export function TopicReactions({ topic }: { topic: Topic }) {
  const { state, update, requireLogin } = useForum();
  const liked = state.likes.includes(topic.id), saved = state.saves.includes(topic.id);
  function toggle(key: 'likes' | 'saves') {
    if (!requireLogin()) return;
    update(s => ({ ...s, [key]: s[key].includes(topic.id) ? s[key].filter(id => id !== topic.id) : [...s[key], topic.id] }));
  }
  return <>
    <DetailAction icon={Heart} label={`点赞 ${topic.baseLikes + Number(liked)}`} className={`reaction-like ${liked ? 'is-active' : ''}`} aria-pressed={liked} onClick={() => toggle('likes')} />
    <DetailAction icon={Bookmark} label={saved ? '已收藏' : '收藏'} title={saved ? '取消收藏' : '收藏'} className={`reaction-save ${saved ? 'is-active' : ''}`} aria-pressed={saved} onClick={() => toggle('saves')} />
  </>;
}
