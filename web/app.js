const form = document.querySelector('#brief-form');
const plan = document.querySelector('#plan');
const status = document.querySelector('#status');
const poster = document.querySelector('#poster');
const content = document.querySelector('#poster-content');
const stage = document.querySelector('#preview-stage');
const frame = document.querySelector('#canvas-frame');
let variant = 0;
let currentModel = null;
let currentPlan = '';
let currentPrompt = '';
const readBrief = () => Object.fromEntries(new FormData(form));

function fitPreview() {
  if (!currentModel) return;
  const { width, height } = currentModel;
  const scale = Math.min((stage.clientWidth - 32) / width, 600 / height);
  frame.style.width = `${width * scale}px`;
  frame.style.height = `${height * scale}px`;
  poster.style.transform = `scale(${scale})`;
  // 保留全部原文；先缩小字号，仍放不下时明确提示，不默默截掉内容。
  let fit = 1;
  content.style.setProperty('--fit', fit);
  while (content.scrollHeight > content.clientHeight + 1 && fit > .45) {
    fit = Math.max(.45, fit - .05);
    content.style.setProperty('--fit', fit);
  }
  const overflow = content.scrollHeight > content.clientHeight + 1;
  document.querySelector('#preview-warning').textContent = overflow
    ? '当前尺寸或文案过长，部分内容超出画布。请精简文案、调整尺寸或重新排版；导出方案仍保留全部原文。'
    : fit < .99 ? '为容纳文案，预览字号已自动缩小。请在实际使用尺寸下检查可读性。' : '';
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
    poster.style.width = `${model.width}px`;
    poster.style.height = `${model.height}px`;
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
    document.querySelector('#canvas-info').textContent = `${model.width} × ${model.height} 像素 · ${model.layout.name} · ${model.style} · ${model.palette}`;
    frame.hidden = false;
    fitPreview();
    if (!brief.theme.trim()) {
      plan.textContent = '填写海报主题后，完整方案将自动生成。';
      status.textContent = '可以先调整预览；填写主题后即可复制提示词和导出方案。';
      return;
    }
    currentPlan = PosterPlanner.generate(brief, variant);
    currentPrompt = PosterPlanner.backgroundPrompt(brief, variant);
    plan.textContent = currentPlan;
    for (const id of ['copy', 'copy-prompt', 'download']) document.getElementById(id).disabled = false;
    status.textContent = '预览与方案已同步更新。';
  } catch (error) {
    currentModel = null;
    frame.hidden = true;
    plan.textContent = '';
    document.querySelector('#canvas-info').textContent = '请填写有效的画布尺寸';
    document.querySelector('#preview-warning').textContent = '';
    status.textContent = error.message;
  }
}

form.addEventListener('input', event => {
  if (event.target.name === 'style') variant = 0;
  render();
});
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
  document.querySelector('#plan-details').open = true;
  document.querySelector('#result-title').scrollIntoView({ block: 'start' });
});
document.querySelector('#example').addEventListener('click', () => {
  const example = {width:1080,height:1920,theme:'春日新品咖啡上市',industry:'餐饮美食',style:'清新自然',palette:'自然绿白',title:'把春天，装进咖啡里',subtitle:'春日限定 · 青柠冷萃',body:'清爽青柠香气，搭配醇厚冷萃。\n活动时间、价格与门店信息待客户确认。',cta:'到店发现春日新口味',audience:'年轻上班族；朋友圈与门店电子屏',notes:'为门店 Logo 留出位置；不使用未经确认的优惠信息。'};
  for (const [name,value] of Object.entries(example)) form.elements.namedItem(name).value = value;
  variant = 0;
  render();
});
document.querySelector('#relayout').addEventListener('click', () => { variant = (variant + 1) % 4; render(); });
async function copyText(text, success) {
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = success;
  } catch {
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
new ResizeObserver(fitPreview).observe(stage);
render();
