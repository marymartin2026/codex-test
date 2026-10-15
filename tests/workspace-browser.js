// 三栏界面、缩放、历史和层级的端到端检查。使用本地生成的图片，不访问外部服务。
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true});
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'workspace-test-'));
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(process.env.BASE_URL||'http://127.0.0.1:8000');
  assert.equal(await page.locator('#undo').isDisabled(),true);
  await page.locator('#example').click();
  const left=await page.locator('.left-panel').boundingBox(),middle=await page.locator('.canvas-panel').boundingBox(),right=await page.locator('.right-panel').boundingBox();
  assert.ok(left.x+left.width<=middle.x+1&&middle.x+middle.width<=right.x+1);
  assert.ok(middle.width>left.width&&middle.width>right.width,'中栏必须最宽');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),'PC 页面不能无限向下延伸');
  const stageBefore=await page.locator('#preview-stage').boundingBox();
  await page.locator('#materials-panel>summary').click();
  await page.locator('#notes-panel>summary').click();
  await page.locator('.left-panel .panel-scroll').evaluate(el=>el.scrollTop=el.scrollHeight);
  assert.deepEqual(await page.locator('#preview-stage').boundingBox(),stageBefore,'侧栏滚动不能移动中间画布');
  await page.locator('#copy-panel>summary').click();
  assert.equal(await page.locator('[name=title]').isVisible(),false);
  await page.locator('#copy-panel>summary').click();
  await page.locator('[name=title]').fill('工作台撤销测试');
  await page.locator('#undo').click();
  assert.equal(await page.locator('[name=title]').inputValue(),'把春天，装进咖啡里');
  await page.locator('#redo').click();
  assert.equal(await page.locator('#poster-title').textContent(),'工作台撤销测试');
  for(const [value,factor] of [['0.25',.25],['0.5',.5],['0.75',.75],['1',1]]){
   await page.locator('#preview-zoom').selectOption(value);
   const bounds=await page.locator('#poster').boundingBox();
   assert.ok(Math.abs(bounds.width-1080*factor)<1&&Math.abs(bounds.height-1920*factor)<1);
   assert.equal(await page.locator('[name=width]').inputValue(),'1080');
  }
  assert.ok(await page.locator('#preview-stage').evaluate(el=>el.scrollHeight>el.clientHeight));
  // 视图缩放不进入撤销队列，也不能改变实际导出尺寸。
  await page.locator('#undo').click();
  assert.equal(await page.locator('#preview-zoom').inputValue(),'1');
  assert.equal(await page.locator('[name=title]').inputValue(),'把春天，装进咖啡里');
  await page.locator('#redo').click();
  await page.locator('[name=font]').selectOption('serif');
  assert.equal(await page.locator('#poster').getAttribute('data-font'),'serif');
  await page.locator('#undo').click();assert.equal(await page.locator('[name=font]').inputValue(),'auto');
  await page.locator('#redo').click();assert.equal(await page.locator('[name=font]').inputValue(),'serif');
  const downloadEvent=page.waitForEvent('download');await page.locator('#top-export-png').click();
  const dl=await downloadEvent;const file=path.join(dir,'export.png');await dl.saveAs(file);
  const png=await fs.readFile(file);assert.equal(png.readUInt32BE(16),1080);assert.equal(png.readUInt32BE(20),1920);
  await page.locator('#preview-zoom').selectOption('fit');
  const buffers=await page.evaluate(()=>['#ff0000','#0000ff','#00cc44'].map(color=>{const c=document.createElement('canvas');c.width=100;c.height=100;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,100,100);return c.toDataURL().split(',')[1];}));
  async function add(index){await page.locator('#asset-upload').setInputFiles({name:`image-${index}.png`,mimeType:'image/png',buffer:Buffer.from(buffers[index],'base64')});await page.waitForFunction(()=>!document.querySelector('#asset-upload').disabled);}
  await add(0);assert.equal(await page.locator('#selection-panel').isVisible(),true);
  await page.locator('#undo').click();assert.equal(await page.locator('.asset-item').count(),0);
  await page.locator('#redo').click();assert.equal(await page.locator('.asset-item').count(),1);
  for(const id of ['asset-x','asset-y'])await page.locator(`#${id}`).fill('20');
  await page.locator('#asset-size').evaluate(el=>{el.value=20;el.dispatchEvent(new Event('input',{bubbles:true}));});
  await add(1);
  for(const id of ['asset-x','asset-y'])await page.locator(`#${id}`).fill('20');
  await page.locator('#asset-size').evaluate(el=>{el.value=20;el.dispatchEvent(new Event('input',{bubbles:true}));});
  async function pixel(){return page.locator('#poster-canvas').evaluate(el=>[...el.getContext('2d').getImageData(Math.round(el.width*.3),Math.round(el.height*.24),1,1).data]);}
  assert.ok((await pixel())[2]>240);
  await page.locator('.asset-item').filter({hasText:'image-0.png'}).click();
  await page.locator('#asset-front').click();assert.ok((await pixel())[0]>240);
  await page.locator('#undo').click();assert.ok((await pixel())[2]>240);
  await page.locator('#redo').click();assert.ok((await pixel())[0]>240);
  await page.locator('#asset-back').click();assert.ok((await pixel())[2]>240);
  await page.locator('#asset-delete').click();assert.equal(await page.locator('.asset-item').count(),1);
  await page.locator('#undo').click();assert.equal(await page.locator('.asset-item').count(),2);
  // 一次完整拖动只应占一个撤销步骤。
  await page.locator('.asset-item').filter({hasText:'image-1.png'}).click();
  const canvas=page.locator('#poster-canvas'),box=await canvas.boundingBox();
  await page.mouse.move(box.x+box.width*.3,box.y+box.height*.24);await page.mouse.down();
  await page.mouse.move(box.x+box.width*.4,box.y+box.height*.34,{steps:12});await page.mouse.up();
  assert.equal(await page.locator('#asset-x').inputValue(),'30');
  await page.locator('#undo').click();assert.equal(await page.locator('#asset-x').inputValue(),'20');
  await page.locator('#redo').click();assert.equal(await page.locator('#asset-x').inputValue(),'30');
  await canvas.focus();await page.keyboard.press('Control+z');assert.equal(await page.locator('#asset-x').inputValue(),'20');
  await page.keyboard.press('Control+Shift+z');assert.equal(await page.locator('#asset-x').inputValue(),'30');
  await page.locator('#ai-panel>summary').click();
  await page.locator('#background-upload').setInputFiles({name:'green.png',mimeType:'image/png',buffer:Buffer.from(buffers[2],'base64')});
  await page.waitForFunction(()=>!document.querySelector('#background-remove').disabled);
  async function corner(){return page.locator('#poster-canvas').evaluate(el=>[...el.getContext('2d').getImageData(0,0,1,1).data]);}
  assert.deepEqual((await corner()).slice(0,3),[0,204,68]);
  await page.locator('#background-remove').click();
  await page.locator('#undo').click();assert.deepEqual((await corner()).slice(0,3),[0,204,68]);
  await page.locator('#undo').click();assert.equal(await page.locator('#background-remove').isDisabled(),true);
  await page.locator('#redo').click();assert.deepEqual((await corner()).slice(0,3),[0,204,68]);
  // 在撤销后进行新编辑，旧重做分支应被丢弃。
  await page.locator('[name=theme]').fill('新的客户主题');
  assert.equal(await page.locator('#redo').isDisabled(),true);
  if(process.env.WORKSPACE_SCREENSHOT)await page.screenshot({path:process.env.WORKSPACE_SCREENSHOT});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const bar=await page.locator('.topbar').boundingBox(),exportButton=await page.locator('#top-export-png').boundingBox();
  assert.ok(exportButton.y+exportButton.height<=bar.y+bar.height,'手机顶部按钮不得越出工具栏');
  assert.deepEqual(errors,[]);
  console.log('工作台检查通过：PC 三栏与独立滚动、折叠面板、四档缩放、顶部原尺寸导出、字体、上传/删除/拖动/背景/层级撤销重做、新编辑清除重做分支。');
 }finally{await browser.close();await fs.rm(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
