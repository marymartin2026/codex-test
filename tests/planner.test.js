const test = require('node:test');
const assert = require('node:assert/strict');
const {generate} = require('../web/planner.js');
const brief = {width:1080,height:1920,theme:'春日新品',industry:'餐饮美食',style:'清新自然',palette:'自动推荐'};
test('输出六部分方案，标记缺失信息', () => {
  const plan = generate(brief);
  assert.equal((plan.match(/^## /gm)||[]).length,6);
  for (const text of ['1080 × 1920 px，竖版','暖橙奶油','待补充','不生成任何文字']) assert.ok(plan.includes(text));
});
test('保留客户原文、价格与换行', () => {
  const data = {...brief,title:'客户标题',subtitle:'客户副标题',body:'价格 29 元\n时间 10月20日',cta:'联系门店',notes:'禁止红色'};
  const plan = generate(data);
  for (const key of ['title','subtitle','body','cta','notes']) assert.ok(plan.includes(data[key]));
});
test('横版、方形和指定风格色系影响方案', () => {
  assert.match(generate({...brief,width:1920,height:1080},1), /左侧约 62%/);
  const plan = generate({...brief,width:1000,height:1000,palette:'黑金质感',style:'高级质感'});
  for (const text of ['近方形','#161616','思源宋体']) assert.ok(plan.includes(text));
});
test('拒绝非法尺寸和空主题', () => {
  for (const width of [0,-1,100.5,20001,'abc',Infinity]) assert.throws(() => generate({...brief,width}));
  assert.throws(() => generate({...brief,theme:' '}));
});

 test('重新排版循环全部版式，提示词与导出保持同步', () => {
  const {design, backgroundPrompt, layouts} = require('../web/planner.js');
  const names = new Set();
  for (let i = 0; i < layouts.length; i++) {
    const model = design(brief,i);
    names.add(model.layout.id);
    assert.ok(generate(brief,i).includes(model.layout.name));
    assert.ok(backgroundPrompt(brief,i).includes(model.layout.space));
    assert.ok(!backgroundPrompt(brief,i).includes('## 5.'));
  }
  assert.equal(names.size,layouts.length);
  assert.equal(design(brief,layouts.length).layout.id,design(brief,0).layout.id);
});
test('风格影响默认版式、字体与字号；未知选项安全回退', () => {
  const {design} = require('../web/planner.js');
  const simple = design({...brief,style:'简约现代'});
  const luxury = design({...brief,style:'高级质感'});
  assert.notEqual(simple.layout.id,luxury.layout.id);
  assert.notEqual(simple.settings.font,luxury.settings.font);
  assert.notEqual(simple.settings.size,luxury.settings.size);
  assert.equal(design({...brief,industry:'__proto__',palette:'constructor',style:'toString'}).palette,'暖橙奶油');
});

test('包含八种商业模板，显式选择与中文提示词保留文案', () => {
  const {design,layouts,backgroundPrompt}=require('../web/planner.js');
  const required=['左文右图','上文下图','中心视觉','产品主视觉','活动促销','电商商品','简约品牌','国风宣传'];
  for(const name of required){const layout=layouts.find(item=>item.name===name);assert.ok(layout);assert.equal(design({...brief,layout:layout.id}).layout.id,layout.id);}
  const prompt=backgroundPrompt({...brief,title:'春天上市',subtitle:'青柠限定',body:'活动日期待确认',cta:'到店了解'});
  for(const text of ['春天上市','青柠限定','活动日期待确认','到店了解','禁止把这些文字绘入背景'])assert.ok(prompt.includes(text));
});
