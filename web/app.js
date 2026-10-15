const form = document.querySelector('#brief-form');
const plan = document.querySelector('#plan');
const status = document.querySelector('#status');
const poster = document.querySelector('#poster');
const canvas = document.querySelector('#poster-canvas');
const assets = [];
let background = null;
let selectedId = null;
let nextAssetId = 1;
let loadingImages = 0;
let exporting = false;
const stage = document.querySelector('#preview-stage');
const frame = document.querySelector('#canvas-frame');
let variant = 0;
let currentModel = null;
let currentPlan = '';
let currentPrompt = '';
const readBrief = () => Object.fromEntries(new FormData(form));
// 历史仅保存轻量状态和已解码图片引用，不重复拷贝图片像素。
const history = [];
const imageUrls = new Set();
let historyIndex = -1;
let lastEditKey = '';
let lastEditAt = 0;
function captureState() {
  return {brief:readBrief(),variant,assets:assets.map(asset=>({...asset})),background,selectedId};
}
function stateKey(state) {
  return JSON.stringify({brief:state.brief,variant:state.variant,
    assets:state.assets.map(({image,...rest})=>rest),background:state.background?.url||null});
}
function collectImageUrls() {
  const used = new Set(assets.map(asset=>asset.url));
  if(background)used.add(background.url);
  for(const state of history){for(const asset of state.assets)used.add(asset.url);if(state.background)used.add(state.background.url);}
  for(const url of imageUrls)if(!used.has(url)){URL.revokeObjectURL(url);imageUrls.delete(url);}
}
function syncHistoryButtons() {
  document.querySelector('#undo').disabled=historyIndex<=0||loadingImages>0||!!drag;
  document.querySelector('#redo').disabled=historyIndex>=history.length-1||loadingImages>0||!!drag;
}
function commitHistory(key='') {
  const state=captureState();
  if(historyIndex>=0&&stateKey(state)===stateKey(history[historyIndex])){syncHistoryButtons();return;}
  const now=Date.now();
  const merge=key&&key===lastEditKey&&now-lastEditAt<700&&historyIndex>0&&historyIndex===history.length-1;
  history.splice(historyIndex+1);
  if(merge)history[historyIndex]=state;
  else {history.push(state);if(history.length>51)history.shift();historyIndex=history.length-1;}
  lastEditKey=key;lastEditAt=now;collectImageUrls();syncHistoryButtons();
}
function restoreHistory(direction) {
  const next=historyIndex+direction;
  if(loadingImages||drag||next<0||next>=history.length)return;
  historyIndex=next;const state=history[historyIndex];
  for(const [name,value] of Object.entries(state.brief))form.elements.namedItem(name).value=value;
  variant=state.variant;assets.splice(0,assets.length,...state.assets.map(asset=>({...asset})));
  background=state.background;selectedId=state.selectedId;
  lastEditKey='';render();renderAssetList();syncHistoryButtons();
  document.querySelector('#background-remove').disabled=!background;
  document.querySelector('#background-status').textContent=background?`当前背景：${background.name}`:'使用渐变与几何背景';
  status.textContent=direction<0?'已撤销上一次编辑。':'已重做上一次编辑。';
}


function scene() {
  return {model:currentModel, brief:readBrief(), assets, background:background?.image, selectedId};
}
function fitPreview() {
  if (!currentModel) return;
  const {width,height}=currentModel;
  const zoom=document.querySelector('#preview-zoom').value;
  const autoScale=Math.min(Math.max(1,stage.clientWidth-48)/width,Math.max(1,stage.clientHeight-48)/height);
  const scale=zoom==='fit'?autoScale:Number(zoom);
  frame.style.width=`${width*scale}px`;
  frame.style.height=`${height*scale}px`;
  poster.style.width=`${width*scale}px`;
  poster.style.height=`${height*scale}px`;
  poster.style.transform='none';
  for(const asset of assets) PosterRenderer.constrain(asset,currentModel);
  const dpr=Math.min(window.devicePixelRatio||1,2,4096/(width*scale),4096/(height*scale),Math.sqrt(8000000/(width*height*scale*scale)));
  const result=PosterRenderer.draw(canvas,scene(),{width:Math.max(1,Math.round(width*scale*dpr)),height:Math.max(1,Math.round(height*scale*dpr)),selection:true});
  document.querySelector('#preview-warning').textContent=result.warning;
  for(const [key,text] of Object.entries(result.text)) document.getElementById(`poster-${key}`).textContent=text;
  syncAssetControls();
}
function syncExportButtons() {
  syncHistoryButtons();
  for(const id of ['export-png','export-jpg','top-export-png','top-export-jpg'])document.getElementById(id).disabled=!currentModel||loadingImages>0||exporting;
}

function render() {
  const brief = readBrief();
  currentPlan = '';
  currentPrompt = '';
  for (const id of ['copy', 'copy-prompt', 'download']) document.getElementById(id).disabled = true;
  document.querySelector('#copy-fallback').hidden = true;
  document.querySelector('#copy-label').hidden = true;
  try {
    const model = PosterPlanner.design(brief, variant);
    currentModel = model;
    const [bg, ink, accent] = model.colors;

    poster.style.setProperty('--bg', bg);
    poster.style.setProperty('--ink', ink);
    poster.style.setProperty('--accent', accent);
    poster.style.setProperty('--unit', `${Math.min(model.width, model.height)}px`);
    poster.style.setProperty('--title-size', model.settings.size);
    poster.dataset.layout = model.layout.id;
    poster.dataset.texture = model.settings.texture;
    poster.dataset.font = model.settings.font;
    const fields = {
      title: brief.title.trim() || brief.theme.trim() || '在左侧填写海报主题',
      subtitle: brief.subtitle.trim() || '副标题 · 一句话说明核心价值',
      body: brief.body.trim() || '在左侧输入客户文案\n这里将实时呈现正文排版',
      cta: brief.cta.trim() || '行动引导 · 待客户确认'
    };
    for (const [key, text] of Object.entries(fields)) document.getElementById(`poster-${key}`).textContent = text;
    document.querySelector('#toolbar-info').textContent = `${model.width} × ${model.height} 像素 · ${model.layout.name}`;
    document.querySelector('#canvas-info').textContent = `${model.width} × ${model.height} 像素 · ${model.layout.name} · ${model.style} · ${model.palette}`;
    frame.hidden = false;
    syncExportButtons();
    fitPreview();
    if (!brief.theme.trim()) {
      document.querySelector('#ai-prompt').value = '填写主题后，这里将生成完整中文背景图提示词。';
      plan.textContent = '填写海报主题后，完整方案将自动生成。';
      status.textContent = '可以先调整预览；填写主题后即可复制提示词和导出方案。';
      return;
    }
    currentPlan = PosterPlanner.generate(brief, variant);
    currentPrompt = PosterPlanner.backgroundPrompt(brief, variant);
    plan.textContent = currentPlan;
    document.querySelector('#ai-prompt').value = currentPrompt;
    for (const id of ['copy', 'copy-prompt', 'download']) document.getElementById(id).disabled = false;
    status.textContent = '预览与方案已同步更新。';
  } catch (error) {
    currentModel = null;
    syncExportButtons();
    document.querySelector('#ai-prompt').value = '';
    frame.hidden = true;
    plan.textContent = '';
    document.querySelector('#toolbar-info').textContent = '请填写有效尺寸';
    document.querySelector('#canvas-info').textContent = '请填写有效的画布尺寸';
    syncAssetControls();
    document.querySelector('#preview-warning').textContent = '';
    status.textContent = error.message;
  }
}

document.addEventListener('input', event => {
  if(event.target.form!==form)return;
  if (['style','layout'].includes(event.target.name)) variant = 0;
  render();
  if(event.target.name==='layout')applyLayoutPositions();
  commitHistory(`brief:${event.target.name}`);
});
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
  document.querySelector('#plan-panel').open = true;
  document.querySelector('#plan-details').open = true;
  document.querySelector('#result-title').scrollIntoView({ block: 'start' });
});
document.querySelector('#example').addEventListener('click', () => {
  const example = {width:1080,height:1920,theme:'春日新品咖啡上市',industry:'餐饮美食',style:'清新自然',palette:'自然绿白',title:'把春天，装进咖啡里',subtitle:'春日限定 · 青柠冷萃',body:'清爽青柠香气，搭配醇厚冷萃。\n活动时间、价格与门店信息待客户确认。',cta:'到店发现春日新口味',audience:'年轻上班族；朋友圈与门店电子屏',notes:'为门店 Logo 留出位置；不使用未经确认的优惠信息。'};
  for (const [name,value] of Object.entries(example)) form.elements.namedItem(name).value = value;
  variant = 0;
  render();
  commitHistory();
});
function applyLayoutPositions(){
  if(!currentModel)return;
  for(const asset of assets){if(!['logo','qr'].includes(asset.kind))Object.assign(asset,PosterRenderer.defaultPosition(asset.kind,currentModel));}
  fitPreview();
}
document.querySelector('#relayout').addEventListener('click', () => {
  variant = (variant + 1) % PosterPlanner.layouts.length;
  render();
  applyLayoutPositions();
  commitHistory();
});
async function copyText(text, success) {
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = success;
  } catch {
    document.querySelector('#ai-panel').open=true;
    const fallback = document.querySelector('#copy-fallback');
    fallback.value = text;
    fallback.hidden = false;
    document.querySelector('#copy-label').hidden = false;
    fallback.focus(); fallback.select();
    status.textContent = '浏览器未允许自动复制，请按 Ctrl+C（Mac 按 ⌘C），或长按选中文字复制。';
  }
}
document.querySelector('#copy').addEventListener('click', () => copyText(currentPlan, '完整方案已复制。'));
document.querySelector('#copy-prompt').addEventListener('click', () => copyText(currentPrompt, '背景图提示词已复制。'));
document.querySelector('#download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([currentPlan], {type:'text/markdown;charset=utf-8'}));
  const link = document.createElement('a'); link.href = url; link.download = '海报制作方案.md';
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status.textContent = '已导出当前需求和版式的 Markdown 方案。';
});


// 所有上传均通过本地 Blob URL 解码，不读取远程素材。
async function decodeLocal(file) {
  if(file.size>15*1024*1024)throw new Error('每张图片不能超过 15 MB。');
  const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
  const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
  const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  if(!png&&!jpg&&!webp)throw new Error('请使用有效 PNG、JPG 或 WebP 图片（暂不支持 SVG、GIF）。');
  const url=URL.createObjectURL(file),image=new Image();
  try{
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('图片无法解码，请换一张图片。'));image.src=url;});
    if(!image.naturalWidth||image.naturalWidth*image.naturalHeight>24000000)throw new Error('图片解码后不能超过 2400 万像素，请先缩小原图。');
    imageUrls.add(url);
    return {image,url};
  }catch(error){URL.revokeObjectURL(url);throw error;}
}
const kindNames={product:'产品图',person:'人物图',logo:'Logo',qr:'二维码',reference:'参考素材'};
function renderAssetList(){
  const list=document.querySelector('#asset-list');list.replaceChildren();
  for(const asset of assets){
    const button=document.createElement('button');button.type='button';
    button.className=asset.id===selectedId?'asset-item selected':'asset-item';
    button.textContent=`${kindNames[asset.kind]} · ${asset.name}`;
    button.setAttribute('aria-pressed',String(asset.id===selectedId));
    button.addEventListener('click',()=>{selectedId=asset.id;renderAssetList();fitPreview();});
    list.appendChild(button);
  }
  syncAssetControls();
}
function syncAssetControls(){
  const asset=assets.find(item=>item.id===selectedId);
  document.querySelector('#selection-panel').hidden=!asset;
  document.querySelector('#asset-controls').disabled=!asset||!currentModel;
  document.querySelector('#selected-name').textContent=asset?asset.name:'先上传并选择素材';
  if(asset){
    document.querySelector('#asset-size').value=asset.w*100;
    document.querySelector('#asset-x').value=Math.round(asset.x*100);
    document.querySelector('#asset-y').value=Math.round(asset.y*100);
  }
}
document.querySelector('#asset-upload').addEventListener('change',async event=>{
  const files=Array.from(event.target.files),kind=document.querySelector('#asset-kind').value;
  const messages=[];event.target.disabled=true;loadingImages++;syncExportButtons();
  document.querySelector('#asset-status').textContent='正在本地读取素材…';
  try{
    for(const file of files){
      if(assets.length>=20){messages.push('最多保留 20 张素材，请先删除部分素材。');break;}
      try{
        const loaded=await decodeLocal(file);
        const model=currentModel||PosterPlanner.design({width:1080,height:1920});
        const asset={...loaded,id:nextAssetId++,kind,name:file.name,...PosterRenderer.defaultPosition(kind,model)};
        PosterRenderer.constrain(asset,model);assets.push(asset);selectedId=asset.id;
        messages.push(`${file.name} 已添加`);
      }catch(error){messages.push(`${file.name}：${error.message}`);}
    }
  }finally{
    loadingImages--;syncExportButtons();event.target.disabled=false;event.target.value='';renderAssetList();fitPreview();
    document.querySelector('#asset-status').textContent=messages.join('；');
    commitHistory();
  }
});
for(const [id,prop] of [['asset-size','w'],['asset-x','x'],['asset-y','y']]){
  document.getElementById(id).addEventListener('input',event=>{
    const asset=assets.find(item=>item.id===selectedId),number=Number(event.target.value);
    if(asset&&currentModel&&Number.isFinite(number)){asset[prop]=number/100;PosterRenderer.constrain(asset,currentModel);fitPreview();commitHistory(`asset:${asset.id}:${prop}`);}
  });
}
function deleteSelected(){
  const index=assets.findIndex(item=>item.id===selectedId);
  if(index<0)return;
  assets.splice(index,1);selectedId=null;
  renderAssetList();fitPreview();commitHistory();document.querySelector('#asset-status').textContent='素材已删除。';
}
document.querySelector('#asset-delete').addEventListener('click',deleteSelected);
canvas.tabIndex=0;
canvas.addEventListener('keydown',event=>{if(['Delete','Backspace'].includes(event.key)){event.preventDefault();deleteSelected();}});
let drag=null;
function point(event){const rect=canvas.getBoundingClientRect();return {x:(event.clientX-rect.left)/rect.width*currentModel.width,y:(event.clientY-rect.top)/rect.height*currentModel.height};}
canvas.addEventListener('pointerdown',event=>{
  if(!currentModel||event.button!==0)return;
  const p=point(event),selected=assets.find(item=>item.id===selectedId);
  const radius=14*currentModel.width/canvas.getBoundingClientRect().width;
  if(selected){
    const b=PosterRenderer.assetBox(selected,currentModel);
    if(Math.hypot(p.x-b.x-b.w,p.y-b.y-b.h)<radius)drag={id:selected.id,mode:'resize',start:p,x:selected.x,y:selected.y,w:selected.w};
  }
  if(!drag){
    const hit=[...assets].reverse().find(asset=>{const b=PosterRenderer.assetBox(asset,currentModel);return p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;});
    selectedId=hit?.id||null;
    if(hit)drag={id:hit.id,mode:'move',start:p,x:hit.x,y:hit.y,w:hit.w};
  }
  canvas.focus();canvas.setPointerCapture(event.pointerId);renderAssetList();fitPreview();event.preventDefault();
});
canvas.addEventListener('pointermove',event=>{
  if(!drag||!currentModel)return;
  const asset=assets.find(item=>item.id===drag.id);if(!asset)return;
  const p=point(event);
  if(drag.mode==='resize')asset.w=drag.w+(p.x-drag.start.x)/currentModel.width;
  else{asset.x=drag.x+(p.x-drag.start.x)/currentModel.width;asset.y=drag.y+(p.y-drag.start.y)/currentModel.height;}
  PosterRenderer.constrain(asset,currentModel);fitPreview();
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{
  if(drag){drag=null;commitHistory();}
});

document.querySelector('#background-upload').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  event.target.disabled=true;loadingImages++;syncExportButtons();
  document.querySelector('#background-status').textContent='正在本地读取背景…';
  try{
    const loaded=await decodeLocal(file);
    background={...loaded,name:file.name};
    document.querySelector('#background-status').textContent=`背景已应用：${file.name}（居中裁切）`;
    document.querySelector('#background-remove').disabled=false;
    fitPreview();
  }catch(error){document.querySelector('#background-status').textContent=error.message;}
  finally{loadingImages--;syncExportButtons();event.target.disabled=false;event.target.value='';commitHistory();}
});
document.querySelector('#background-remove').addEventListener('click',()=>{
  background=null;
  document.querySelector('#background-remove').disabled=true;
  document.querySelector('#background-status').textContent='已恢复渐变与几何背景。';fitPreview();commitHistory();
});
function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function exportImage(type){
  if(!currentModel||loadingImages||exporting)return;
  const message=document.querySelector('#export-status');
  let output;
  try{
    PosterRenderer.validateExport(currentModel);
    exporting=true;syncExportButtons();message.textContent='正在按实际尺寸生成图片…';
    await document.fonts.ready;
    if(!currentModel)throw new Error('请填写有效的画布尺寸。');
    PosterRenderer.validateExport(currentModel);
    const snapshot=scene(),{width,height}=snapshot.model;
    output=document.createElement('canvas');
    PosterRenderer.draw(output,snapshot,{selection:false});
    const mime=type==='jpg'?'image/jpeg':'image/png';
    const blob=await new Promise((resolve,reject)=>output.toBlob(value=>value?resolve(value):reject(new Error('浏览器内存不足，无法导出该尺寸，请缩小画布后重试。')),mime,.95));
    if(blob.type!==mime)throw new Error('浏览器不支持所选图片格式，请尝试其他格式。');
    downloadBlob(blob,`海报-${width}x${height}.${type}`);
    message.textContent=`已导出 ${width} × ${height} 像素 ${type.toUpperCase()}，不含选择框。`;
  }catch(error){message.textContent=`导出失败：${error.message}`;}
  finally{if(output){output.width=1;output.height=1;}exporting=false;syncExportButtons();}
}
document.querySelector('#export-png').addEventListener('click',()=>exportImage('png'));
document.querySelector('#export-jpg').addEventListener('click',()=>exportImage('jpg'));
for(const layout of PosterPlanner.layouts){const option=document.createElement('option');option.value=layout.id;option.textContent=layout.name;form.elements.namedItem('layout').appendChild(option);}
document.querySelector('#top-export-png').addEventListener('click',()=>exportImage('png'));
document.querySelector('#top-export-jpg').addEventListener('click',()=>exportImage('jpg'));
document.querySelector('#preview-zoom').addEventListener('change',()=>{fitPreview();stage.scrollTo(0,0);});
document.querySelector('#undo').addEventListener('click',()=>restoreHistory(-1));
document.querySelector('#redo').addEventListener('click',()=>restoreHistory(1));
for(const [id,front] of [['asset-front',true],['asset-back',false]]){
  document.getElementById(id).addEventListener('click',()=>{
    const index=assets.findIndex(asset=>asset.id===selectedId);if(index<0)return;
    const [asset]=assets.splice(index,1);if(front)assets.push(asset);else assets.unshift(asset);
    renderAssetList();fitPreview();commitHistory();status.textContent=front?'素材已置于顶层。':'素材已置于底层。';
  });
}
document.addEventListener('keydown',event=>{
  if(!(event.ctrlKey||event.metaKey)||event.altKey||event.target.matches('input,textarea,[contenteditable=true]'))return;
  if(event.key.toLowerCase()==='z'){event.preventDefault();restoreHistory(event.shiftKey?1:-1);}
  else if(event.key.toLowerCase()==='y'){event.preventDefault();restoreHistory(1);}
});
new ResizeObserver(fitPreview).observe(stage);
render();
commitHistory();

document.fonts.ready.then(fitPreview);
window.addEventListener('resize',fitPreview);
