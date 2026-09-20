import { test, expect } from '@playwright/test';
import { createSeed } from '../../src/seed';
import { addMarketExamples } from '../../src/market/model';
import { mkdir } from 'node:fs/promises';

test('shared icon actions persist in forum and market details and seller controls stay aligned', async ({ page }) => {
  await page.goto('/forum');
  await page.evaluate(s=>localStorage.setItem('sustlink.forum.v1',JSON.stringify(s)),{...addMarketExamples(createSeed()),loggedIn:true});
  await mkdir('artifacts/detail-actions',{recursive:true});
  let reactionFill='';
  for (const id of ['topic-2','market-demo-6']) {
    await page.goto('/topic/'+id);
    const like=page.locator('.original-post .reaction-like');
    const save=page.locator('.original-post .reaction-save');
    await expect(like).toHaveText('');
    await expect(save).toHaveText('');
    await like.click();
    await save.click();
    await expect(like).toHaveAttribute('aria-pressed','true');
    await expect(save).toHaveAttribute('aria-pressed','true');
    await expect(like).toHaveCSS('border-width','0px');
    await expect(like).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
    const fill=await like.locator('svg').evaluate(e=>getComputedStyle(e).fill);
    if(reactionFill)expect(fill).toBe(reactionFill);
    reactionFill=fill;
    await page.reload();
    await expect(like).toHaveAttribute('aria-pressed','true');
    await expect(save).toHaveAttribute('aria-pressed','true');
    await page.getByLabel('回复内容',{exact:true}).fill('图标操作测试回复');
    await page.getByRole('button',{name:'发布回复',exact:true}).click();
    const reply=page.locator('.reply-floor').last();
    for(const action of await reply.locator('.detail-action').all())await expect(action).toHaveText('');
    await reply.getByRole('button',{name:'引用回复',exact:true}).click();
    await expect(page.locator('.reply-quote-preview')).toContainText('图标操作测试回复');
    await page.getByRole('button',{name:'取消引用',exact:true}).click();
    await expect(page.locator('.toast')).toBeHidden();
    await page.locator('.original-post .post-actions').first().scrollIntoViewIfNeeded();
    await page.screenshot({path:`artifacts/detail-actions/${id}.png`});
  }
  await expect(page.locator('.market-policy legend')).toHaveCount(0);
  await expect(page.getByRole('group',{name:'留言权限',exact:true})).toBeVisible();
  for(const width of [1468,421]) {
    await page.setViewportSize({width,height:898});
    const controls=page.locator('.market-detail-actions');
    await controls.scrollIntoViewIfNeeded();
    const left=await controls.locator('.detail-reactions').boundingBox();
    const right=await controls.locator('.market-policy').boundingBox();
    expect(left!.y+left!.height/2).toBeCloseTo(right!.y+right!.height/2,0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`artifacts/detail-actions/market-${width}.png`});
  }
  const reply=page.locator('.reply-floor').filter({hasText:'图标操作测试回复'});
  await reply.getByRole('button',{name:'删除',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'是否确认删除回复？'});
  await dialog.getByRole('button',{name:'取消',exact:true}).click();
  await expect(reply).toBeVisible();
  await reply.getByRole('button',{name:'删除',exact:true}).click();
  await dialog.getByRole('button',{name:'确认删除',exact:true}).click();
  await expect(reply).toHaveCount(0);
  await expect(page.locator('.original-post .reaction-like')).toHaveAttribute('aria-pressed','true');
});
