const test=require('node:test');
const assert=require('node:assert/strict');
const {constrain,assetBox,validateExport}=require('../web/renderer.js');
test('素材保持原图比例并约束在横竖画布中',()=>{
  for(const model of [{width:1080,height:1920},{width:1920,height:1080}]){
    const asset={x:.99,y:-.5,w:2,image:{naturalWidth:100,naturalHeight:200}};
    constrain(asset,model);const box=assetBox(asset,model);
    assert.equal(box.h/box.w,2);
    assert.ok(box.x>=0&&box.y>=0&&box.x+box.w<=model.width+.01&&box.y+box.h<=model.height+.01);
  }
});
test('导出接受实际业务尺寸，拒绝超大画布而不缩小',()=>{
  for(const model of [{width:1080,height:1920},{width:1920,height:1080},{width:2000,height:2000}])assert.doesNotThrow(()=>validateExport(model));
  for(const model of [{width:9000,height:1000},{width:6000,height:6000}])assert.throws(()=>validateExport(model));
});
