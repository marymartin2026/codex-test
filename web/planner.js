/* 纯规则生成器：不联网，不补造价格、日期或客户事实。 */
const PosterPlanner = (() => {
  const palettes = {
    '暖橙奶油': ['#FFF4E6', '#442A20', '#D95823'],
    '自然绿白': ['#F5F8F0', '#213F30', '#4F7740'],
    '黑金质感': ['#161616', '#F5EDDB', '#C6A66A'],
    '蓝白科技': ['#F0F6FF', '#152B50', '#225DCE'],
    '柔和粉紫': ['#FCF0F7', '#49304E', '#8D427C']
  };
  const industries = {
    '通用': ['暖橙奶油', '与主题相关的单一主视觉，避免无关装饰'],
    '餐饮美食': ['暖橙奶油', '食材或产品的真实质感，柔和侧光，干净桌面'],
    '美妆护肤': ['柔和粉紫', '细腻材质、柔和漫射光与简洁产品展示台'],
    '教育培训': ['蓝白科技', '有秩序的学习空间、书本与自然采光，不展示成绩承诺'],
    '科技数码': ['蓝白科技', '精密几何结构、柔和光效与科技材质'],
    '生活零售': ['自然绿白', '整洁生活场景、自然光与产品陈列空间']
  };
  const styles = {
    '简约现代': '减少装饰，使用清晰网格和大面积留白',
    '清新自然': '使用柔和光线、自然纹理和舒展间距',
    '高级质感': '强调材质与光影，克制装饰，控制元素数量',
    '活力促销': '突出已确认的活动利益点，用强调色引导行动，避免拥挤',
    '科技未来': '采用几何网格、细线和有节制的光效',
    '复古文艺': '采用纸张质感、暖调光线与舒展的文字节奏'
  };
  const layouts = [
    { id: 'left', name: '左对齐留白', description: '文字左对齐，主标题位于上部，正文与行动引导依次向下排列', space: '右侧保留几何主视觉，左侧约 65% 保持干净低细节' },
    { id: 'center', name: '居中聚焦', description: '标题、副标题、正文与行动引导居中排列，装饰分布在画布边缘', space: '中心约 80% 保持干净低细节，视觉元素分布在边缘' },
    { id: 'bottom', name: '底部叙事', description: '上部保留背景视觉，文字组靠下左对齐，正文跟随标题排列', space: '上方布置主视觉，下方约 65% 保持干净低细节' },
    { id: 'split', name: '分栏构图', description: '左侧约 62% 放文字，右侧放几何主视觉，文字组垂直居中', space: '主体靠右，左侧约 65% 保持干净低细节' },
    { id: 'text-image', name: '左文右图', description: '左侧文字与右侧产品视觉分栏', space: '左侧约 50% 为文字留白，产品视觉在右侧' },
    { id: 'top-image', name: '上文下图', description: '上部集中标题和正文，下部展示产品或人物', space: '上方约 45% 为文字留白，下方展示主体' },
    { id: 'hero-center', name: '中心视觉', description: '上方标题，中间主视觉，下方正文与行动引导', space: '主体置于中央，上下为文字留白' },
    { id: 'product', name: '产品主视觉', description: '上部左对齐标题，右下展示大幅产品，左下放正文', space: '主体置于右下，左侧与上部留白' },
    { id: 'promotion', name: '活动促销', description: '上部大标题与副标题，中央活动视觉，底部行动条', space: '中央放活动主视觉，上下留出标题和行动区域' },
    { id: 'commerce', name: '电商商品', description: '顶部标题与副标题，中部商品展示台，底部卖点和行动信息', space: '中部大面积商品视觉，顶部和底部保持干净' },
    { id: 'brand', name: '简约品牌', description: '小幅主视觉靠右下，左侧克制文字与大量留白', space: '大面积留白，视觉元素集中在右下角' },
    { id: 'chinese', name: '国风宣传', description: '右侧宋体标题与正文，左侧圆形主视觉及印章装饰', space: '右侧文字留白，左侧布置东方意境主视觉' }
  ];
  const styleSettings = {
    '简约现代': { layout: 0, size: .083, font: 'sans', texture: 'minimal' },
    '清新自然': { layout: 2, size: .079, font: 'sans', texture: 'natural' },
    '高级质感': { layout: 1, size: .075, font: 'serif', texture: 'luxury' },
    '活力促销': { layout: 0, size: .105, font: 'sans', texture: 'bold' },
    '科技未来': { layout: 3, size: .087, font: 'sans', texture: 'tech' },
    '复古文艺': { layout: 2, size: .078, font: 'serif', texture: 'retro' }
  };
  function design(input, variant = 0) {
    const width = Number(input.width), height = Number(input.height);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 100 || height < 100 || width > 20000 || height > 20000) throw new Error('宽高须为 100–20000 的整数像素。');
    const industry = Object.hasOwn(industries, input.industry) ? input.industry : '通用';
    const style = Object.hasOwn(styles, input.style) ? input.style : '简约现代';
    const palette = Object.hasOwn(palettes, input.palette) ? input.palette : industries[industry][0];
    const settings = styleSettings[style];
    const offset = Number.isInteger(variant) ? ((variant % layouts.length) + layouts.length) % layouts.length : 0;
    return { width, height, industry, style, palette, colors: palettes[palette], settings,
      layout: layouts[((layouts.findIndex(item => item.id === input.layout) >= 0 ? layouts.findIndex(item => item.id === input.layout) : settings.layout) + offset) % layouts.length] };
  }
  function generate(input, variant = 0) {
    const model = design(input, variant);
    const { width, height, industry, style, palette } = model;
    const clean = key => String(input[key] ?? '').trim();
    const theme = clean('theme');
    if (!theme) throw new Error('请填写海报主题。');
    const [bg, ink, accent] = model.colors;
    const ratio = width / height;
    const orientation = ratio < .85 ? '竖版' : ratio > 1.2 ? '横版' : '近方形';
    const layout = model.layout.description;
    const space = model.layout.space;
    const px = n => Math.max(1, Math.round(Math.min(width, height) * n));
    const title = clean('title') || `【备选待确认】${theme}`;
    const subtitle = clean('subtitle') || '【待补充】一句话说明核心价值，不编造产品功效或优惠。';
    const body = clean('body') || '【待补充】已确认的产品卖点、活动时间、地点、价格或联系方式。';
    const cta = clean('cta') || '【备选待确认】了解详情（入口待提供）';
    const fonts = style === '复古文艺' || style === '高级质感' ? '标题可选思源宋体（Noto Serif CJK SC）；正文可选思源黑体（Noto Sans CJK SC）' : '标题与正文可选思源黑体（Noto Sans CJK SC），通过字重区分层级';
    return `# ${theme}｜海报制作方案

## 1. 客户需求分析
- 画布：${width} × ${height} px，${orientation}；宽高比 ${ratio.toFixed(2)}:1。
- 行业：${industry}；风格：${style}；色系：${palette}。
- 核心任务：围绕“${theme}”建立单一视觉重点，让读者依次看到主题、价值信息和下一步行动。
- 受众与渠道：${clean('audience') || '待客户确认；暂按普通数字海报设计。'}
- 客户补充要求（逐项核对）：${clean('notes') || '未提供；需确认品牌素材、Logo、禁用元素及投放要求。'}
- 生成方式：本地规则模板，未调用 AI 模型；未提供的信息须补充确认。

## 2. 海报信息层级
第一层 / 主标题（优先吸引注意）：
${title}

第二层 / 副标题（解释核心价值）：
${subtitle}

第三层 / 正文（支持决策，保留原文）：
${body}

第四层 / 行动引导（告诉读者下一步）：
${cta}

品牌与辅助信息：使用客户确认的 Logo、署名、联系方式或二维码；缺失时留出位置，不自行编造。

## 3. 标题、副标题与正文排版建议
- 当前预览版式：${model.layout.name}。\n- 推荐结构：${layout}。比例是起点，文案较多时减少装饰或拆分多张海报，不删改客户事实。
- 主标题：建议 ${px(.065)}–${px(.09)} px，粗体，优先 1–2 行；长标题在语义停顿处分行。
- 副标题：建议 ${px(.032)}–${px(.044)} px，中等字重，1–2 行。
- 正文：建议 ${px(.024)}–${px(.032)} px，行高 1.5–1.8；按信息分段，与标题使用同一条对齐线。
- 行动引导：建议 ${px(.03)}–${px(.04)} px，靠近联系方式或二维码，不压过主标题。
- 安全边距：四周至少 ${px(.05)} px；文字与复杂背景之间增加纯色承托。字号须在实际展示尺寸下检查。

## 4. AI 背景图提示词（可复制到图片工具）
为主题“${theme}”制作一张${orientation}商业海报背景，目标画布 ${width}×${height} 像素。行业：${industry}。风格：${style}，${styles[style]}。画面元素：${industries[industry][1]}。配色参考：${palette}，背景色 ${bg}，辅助色 ${accent}。构图：${space}，文字区域明暗平稳，保证后期文字可读。仅生成背景和视觉元素，不生成任何文字、字母、数字、Logo、二维码或水印。后期叠加文案参考（仅理解主题，禁止把这些文字绘入背景）：主标题“${title}”，副标题“${subtitle}”，正文“${body}”，行动引导“${cta}”。目标受众与渠道：${clean('audience') || '待确认'}。客户补充约束：${clean('notes') || '无额外约束'}。

避免元素：杂乱背景、过度装饰、难以阅读的文字区域、伪造品牌标识、变形主体、低清晰度。
使用提示：图片工具不一定支持精确像素，先选相近宽高比，再在设计工具中裁切。Logo、产品照片和所有文字由人工后期加入；规则不会自动理解或执行补充要求中的每条视觉约束。

## 5. 字体、配色与版式建议
- 字体：${fonts}；未安装时先用系统中文字体预览。字体文件需自行从官方渠道获取并核对授权。
- 背景色：${bg}；主文字色：${ink}；强调色：${accent}。
- 配色比例参考：背景 70%、文字与结构 20%、强调 10%；强调色用于行动引导或关键点。
- 版式风格：${styles[style]}；字体最多两种，避免过多字重和装饰。
- 检查实际图片上的文字对比度；浅色背景优先深色正文，复杂区域加纯色底。

## 6. 完整制作与交付流程
1. 客户确认文案、受众、渠道与补充要求，补齐“待确认 / 待补充”内容。
2. 按 ${width}×${height} px 建立画布，划出文字、主视觉和品牌区。
3. 使用上方提示词获得背景，或使用已获授权的图片，检查与客户约束一致。
4. 放入真实 Logo、产品素材和原始文案，按信息层级排版；不要直接使用图片模型生成的文字。
5. 在目标设备尺寸下检查可读性、换行、裁切及安全边距，核对日期、价格、联系方式和宣传依据，测试二维码。
6. 交客户审核，确认后按渠道要求导出 PNG/JPG 并保留源文件；印刷用途另向印厂确认物理尺寸、DPI、出血及 CMYK。

交付清单：预览图、最终导出图、可编辑源文件、素材及字体授权记录、客户确认记录。
本方案为制作建议；工作台支持本地素材合成与 PNG/JPG 导出，不自动生成 AI 图片或审核结论。
`;
  }
  function backgroundPrompt(input, variant = 0) {
    return generate(input, variant).split('## 4. AI 背景图提示词（可复制到图片工具）\n')[1].split('\n## 5.')[0].trim();
  }
  return { generate, design, backgroundPrompt, layouts };
})();
if (typeof module !== 'undefined') module.exports = PosterPlanner;
