// 可选浏览器检查：需已有 Playwright 和 Chromium；服务先在 8000 端口启动。
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}),
    headless:true
  });
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'poster-workbench-'));
  try {
    const context = await browser.newContext({permissions:['clipboard-read','clipboard-write'],viewport:{width:1440,height:1100}});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8000');
    assert.equal(await page.locator('#download').isDisabled(), true);
    await page.locator('#example').click();
    assert.match(await page.locator('#poster-title').textContent(), /把春天/);
    await page.locator('[name=title]').fill('实时标题测试');
    assert.equal(await page.locator('#poster-title').textContent(), '实时标题测试');
    await page.locator('[name=subtitle]').fill('实时副标题');
    await page.locator('[name=body]').fill('正文第一行\n正文第二行');
    assert.equal(await page.locator('#poster-body').textContent(), '正文第一行\n正文第二行');
    async function checkRatio(width, height) {
      await page.locator('[name=width]').fill(String(width));
      await page.locator('[name=height]').fill(String(height));
      const bounds = await page.locator('#poster').boundingBox();
      assert.ok(Math.abs((bounds.width / bounds.height) / (width / height) - 1) < .002, '画布应保持输入比例（允许亚像素舍入）');
    }
    await checkRatio(1080,1920);
    await checkRatio(1920,1080);
    await checkRatio(1000,1000);
    const seen = new Set();
    for (let i=0;i<4;i++) {
      seen.add(await page.locator('#poster').getAttribute('data-layout'));
      await page.locator('#relayout').click();
    }
    assert.equal(seen.size,4);
    await page.locator('[name=style]').selectOption('高级质感');
    assert.equal(await page.locator('#poster').getAttribute('data-layout'),'center');
    assert.equal(await page.locator('#poster').getAttribute('data-font'),'serif');
    const small = await page.locator('#poster-title').evaluate(el=>getComputedStyle(el).fontSize);
    await page.locator('[name=style]').selectOption('活力促销');
    assert.notEqual(await page.locator('#poster-title').evaluate(el=>getComputedStyle(el).fontSize),small);
    await page.locator('[name=palette]').selectOption('黑金质感');
    assert.equal(await page.locator('#poster').evaluate(el=>getComputedStyle(el).getPropertyValue('--bg')).then(s=>s.trim()), '#161616');
    await page.locator('#relayout').click();
    await page.locator('#copy-prompt').click();
    await page.waitForFunction(()=>document.querySelector('#status').textContent==='背景图提示词已复制。');
    const prompt = await page.evaluate(()=>navigator.clipboard.readText());
    assert.match(prompt,/仅生成背景/);
    assert.ok(!prompt.includes('## 1.'));
    const plan = await page.locator('#plan').textContent();
    assert.ok(plan.includes(prompt));
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#download').click();
    const download = await downloadPromise;
    const file = path.join(temp,download.suggestedFilename());
    await download.saveAs(file);
    assert.equal(await fs.readFile(file,'utf8'),plan);
    await page.locator('#copy').click();
    await page.waitForFunction(()=>document.querySelector('#status').textContent==='完整方案已复制。');
    assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),plan);
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('denied'))}}));
    await page.locator('#copy-prompt').click();
    await page.locator('#copy-fallback').waitFor({state:'visible'});
    assert.equal(await page.locator('#copy-fallback').inputValue(),prompt);
    await page.locator('[name=theme]').fill('<img src=x onerror="alert(1)">');
    await page.locator('[name=title]').fill('<script>alert(1)</script>');
    assert.equal(await page.locator('#poster script,#plan img').count(),0);
    await page.locator('[name=body]').fill('长文案内容'.repeat(500));
    assert.ok((await page.locator('#preview-warning').textContent()).length>0);
    await page.locator('[name=width]').fill('0');
    assert.equal(await page.locator('#download').isDisabled(),true);
    assert.equal(await page.locator('#canvas-frame').isVisible(),false);
    await page.locator('#example').click();
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await checkRatio(1920,1080);
    await checkRatio(100,20000);
    await checkRatio(20000,100);
    await page.locator('#example').click();
    await page.locator('[name=theme]').fill('');
    assert.equal(await page.locator('#download').isDisabled(),true);
    assert.equal(await page.locator('#copy-prompt').isDisabled(),true);
    assert.deepEqual(errors,[]);
    console.log('浏览器检查通过：实时文字、画布比例、四种版式、风格字号、配色、提示词复制、复制回退、完整复制、Markdown 导出、长文提示、非法输入、移动布局与极端比例。');
  } finally {
    await browser.close();
    await fs.rm(temp,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
