// 第三阶段端到端检查。服务地址由 BASE_URL 指定；不依赖外部图片。
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true});
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'poster-editor-'));
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1100}}),page=await context.newPage();
    const errors=[],uploads=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(request.method()!=='GET')uploads.push(request.url());});
    await page.goto(process.env.BASE_URL||'http://127.0.0.1:8000');
    await page.locator('#example').click();
    const designs=new Set();
    for(const id of ['text-image','top-image','hero-center','product','promotion','commerce','brand','chinese']){
      await page.locator('[name=layout]').selectOption(id);
      designs.add(await page.locator('#poster-canvas').evaluate(el=>el.toDataURL()));
    }
    assert.equal(designs.size,8,'八个商业模板应产生不同的视觉排版');
    await page.locator('[name=layout]').selectOption('text-image');
    assert.equal(await page.locator('#poster').getAttribute('data-layout'),'text-image');
    const fixtures=await page.evaluate(()=>{
      const result={};
      for(const [name,color,w,h] of [['product','#ff0000',80,120],['person','#ee9900',90,150],['logo','#0000ff',120,50],['qr','#ffffff',100,100],['reference','#cc00cc',80,80],['background','#00cc44',120,120]]){
        const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,w,h);
        if(name==='qr'){x.fillStyle='#000';x.fillRect(10,10,20,20);}
        result[name]=c.toDataURL();
      }
      return result;
    });
    async function add(kind){
      await page.locator('#asset-kind').selectOption(kind);
      await page.locator('#asset-upload').setInputFiles({name:`${kind}.png`,mimeType:'image/png',buffer:Buffer.from(fixtures[kind].split(',')[1],'base64')});
      await page.waitForFunction(()=>!document.querySelector('#asset-upload').disabled);
    }
    for(const kind of ['product','person','logo','qr','reference'])await add(kind);
    assert.equal(await page.locator('.asset-item').count(),5);
    await page.locator('.asset-item').filter({hasText:'logo.png'}).click();
    await page.locator('#asset-x').fill('12');await page.locator('#asset-y').fill('8');
    await page.locator('#relayout').click();
    assert.equal(await page.locator('#asset-x').inputValue(),'12');
    assert.equal(await page.locator('#asset-y').inputValue(),'8');
    await page.locator('[name=layout]').selectOption('text-image');
    for(const name of ['reference','qr','logo','person']){
      await page.locator('.asset-item').filter({hasText:`${name}.png`}).click();
      await page.locator('#asset-delete').click();
    }
    await page.locator('.asset-item').first().click();
    await page.locator('#asset-x').fill('10');await page.locator('#asset-y').fill('20');
    const canvas=page.locator('#poster-canvas');await canvas.scrollIntoViewIfNeeded();let box=await canvas.boundingBox();
    await page.mouse.move(box.x+box.width*.2,box.y+box.height*.3);
    await page.mouse.down();await page.mouse.move(box.x+box.width*.3,box.y+box.height*.4,{steps:8});await page.mouse.up();
    assert.ok(Number(await page.locator('#asset-x').inputValue())>=19);
    await page.locator('#asset-size').evaluate(el=>{el.value='25';el.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.equal(await page.locator('#asset-size').inputValue(),'25');
    await canvas.scrollIntoViewIfNeeded();box=await canvas.boundingBox();
    let x=Number(await page.locator('#asset-x').inputValue())/100,y=Number(await page.locator('#asset-y').inputValue())/100;
    const handleX=box.x+(x+.25)*box.width,handleY=box.y+(y+.25*1080*1.5/1920)*box.height;
    await page.mouse.move(handleX,handleY);await page.mouse.down();await page.mouse.move(handleX+box.width*.05,handleY+box.height*.05,{steps:8});await page.mouse.up();
    assert.ok(Number(await page.locator('#asset-size').inputValue())>25);
    await page.locator('#background-upload').setInputFiles({name:'background.png',mimeType:'image/png',buffer:Buffer.from(fixtures.background.split(',')[1],'base64')});
    await page.waitForFunction(()=>!document.querySelector('#background-remove').disabled);
    assert.ok((await page.locator('#ai-prompt').inputValue()).includes('青柠冷萃'));
    async function exported(format,width,height){
      const pending=page.waitForEvent('download');await page.locator(`#export-${format}`).click();
      const download=await pending,file=path.join(temp,download.suggestedFilename());await download.saveAs(file);
      const bytes=await fs.readFile(file);
      if(format==='png')assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');else assert.equal(bytes.subarray(0,2).toString('hex'),'ffd8');
      const result=await page.evaluate(async({base64,format})=>{
        const blob=await(await fetch(`data:image/${format==='jpg'?'jpeg':'png'};base64,${base64}`)).blob();
        const img=await createImageBitmap(blob),c=document.createElement('canvas');c.width=img.width;c.height=img.height;
        const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
        const x=Number(document.querySelector('#asset-x').value)/100,y=Number(document.querySelector('#asset-y').value)/100,w=Number(document.querySelector('#asset-size').value)/100;
        return {width:img.width,height:img.height,corner:[...ctx.getImageData(0,0,1,1).data],product:[...ctx.getImageData(Math.round((x+w*.5)*img.width),Math.round(y*img.height+w*img.width*1.5*.5),1,1).data]};
      },{base64:bytes.toString('base64'),format});
      assert.equal(result.width,width);assert.equal(result.height,height);
      assert.ok(result.corner[1]>190&&result.corner[0]<15,'上传的绿色背景必须存在于导出图中');
      assert.ok(result.product[0]>240&&result.product[1]<20,'移动缩放后的红色产品必须存在于导出图中');
    }
    await exported('png',1080,1920);
    await page.locator('[name=width]').fill('1200');await page.locator('[name=height]').fill('800');
    await exported('jpg',1200,800);
    await page.locator('#background-remove').click();
    assert.equal(await page.locator('#background-remove').isDisabled(),true);
    await page.locator('[name=width]').fill('9000');
    await page.locator('#export-png').click();
    await page.waitForFunction(()=>document.querySelector('#export-status').textContent.includes('超出图片导出上限'));
    await page.locator('#example').click();
    await page.locator('#asset-upload').setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('invalid image')});
    await page.waitForFunction(()=>document.querySelector('#asset-status').textContent.includes('有效 PNG'));
    assert.equal(await page.locator('.asset-item').count(),1);
    if(process.env.SCREENSHOT_PATH){await page.setViewportSize({width:1440,height:1100});await page.locator('#preview-title').scrollIntoViewIfNeeded();await page.screenshot({path:process.env.SCREENSHOT_PATH});}
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.locator('#asset-delete').click();assert.equal(await page.locator('.asset-item').count(),0);
    assert.deepEqual(errors,[]);assert.deepEqual(uploads,[]);
    console.log('第三阶段浏览器检查通过：五类素材、本地上传、拖动、控件缩放、手柄缩放、删除、背景上传与移除、中文提示词、PNG 1080×1920、JPG 1200×800、导出像素包含背景与产品、超限和损坏文件提示、手机布局；无素材上传网络请求。');
  }finally{await browser.close();await fs.rm(temp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
