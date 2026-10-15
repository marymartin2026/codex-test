/* 预览和原尺寸导出共用的 Canvas 绘制器；没有网络请求或外部依赖。 */
const PosterRenderer = (() => {
  const fonts = {
    sans: 'system-ui, "Microsoft YaHei", sans-serif',
    serif: '"Noto Serif CJK SC", "Songti SC", SimSun, serif'
  };
  function lines(ctx, text, width) {
    return String(text).split('\n').flatMap(paragraph => {
      const result = []; let line = '';
      for (const char of Array.from(paragraph)) {
        if (line && ctx.measureText(line + char).width > width) { result.push(line); line = ''; }
        line += char;
      }
      result.push(line); return result;
    });
  }
  function regions(model) {
    const id = model.layout.id;
    const boxes = {
      left: [.08,.10,.70,.80,'left','top'], center: [.10,.12,.80,.76,'center','center'],
      bottom: [.08,.40,.84,.52,'left','bottom'], split: [.08,.12,.54,.76,'left','center'],
      'text-image': [.07,.12,.45,.76,'left','center'], 'top-image': [.08,.06,.84,.38,'left','top'],
      'hero-center': [.10,.05,.80,.22,'center','top'], product: [.07,.08,.47,.80,'left','top'],
      promotion: [.08,.06,.84,.24,'center','top'], commerce: [.08,.06,.84,.23,'left','top'],
      brand: [.10,.15,.52,.65,'left','top'], chinese: [.58,.12,.34,.76,'left','center']
    };
    return boxes[id] || boxes.left;
  }
  function assetBox(asset, model) {
    const w = asset.w * model.width;
    return {x:asset.x*model.width,y:asset.y*model.height,w,h:w*asset.image.naturalHeight/asset.image.naturalWidth};
  }
  function constrain(asset, model) {
    const ratio = asset.image.naturalHeight / asset.image.naturalWidth;
    asset.w = Math.min(Math.max(.03,asset.w), .9, .9*model.height/(model.width*ratio));
    asset.x = Math.min(Math.max(0,asset.x),1-asset.w);
    asset.y = Math.min(Math.max(0,asset.y),1-asset.w*model.width*ratio/model.height);
  }
  function defaultPosition(kind, model) {
    if (kind === 'logo') return {x:.07,y:.025,w:.15};
    if (kind === 'qr') return {x:.79,y:.80,w:.15};
    const defaults = {
      'text-image': [.56,.28,.38], 'top-image': [.23,.50,.54], 'hero-center': [.25,.30,.50],
      product: [.52,.36,.44], promotion: [.27,.33,.46], commerce: [.22,.33,.56],
      brand: [.64,.59,.28], chinese: [.06,.25,.46], split: [.65,.30,.30],
      center: [.35,.65,.30], bottom: [.24,.05,.52], left: [.66,.55,.28]
    };
    const [x,y,w] = defaults[model.layout.id] || defaults.left;
    return {x,y,w};
  }
  function draw(canvas, scene, {width, height, selection = false} = {}) {
    const {model, brief, assets, background, selectedId} = scene;
    const W=model.width,H=model.height,u=Math.min(W,H);
    canvas.width=width || W; canvas.height=height || H;
    const ctx=canvas.getContext('2d');
    if (!ctx) throw new Error('浏览器不支持画布，请换用新版浏览器。');
    ctx.scale(canvas.width/W, canvas.height/H);
    const [bg,ink,accent]=model.colors;
    ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
    if (background) {
      const scale=Math.max(W/background.naturalWidth,H/background.naturalHeight);
      const w=background.naturalWidth*scale,h=background.naturalHeight*scale;
      ctx.drawImage(background,(W-w)/2,(H-h)/2,w,h);
    } else {
      const gradient=ctx.createLinearGradient(0,0,W,H);
      gradient.addColorStop(0,bg); gradient.addColorStop(1,accent);
      ctx.globalAlpha=.13; ctx.fillStyle=gradient; ctx.fillRect(0,0,W,H); ctx.globalAlpha=1;
      ctx.fillStyle=accent; ctx.strokeStyle=accent;
      ctx.globalAlpha=.17;
      ctx.beginPath();ctx.ellipse(W*.86,H*.24,u*.38,u*.38,0,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=.24;ctx.lineWidth=u*.008;
      ctx.beginPath();ctx.ellipse(W*.04,H*.91,u*.25,u*.25,0,0,Math.PI*2);ctx.stroke();
      if(model.settings.texture==='tech') {
        ctx.globalAlpha=.10;ctx.lineWidth=u*.001;
        for(let x=0;x<W;x+=u*.08){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
        for(let y=0;y<H;y+=u*.08){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
      }
      if(model.settings.texture==='bold'||model.layout.id==='promotion') {ctx.globalAlpha=.2;ctx.fillRect(0,H*.75,W,H*.25);}
      if(model.settings.texture==='luxury'||model.layout.id==='brand') {ctx.globalAlpha=.45;ctx.lineWidth=u*.002;ctx.strokeRect(W*.035,H*.025,W*.93,H*.95);}
      if(model.settings.texture==='retro'||model.layout.id==='chinese') {
        ctx.globalAlpha=.2;ctx.beginPath();ctx.arc(W*.28,H*.38,u*.24,0,Math.PI*2);ctx.fill();
        ctx.globalAlpha=.75;ctx.fillStyle='#A63E30';ctx.fillRect(W*.88,H*.08,u*.04,u*.07);
      }
      if(model.layout.id==='commerce') {ctx.globalAlpha=.14;ctx.fillStyle=ink;ctx.fillRect(W*.14,H*.67,W*.72,H*.035);}
      ctx.globalAlpha=1;
    }
    const text = {
      title:brief.title.trim()||brief.theme.trim()||'在左侧填写海报主题',
      subtitle:brief.subtitle.trim()||'副标题 · 一句话说明核心价值',
      body:brief.body.trim()||'在左侧输入客户文案\n这里将实时呈现正文排版',
      cta:brief.cta.trim()||'行动引导 · 待客户确认'
    };
    const font=model.layout.id==='chinese'?'serif':model.settings.font;
    const split=['hero-center','promotion','commerce'].includes(model.layout.id);
    let warning='';
    function group(keys, box) {
      const [bx,by,bw,bh,align,anchor]=box;
      const x=bx*W,y=by*H,w=bw*W,h=bh*H;
      let fit=1, items,total;
      function measure() {
        items=keys.map(key=>{
          const size=u*(key==='title'?model.settings.size:key==='subtitle'?.037:key==='body'?.028:.030)*fit;
          const weight=key==='title'?800:key==='body'?400:600;
          const face=key==='title'?fonts[font]:fonts.sans;
          ctx.font=`${weight} ${size}px ${face}`;
          const wrapped=lines(ctx,text[key],w);
          return {key,size,weight,face,wrapped,leading:size*(key==='body'?1.7:1.35)};
        });
        total=items.reduce((sum,item)=>sum+item.wrapped.length*item.leading,0)+(items.length-1)*u*.025*fit;
      }
      measure();
      while(total>h&&fit>.45){fit=Math.max(.45,fit-.05);measure();}
      if(total>h)warning='当前尺寸或文案过长，部分文字可能超出预留区域；请精简文案、调整尺寸或换版式。';
      else if(fit<.99&&!warning)warning='为容纳文案，字号已缩小，请检查实际尺寸下的可读性。';
      let cy=y+(anchor==='bottom'?Math.max(0,h-total):anchor==='center'?Math.max(0,(h-total)/2):0);
      ctx.fillStyle=ink;ctx.textBaseline='top';ctx.textAlign=align;
      for(const item of items){
        ctx.font=`${item.weight} ${item.size}px ${item.face}`;
        for(const line of item.wrapped){ctx.fillText(line,align==='center'?x+w/2:x,cy);cy+=item.leading;}
        if(item.key==='cta'){ctx.fillStyle=accent;ctx.fillRect(align==='center'?x+w*.35:x,cy+u*.006,align==='center'?w*.3:Math.min(w,u*.24),u*.003);ctx.fillStyle=ink;}
        cy+=u*.025*fit;
      }
    }
    group(split?['title','subtitle']:['title','subtitle','body','cta'], regions(model));
    if(split)group(['body','cta'],[.10,.78,.80,.18,model.layout.id==='commerce'?'left':'center','top']);
    for(const asset of assets){
      const b=assetBox(asset,model);
      ctx.imageSmoothingEnabled=asset.kind!=='qr';
      if(asset.kind==='qr'){ctx.fillStyle='#fff';ctx.fillRect(b.x,b.y,b.w,b.h);}
      ctx.drawImage(asset.image,b.x,b.y,b.w,b.h);
    }
    if(selection) {
      const selected=assets.find(asset=>asset.id===selectedId);
      if(selected){
        const b=assetBox(selected,model),px=W/canvas.width;
        ctx.strokeStyle='#1474E5';ctx.lineWidth=2*px;ctx.strokeRect(b.x,b.y,b.w,b.h);
        ctx.fillStyle='#1474E5';ctx.beginPath();ctx.arc(b.x+b.w,b.y+b.h,7*px,0,Math.PI*2);ctx.fill();
      }
    }
    return {warning,text};
  }
  function validateExport(model) {
    if(model.width>8192||model.height>8192||model.width*model.height>24000000)throw new Error('该尺寸超出图片导出上限（单边 8192 像素、总计 2400 万像素）。请调整尺寸；不会自动降低清晰度。');
  }
  return {draw,assetBox,constrain,defaultPosition,validateExport};
})();
if(typeof module!=='undefined')module.exports=PosterRenderer;
