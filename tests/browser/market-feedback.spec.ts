import { test, expect, type Page } from '@playwright/test';
import { createSeed } from '../../src/seed';
import { addMarketExamples } from '../../src/market/model';
import { startConversation, sendChat } from '../../src/messaging/model';
import { mkdir } from 'node:fs/promises';

async function setup(page:Page, path='/messages') {
  let state={...addMarketExamples(createSeed()),loggedIn:true};
  state=startConversation(state,state.topics.find(t=>t.id==='market-demo-0')!);
  state=sendChat(state,'market-demo-0','你好，物品还在，可以继续询问。','seller-message',true);
  state.conversations![0].readAt=0;
  await page.goto('/forum');
  await page.evaluate(s=>localStorage.setItem('sustlink.forum.v1',JSON.stringify(s)),state);
  await page.goto(path);
  await page.evaluate(()=>document.fonts.ready);
}

test('reading notices and chats clears the bell; all-read also covers private chats and persists',async({page})=>{
  await setup(page);
  const dot=page.locator('.notification-link i');
  await expect(dot).toBeVisible();
  for(const tab of ['replies','system']) {
    await page.goto('/messages?tab='+tab);
    while(await page.locator('.notice-row.unread').count()) {
      await page.locator('.notice-row.unread').first().click();
      await page.goto('/messages?tab='+tab);
    }
  }
  await page.goto('/messages');
  // Only the private chat remains unread; the all-read action must stay enabled.
  await expect(page.locator('.notification-link')).toHaveAccessibleName('消息，1 条未读');
  await expect(page.getByRole('button',{name:'全部已读'})).toBeEnabled();
  await page.locator('.conversation-list > a').click();
  await expect(dot).toHaveCount(0);
  await page.reload();
  await expect(dot).toHaveCount(0);
  await setup(page);
  await page.getByRole('button',{name:'全部已读'}).click();
  await expect(dot).toHaveCount(0);
  await expect(page.locator('.notice-row.unread, .message-unread')).toHaveCount(0);
  await page.reload();
  await expect(dot).toHaveCount(0);
  await expect(page.getByRole('button',{name:'全部已读'})).toBeDisabled();
});

test('wanted list uses text rows while an uploaded photo still opens in the detail',async({page})=>{
  await setup(page,'/new?board=market');
  await page.getByRole('button',{name:'求购',exact:true}).click();
  await page.locator('#topic-title').fill('求购一台科学计算器');
  await page.locator('#pub-body').fill('需要考试用的科学计算器，按键完好即可。');
  await page.locator('#pub-category').click();
  await page.getByRole('option',{name:'数码电子',exact:true}).click();
  await page.locator('#pub-budget').fill('80');
  await page.locator('#pub-place').fill('图书馆附近');
  await expect(page.locator('#pub-place')).toHaveCSS('outline-style','none');
  await expect(page.locator('#pub-place')).toHaveCSS('border-color','rgb(108, 159, 189)');
  await page.getByLabel('添加图片或视频',{exact:true}).setInputFiles({
    name:'calculator.png',mimeType:'image/png',
    buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7fQAAAAASUVORK5CYII=','base64'),
  });
  await expect(page.locator('.pub-media-tile')).toHaveCount(1);
  await page.getByRole('button',{name:'发布求购',exact:true}).click();
  await expect(page).toHaveURL(/\/topic\//);
  const detailUrl=page.url();
  await page.goto('/board/market?mode=wanted');
  await expect(page.locator('.market-wanted-list .market-price-row')).toHaveCount(0);
  await expect(page.locator('.market-wanted-list img, .market-wanted-list .market-no-image')).toHaveCount(0);
  await page.getByRole('link',{name:/求购一台科学计算器/}).click();
  await expect(page).toHaveURL(detailUrl);
  await expect(page.locator('.market-detail-price')).toHaveText('预算 ¥80');
  const photo=page.getByRole('button',{name:'放大图片 calculator.png'});
  await expect(photo.locator('img')).toHaveAttribute('src',/^blob:/);
  await photo.click();
  await expect(page.getByRole('dialog',{name:'图片预览 calculator.png'})).toBeVisible();
  await page.goto('/board/market');
  await expect(page.locator('.market-grid .market-photo img').first()).toBeVisible();
});

test('compact messages and wanted rows fit desktop and mobile; mobile category filtering remains available',async({page})=>{
  await setup(page);
  await mkdir('artifacts/market-feedback',{recursive:true});
  for(const width of [1181,421]) {
    await page.setViewportSize({width,height:898});
    await page.goto('/messages');
    await page.screenshot({path:`artifacts/market-feedback/messages-${width}.png`,fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.goto('/board/market?mode=wanted');
    const input=page.getByLabel('搜索商品',{exact:true});
    await input.focus();
    await expect(input).toHaveCSS('outline-style','none');
    await expect(input).toHaveCSS('border-color','rgb(108, 159, 189)');
    expect(await input.evaluate(e=>getComputedStyle(e).boxShadow)).not.toBe('none');
    await page.screenshot({path:`artifacts/market-feedback/wanted-${width}.png`,fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.goto('/forum');
  await expect(page.locator('.left-sidebar')).toBeHidden();
  await page.getByRole('button',{name:/分类/}).click();
  await expect(page.locator('.category-options')).toBeVisible();
  await page.screenshot({path:'artifacts/market-feedback/forum-mobile.png',fullPage:true});
});
