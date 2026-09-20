import type { ForumState, Topic } from '../types.ts';
import { ME } from '../seed.ts';
export interface ChatMessage { id:string; authorId:string; body:string; createdAt:number }
export interface Conversation { topicId:string; sellerId:string; title:string; messages:ChatMessage[]; draft:string; readAt:number }
export function unreadMessageCount(state:ForumState):number {
  return state.notices.filter(n=>!n.read).length + (state.conversations??[]).reduce((sum,c)=>sum+c.messages.filter(m=>m.authorId!==ME&&m.createdAt>c.readAt).length,0);
}
export function markAllMessagesRead(state:ForumState):ForumState {
  const now=Date.now();
  return {...state,notices:state.notices.map(n=>({...n,read:true})),conversations:state.conversations?.map(c=>({...c,readAt:c.messages.reduce((time,m)=>Math.max(time,m.createdAt),Math.max(now,c.readAt))}))};
}
export function validConversations(value:unknown):boolean {
  return value===undefined || (Array.isArray(value)&&value.every(c=>c&&typeof c.topicId==='string'&&typeof c.sellerId==='string'&&typeof c.title==='string'&&typeof c.draft==='string'&&Number.isFinite(c.readAt)&&Array.isArray(c.messages)&&c.messages.every((m:ChatMessage)=>m&&typeof m.id==='string'&&[ME,c.sellerId].includes(m.authorId)&&typeof m.body==='string'&&m.body.trim().length>0&&m.body.length<=3000&&Number.isFinite(m.createdAt))));
}
export function startConversation(state:ForumState,topic:Topic):ForumState {
  if(!state.loggedIn)throw new Error('请先登录');
  if(topic.boardId!=='market'||topic.authorId===ME)throw new Error('无法与自己创建商品会话');
  if(state.conversations?.some(c=>c.topicId===topic.id))return state;
  return {...state,conversations:[...(state.conversations??[]),{topicId:topic.id,sellerId:topic.authorId,title:topic.title,messages:[],draft:'',readAt:Date.now()}]};
}
export function sendChat(state:ForumState,topicId:string,body:string,id:string,simulateSeller=false):ForumState {
  if(!state.loggedIn)throw new Error('请先登录');
  const topic=state.topics.find(t=>t.id===topicId),conversation=state.conversations?.find(c=>c.topicId===topicId);
  if(!conversation||!topic)throw new Error('商品已不可查看，无法发送新消息');
  if(topic.authorId!==conversation.sellerId||conversation.sellerId===ME)throw new Error('会话参与者不匹配');
  if(!body.trim()||body.trim().length>3000)throw new Error('请输入 1–3000 字');
  if(conversation.messages.some(m=>m.id===id))return state;
  const message={id,authorId:simulateSeller?conversation.sellerId:ME,body:body.trim(),createdAt:Date.now()};
  return {...state,conversations:state.conversations!.map(c=>c.topicId===topicId?{...c,messages:[...c.messages,message],draft:simulateSeller?c.draft:'',readAt:Date.now()}:c)};
}
