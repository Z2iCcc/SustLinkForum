import type { ForumState, Topic } from '../types.ts';
import { ME } from '../seed.ts';
import { emptyPublishing, legacyCategory } from '../publishing/model.ts';

export interface MarketData {
  commentPolicy?: 'everyone' | 'seller';
  status?: 'active' | 'withdrawn' | 'sold';
  demoImage?: string;
  baseSaves?: number;
}
export function canComment(topic: Topic, userId: string) {
  return topic.boardId !== 'market' || (topic.market?.commentPolicy ?? topic.publishing?.commentPolicy) !== 'seller' || topic.authorId === userId;
}
export function marketPrice(topic: Topic): number | undefined {
  const p = topic.publishing;
  if (!p) return undefined;
  if (p.mode === 'sale' && p.free) return 0;
  const value = p.mode === 'wanted' ? p.budget : p.price;
  return value.trim() && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : undefined;
}
export function priceLabel(topic: Topic) {
  const value = marketPrice(topic);
  if (value === undefined) return '价格待补充';
  return (topic.publishing?.mode === 'wanted' ? '预算 ' : '') + (value === 0 ? '免费' : `¥${value}`);
}
export function setMarketPolicy(state: ForumState, id: string, policy: 'everyone' | 'seller'): ForumState {
  const topic=state.topics.find(t=>t.id===id);
  if (!state.loggedIn || !topic || topic.boardId!=='market' || topic.authorId!==ME) throw new Error('只有卖家可以修改留言权限');
  return {...state,topics:state.topics.map(t=>t.id===id?{...t,market:{...t.market,commentPolicy:policy}}:t)};
}
export function addMarketExamples(state: ForumState): ForumState {
  const samples = [
    ['认真做过笔记的高数教材','book',18,'教材书籍'],['宿舍护眼台灯','lamp',35,'生活用品'],
    ['无线蓝牙耳机','headphones',80,'数码电子'],['入门羽毛球拍','racket',45,'运动器材'],
    ['桌面收纳盒','box',0,'生活用品'],['闲置双肩背包','backpack',28,'服饰配件'],
  ] as const;
  const authors=state.users.filter(u=>u.id!==ME);
  const topics:Topic[]=Array.from({length:24},(_,n)=>{
    const [title,image,price,category]=samples[n%6];
    const p={...emptyPublishing('market'),mode:n>=20?'wanted' as const:'sale' as const,category,price:String(price+n%3*5),budget:String(price+20),free:price===0,place:'未央校区',handover:'校内面交'};
    return {id:`market-demo-${n}`,boardId:'market',authorId:n===6?ME:authors[n%authors.length].id,title:(n>=20?'求购 · ':n>=6?'闲置 · ':'')+title,
      body:'这是用于体验页面的示例商品。物品功能正常，表面有日常使用痕迹，可在公开留言中咨询细节。\n\n交接时间可通过聊一聊协商。示例照片仅用于预览，不代表真实出售。',
      createdAt:Date.now()-n*3600000,updatedAt:Date.now()-n*3600000,views:0,pinned:false,baseLikes:0,
      publishing:p,categoryId:legacyCategory(p),market:{demoImage:`/market-demo/${image}.jpg`,baseSaves:[12,8,23,6,4,9][n%6],commentPolicy:n===1?'seller':'everyone'}};
  });
  return {...state,topics:[...state.topics,...topics.filter(t=>!state.topics.some(old=>old.id===t.id))]};
}
