const pptxgen = require("/tmp/pptxgen-work/node_modules/pptxgenjs");

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "Codex";
pptx.subject = "CE MDR 项目启动会";
pptx.title = "CE MDR 项目启动会";
pptx.company = "Company";
pptx.lang = "zh-CN";
pptx.theme = {
  headFontFace: "Microsoft YaHei",
  bodyFontFace: "Microsoft YaHei",
  lang: "zh-CN",
};
pptx.defineLayout({ name: "CUSTOM_WIDE", width: 13.333, height: 7.5 });
pptx.layout = "CUSTOM_WIDE";
pptx.margin = 0;

const C = {
  cyan: "05BAD8",
  cyan2: "1BAAC6",
  dark: "111111",
  text: "222222",
  gray: "666666",
  mid: "A6ADB4",
  line: "D9DEE3",
  pale: "F4F8FA",
  pale2: "ECF9FC",
  white: "FFFFFF",
  black: "000000",
  orange: "F5A623",
  green: "54A24B",
  red: "D95F5F",
};

const FONT = "Microsoft YaHei";
const W = 13.333;
const H = 7.5;

function addText(slide, text, x, y, w, h, opt = {}) {
  slide.addText(text, {
    x, y, w, h,
    fontFace: FONT,
    margin: opt.margin ?? 0.04,
    breakLine: false,
    fit: opt.fit ?? "shrink",
    color: opt.color || C.text,
    fontSize: opt.fontSize || 12,
    bold: !!opt.bold,
    italic: !!opt.italic,
    align: opt.align || "left",
    valign: opt.valign || "top",
    paraSpaceAfterPt: opt.paraSpaceAfterPt ?? 2,
    breakLine: opt.breakLine,
    ...opt,
  });
}

function addLine(slide, x1, y1, x2, y2, color = C.cyan, width = 1.2) {
  slide.addShape(pptx.ShapeType.line, { x: x1, y: y1, w: x2 - x1, h: y2 - y1, line: { color, width } });
}

function addHeader(slide, title, section = "") {
  slide.background = { color: C.white };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.12, fill: { color: C.cyan }, line: { color: C.cyan } });
  addText(slide, title, 0.58, 0.34, 10.7, 0.55, { fontSize: 20, bold: true, color: C.dark, margin: 0 });
  if (section) addText(slide, section, 11.1, 0.45, 1.55, 0.25, { fontSize: 7.5, color: C.gray, align: "right", margin: 0 });
  addLine(slide, 0.58, 0.96, 12.75, 0.96, C.line, 0.6);
}

function addFooter(slide, idx) {
  addText(slide, "CE MDR 项目启动会", 0.58, 7.08, 2.3, 0.18, { fontSize: 6.5, color: C.gray, margin: 0 });
  addText(slide, String(idx).padStart(2, "0"), 12.18, 7.04, 0.38, 0.2, { fontSize: 7, color: C.gray, align: "right", margin: 0 });
}

function bulletLines(items) {
  return items.map((t) => ({ text: t, options: { bullet: { type: "bullet" }, hanging: 4, breakLine: true } }));
}

function card(slide, x, y, w, h, title, body, opt = {}) {
  slide.addShape(pptx.ShapeType.rect, {
    x, y, w, h,
    rectRadius: 0.04,
    fill: { color: opt.fill || C.white },
    line: { color: opt.line || C.line, width: 0.8 },
  });
  if (opt.topBar) slide.addShape(pptx.ShapeType.rect, { x, y, w, h: 0.08, fill: { color: opt.topBar }, line: { color: opt.topBar } });
  addText(slide, title, x + 0.18, y + 0.17, w - 0.36, 0.28, { fontSize: opt.titleSize || 11.5, bold: true, color: opt.titleColor || C.dark, margin: 0 });
  if (Array.isArray(body)) {
    addText(slide, bulletLines(body), x + 0.22, y + 0.56, w - 0.45, h - 0.66, { fontSize: opt.bodySize || 9.2, color: C.text, breakLine: false, paraSpaceAfterPt: 2, margin: 0 });
  } else {
    addText(slide, body, x + 0.18, y + 0.58, w - 0.36, h - 0.68, { fontSize: opt.bodySize || 9.2, color: C.text, margin: 0.02 });
  }
}

function table(slide, x, y, w, rowH, cols, rows, opt = {}) {
  const widths = cols.map((c) => c.w);
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = x;
  cols.forEach((c, i) => {
    const cw = w * widths[i] / total;
    slide.addShape(pptx.ShapeType.rect, { x: cx, y, w: cw, h: rowH, fill: { color: opt.headerFill || C.dark }, line: { color: C.white, width: 0.5 } });
    addText(slide, c.t, cx + 0.06, y + 0.07, cw - 0.12, rowH - 0.1, { fontSize: opt.headerSize || 8.5, bold: true, color: C.white, align: c.align || "left", margin: 0 });
    cx += cw;
  });
  rows.forEach((r, ri) => {
    cx = x;
    const fill = ri % 2 === 0 ? (opt.fill1 || C.white) : (opt.fill2 || C.pale);
    const rh = opt.rowHeights?.[ri] || rowH;
    r.forEach((cell, i) => {
      const cw = w * widths[i] / total;
      slide.addShape(pptx.ShapeType.rect, { x: cx, y: y + rowH + opt.rowGap + ri * rh, w: cw, h: rh, fill: { color: fill }, line: { color: C.line, width: 0.5 } });
      addText(slide, cell, cx + 0.07, y + rowH + opt.rowGap + ri * rh + 0.07, cw - 0.14, rh - 0.11, { fontSize: opt.bodySize || 7.8, color: C.text, margin: 0, valign: "mid" });
      cx += cw;
    });
  });
}

function addAgendaBar(slide, active) {
  const items = ["范围", "产品", "NB", "技术文件", "临床评价", "QMS", "行动"];
  const x0 = 0.58, y = 6.72, gap = 0.05, bw = 1.1;
  items.forEach((it, i) => {
    const fill = i === active ? C.cyan : C.pale;
    const txt = i === active ? C.white : C.gray;
    slide.addShape(pptx.ShapeType.rect, { x: x0 + i * (bw + gap), y, w: bw, h: 0.22, fill: { color: fill }, line: { color: fill } });
    addText(slide, it, x0 + i * (bw + gap), y + 0.045, bw, 0.12, { fontSize: 6.2, bold: i === active, color: txt, align: "center", margin: 0 });
  });
}

let page = 1;

{
  const s = pptx.addSlide();
  s.background = { color: C.white };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.13, fill: { color: C.cyan }, line: { color: C.cyan } });
  s.addShape(pptx.ShapeType.rect, { x: 0.62, y: 1.02, w: 0.12, h: 3.55, fill: { color: C.cyan }, line: { color: C.cyan } });
  addText(s, "CE MDR 项目启动会", 0.92, 1.0, 7.7, 0.68, { fontSize: 30, bold: true, color: C.dark, margin: 0 });
  addText(s, "项目范围确认、技术文件路径与临床评价策略对齐", 0.94, 1.84, 7.1, 0.36, { fontSize: 13, color: C.gray, margin: 0 });
  addText(s, "一次性使用腹腔镜手术器械 / 内窥镜缝合器\n启动会讨论稿", 0.96, 2.42, 5.9, 0.72, { fontSize: 11.5, color: C.text, margin: 0 });
  s.addShape(pptx.ShapeType.rect, { x: 8.55, y: 1.06, w: 3.85, h: 4.72, fill: { color: C.pale }, line: { color: C.line } });
  addText(s, "Kick-off focus", 8.87, 1.43, 2.5, 0.25, { fontSize: 9.5, bold: true, color: C.cyan, margin: 0 });
  ["认证范围", "技术文件", "临床证据", "QMS 递交", "行动闭环"].forEach((t, i) => {
    s.addShape(pptx.ShapeType.rect, { x: 8.86, y: 1.9 + i * 0.63, w: 0.26, h: 0.26, fill: { color: C.cyan }, line: { color: C.cyan } });
    addText(s, t, 9.28, 1.88 + i * 0.63, 2.35, 0.26, { fontSize: 13, bold: true, color: C.dark, margin: 0 });
  });
  addText(s, "2026-06-22", 0.96, 6.42, 1.4, 0.2, { fontSize: 8, color: C.gray, margin: 0 });
  addFooter(s, page++);
}

{
  const s = pptx.addSlide();
  addHeader(s, "今天会议需要对齐 7 个核心问题，确保后续技术文件与 NB 沟通按同一口径推进", "Agenda");
  const agenda = [
    ["01", "项目范围确认", "确认产品族、型号、分类、认证边界及服务范围"],
    ["02", "产品介绍 / 当前阶段", "明确预期用途、结构组成、型号差异及当前资料状态"],
    ["03", "NB 情况介绍", "对齐公告机构选择、审核路径、沟通机制与预计节奏"],
    ["04", "技术文件模块", "梳理 MDR Annex II / III 技术文件模块与责任分工"],
    ["05", "临床评价策略", "确认 SOTA、等同/同类器械、临床数据和 CER 路径"],
    ["06", "质量体系递交要求", "确认 QMS 程序文件、差异补齐和递交范围"],
    ["07", "下一步行动", "固化资料清单、负责人、里程碑与会议机制"],
  ];
  agenda.forEach((a, i) => {
    const y = 1.35 + i * 0.67;
    s.addShape(pptx.ShapeType.rect, { x: 0.72, y, w: 0.52, h: 0.38, fill: { color: i < 2 ? C.cyan : C.pale }, line: { color: i < 2 ? C.cyan : C.line } });
    addText(s, a[0], 0.72, y + 0.075, 0.52, 0.15, { fontSize: 8.5, bold: true, color: i < 2 ? C.white : C.cyan, align: "center", margin: 0 });
    addText(s, a[1], 1.45, y, 2.45, 0.22, { fontSize: 12, bold: true, color: C.dark, margin: 0 });
    addText(s, a[2], 4.05, y + 0.02, 7.7, 0.18, { fontSize: 9.4, color: C.text, margin: 0 });
    addLine(s, 1.45, y + 0.46, 12.25, y + 0.46, C.line, 0.4);
  });
  addFooter(s, page++);
}

{
  const s = pptx.addSlide();
  addHeader(s, "项目范围建议锁定为两类一次性内窥镜手术器械，分别按 IIb / IIa 分类推进", "01 项目范围确认");
  card(s, 0.72, 1.28, 3.68, 1.38, "认证产品 1", ["一次性使用手控腹腔内窥镜高频手术器械", "CE 产品分类：IIb 类", "型号：ZRMHN-20/25/31 系列 L/F"], { topBar: C.cyan, fill: C.pale2 });
  card(s, 4.85, 1.28, 3.68, 1.38, "认证产品 2", ["一次性使用多关节内窥镜缝合器", "CE 产品分类：IIa 类", "型号：ZRNH-20/25/31 系列 LL/LF/FL/FF"], { topBar: C.cyan, fill: C.pale2 });
  card(s, 8.98, 1.28, 3.2, 1.38, "服务范围", ["认证计划", "CE 技术文件辅导/编制/审核", "递交、跟踪沟通、发补策略"], { topBar: C.dark });
  table(s, 0.72, 3.2, 11.45, 0.38, [
    { t: "边界事项", w: 1.4 }, { t: "会议需确认内容", w: 3.2 }, { t: "建议输出", w: 2.2 },
  ], [
    ["适用产品", "产品族、型号、规格差异是否全部纳入本次 CE MDR 认证", "产品范围确认表"],
    ["法规分类", "IIb 高频手术器械、IIa 缝合器分类依据及适用规则", "分类论证/法规路径"],
    ["证书范围", "证书描述、预期用途、附件清单、型号命名规则", "证书范围草案"],
    ["服务边界", "技术文件、临床评价、QMS 文件、发补支持的交付界面", "项目 RACI 与资料清单"],
  ], { bodySize: 7.4, headerSize: 8, rowGap: 0, fill2: "F7F9FA" });
  addAgendaBar(s, 0);
  addFooter(s, page++);
}

{
  const s = pptx.addSlide();
  addHeader(s, "两类产品均用于内窥镜手术场景，但风险来源与核心证明重点不同", "02 产品介绍 / 当前阶段");
  card(s, 0.75, 1.28, 5.75, 1.55, "一次性使用手控腹腔内窥镜高频手术器械", [
    "用途：与高频手术设备配合，用于人体组织常规切割和凝血",
    "组成：电钩头、关节、杆身、龙骨外壳、手柄组件及线缆组件",
    "关注点：高频电安全、热损伤控制、绝缘完整性、一次性使用和灭菌确认",
  ], { topBar: C.cyan, fill: C.white, bodySize: 8.3 });
  card(s, 6.82, 1.28, 5.75, 1.55, "一次性使用多关节内窥镜缝合器", [
    "用途：内窥镜手术中夹持缝合针并进行组织缝合",
    "组成：钳头组件、关节、钳杆、龙骨外壳和手柄组件",
    "关注点：夹持力、关节灵活性、缝合可控性、机械强度和无菌屏障",
  ], { topBar: C.cyan, fill: C.white, bodySize: 8.3 });
  addText(s, "当前阶段建议以“资料可用性 + 证据缺口 + NB 可接受性”三线并行推进", 0.75, 3.38, 8.5, 0.28, { fontSize: 12.5, bold: true, color: C.dark, margin: 0 });
  const steps = [
    ["资料盘点", "说明书、图纸、风险管理、验证确认、灭菌/包装、临床资料"],
    ["差距评估", "MDR Annex II/III、GSPR、适用标准、临床证据充分性"],
    ["文件编制", "STED/技术文件、CER、PMS/PMCF、SSCP 如适用、QMS 程序"],
    ["NB 递交", "预审沟通、正式递交、问题回复、发补关闭"],
  ];
  steps.forEach((st, i) => {
    const x = 0.78 + i * 3.02;
    s.addShape(pptx.ShapeType.rect, { x, y: 4.05, w: 2.5, h: 1.28, fill: { color: i === 0 ? C.pale2 : C.pale }, line: { color: C.line } });
    s.addShape(pptx.ShapeType.rect, { x, y: 4.05, w: 0.42, h: 1.28, fill: { color: C.cyan }, line: { color: C.cyan } });
    addText(s, `0${i + 1}`, x + 0.055, 4.55, 0.3, 0.16, { fontSize: 7, bold: true, color: C.white, align: "center", margin: 0 });
    addText(s, st[0], x + 0.56, 4.22, 1.65, 0.2, { fontSize: 10.2, bold: true, color: C.dark, margin: 0 });
    addText(s, st[1], x + 0.56, 4.58, 1.72, 0.47, { fontSize: 7.2, color: C.text, margin: 0 });
    if (i < 3) addLine(s, x + 2.55, 4.68, x + 2.9, 4.68, C.cyan, 1.2);
  });
  addAgendaBar(s, 1);
  addFooter(s, page++);
}

{
  const s = pptx.addSlide();
  addHeader(s, "NB 议题的关键不是“机构名称”，而是审核路径、时点、沟通口径和发补闭环机制", "03 NB 情况介绍");
  table(s, 0.78, 1.28, 11.78, 0.42, [
    { t: "议题", w: 1.1 }, { t: "需确认信息", w: 3.2 }, { t: "对项目影响", w: 2.8 }, { t: "建议准备材料", w: 2.3 },
  ], [
    ["NB 选择", "拟合作 NB 名称、MDR 指定范围、是否覆盖相应产品代码", "决定递交路径、排期和审核深度", "NB 资质/报价/排期信息"],
    ["申请路径", "首次 MDR 认证、已有 CE 转 MDR、是否分产品族递交", "影响技术文件结构和证据打包方式", "申请表与证书范围草案"],
    ["审核安排", "技术文件审核、QMS 审核、远程/现场审核可能性", "影响里程碑和资源投入", "项目计划与审核资料包"],
    ["沟通机制", "预沟通、正式问题单、发补回复窗口和会议频率", "影响问题关闭效率和证据补充节奏", "沟通记录模板"],
  ], { bodySize: 7.2, headerSize: 7.8, rowGap: 0, fill2: "F7F9FA" });
  card(s, 0.78, 5.08, 3.62, 0.9, "启动会建议结论", "若 NB 尚未最终确定，本阶段先按主流 MDR Annex II/III 结构准备，避免因机构选择延迟影响底层证据整理。", { fill: C.pale2, topBar: C.cyan, bodySize: 8 });
  card(s, 4.72, 5.08, 3.62, 0.9, "需客户确认", "NB 候选清单、预计递交窗口、是否已有沟通记录，以及是否需我方参与 NB 问题回复。", { fill: C.white, topBar: C.dark, bodySize: 8 });
  card(s, 8.66, 5.08, 3.62, 0.9, "项目控制点", "所有 NB 问题进入问题台账，按负责人、证据来源、回复口径、关闭状态进行周度跟踪。", { fill: C.white, topBar: C.cyan, bodySize: 8 });
  addAgendaBar(s, 2);
  addFooter(s, page++);
}

{
  const s = pptx.addSlide();
  addHeader(s, "技术文件应按 MDR Annex II / III 模块化组织，避免材料堆叠但缺少论证链", "04 技术文件模块介绍");
  const modules = [
    ["A", "产品描述与规格", "型号清单、预期用途、附件/组合、UDI、标签说明书"],
    ["B", "GSPR 符合性", "适用条款、标准清单、符合性证据、偏离说明"],
    ["C", "设计制造信息", "设计图纸、工艺流程、关键供应商、生产控制"],
    ["D", "风险管理", "ISO 14971 文件、危害分析、风险控制、残余风险"],
    ["E", "验证确认", "性能、电气安全、生物相容性、灭菌、包装、货架期"],
    ["F", "临床评价", "CEP、SOTA、文献检索、CER、PMS/PMCF 链接"],
    ["G", "上市后监督", "PMS 计划/报告、PMCF、警戒、不良事件与召回"],
    ["H", "技术文件摘要", "证据索引、版本控制、NB 问题回复包"],
  ];
  modules.forEach((m, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 0.75 + col * 3.02;
    const y = 1.38 + row * 2.05;
    s.addShape(pptx.ShapeType.rect, { x, y, w: 2.65, h: 1.52, fill: { color: C.white }, line: { color: C.line } });
    s.addShape(pptx.ShapeType.rect, { x, y, w: 0.48, h: 1.52, fill: { color: i < 2 ? C.cyan : C.dark }, line: { color: i < 2 ? C.cyan : C.dark } });
    addText(s, m[0], x + 0.11, y + 0.58, 0.25, 0.2, { fontSize: 11, bold: true, color: C.white, align: "center", margin: 0 });
    addText(s, m[1], x + 0.66, y + 0.2, 1.75, 0.24, { fontSize: 10.2, bold: true, color: C.dark, margin: 0 });
    addText(s, m[2], x + 0.66, y + 0.58, 1.75, 0.54, { fontSize: 7.3, color: C.text, margin: 0 });
  });
  addText(s, "建议会议输出：技术文件目录 + 已有资料映射 + 缺口清单 + 责任人与预计完成日期", 0.75, 5.72, 10.9, 0.28, { fontSize: 10.5, bold: true, color: C.cyan, margin: 0 });
  addAgendaBar(s, 3);
  addFooter(s, page++);
}

{
  const s = pptx.addSlide();
  addHeader(s, "技术文件递交服务建议拆成 6 类交付物，便于客户内部准备和 NB 问题追踪", "04 技术文件模块介绍");
  table(s, 0.78, 1.28, 11.78, 0.38, [
    { t: "服务项目", w: 1.25 }, { t: "服务范围", w: 3.5 }, { t: "主要交付文件", w: 3.0 },
  ], [
    ["认证计划", "制定认证计划；明确适用法规、标准、资料范围、里程碑和递交策略", "认证计划"],
    ["技术文件辅导/编制/审核", "按 MDR 技术文件结构进行资料梳理、文件编制、证据索引和审核修改", "认证文件 / 技术文件包"],
    ["技术文件递交", "支持申请资料整理、递交资料包打包、递交后资料版本控制", "递交资料包 / 递交记录"],
    ["CE 认证跟踪和沟通", "跟踪 NB 审核问题、组织回复、维护问题台账和沟通纪要", "发补通知书 / 回复记录"],
    ["发补策略", "针对 NB 问题制定回复策略、证据补充路径和责任分工", "发补计划"],
    ["项目管理", "例会、台账、进度、风险、责任人和决策事项管理", "项目周报 / 问题台账"],
  ], { bodySize: 7.6, headerSize: 8, rowGap: 0, fill2: "F7F9FA" });
  addAgendaBar(s, 3);
  addFooter(s, page++);
}

{
  const s = pptx.addSlide();
  addHeader(s, "临床评价策略以“CEP-SOTA-同类/等同-安全数据-CER”形成可审查证据链", "05 临床评价策略");
  const chain = [
    ["临床开发策略和方案", "定义临床路径、证据组合、PMCF 需求和关键评价问题"],
    ["临床评价计划", "确定评价范围、数据来源、方法学和接受准则"],
    ["SOTA 文献检索方案/报告", "建立适用疾病/技术现状、风险获益和临床基准"],
    ["等同/申报产品文献检索", "识别同类或等同器械证据；支撑性能与安全性论证"],
    ["不良事件和召回检索", "覆盖警戒数据库、召回信息和上市后风险信号"],
    ["临床数据分析 / CER", "整合证据，得出临床安全性、性能和获益-风险结论"],
  ];
  chain.forEach((c, i) => {
    const x = 0.75 + (i % 3) * 4.05;
    const y = 1.35 + Math.floor(i / 3) * 2.12;
    s.addShape(pptx.ShapeType.rect, { x, y, w: 3.45, h: 1.28, fill: { color: i === 5 ? C.pale2 : C.white }, line: { color: i === 5 ? C.cyan : C.line, width: i === 5 ? 1.1 : 0.7 } });
    addText(s, `0${i + 1}`, x + 0.18, y + 0.17, 0.45, 0.22, { fontSize: 10.5, bold: true, italic: true, color: C.cyan, margin: 0 });
    addText(s, c[0], x + 0.75, y + 0.18, 2.35, 0.22, { fontSize: 9.7, bold: true, color: C.dark, margin: 0 });
    addText(s, c[1], x + 0.75, y + 0.56, 2.28, 0.38, { fontSize: 7.1, color: C.text, margin: 0 });
    if (i % 3 !== 2) addLine(s, x + 3.52, y + 0.64, x + 3.86, y + 0.64, C.cyan, 1.1);
  });
  card(s, 0.75, 5.68, 11.55, 0.58, "启动会需重点确认", "是否主张等同器械路径、是否已有临床/上市后数据、是否存在欧盟上市经验，以及 NB 对同类/等同证据的接受预期。", { fill: C.pale, topBar: C.cyan, bodySize: 8.3 });
  addAgendaBar(s, 4);
  addFooter(s, page++);
}

{
  const s = pptx.addSlide();
  addHeader(s, "临床评价交付物建议分层管理：计划类文件先行，报告类文件随证据补齐迭代", "05 临床评价策略");
  table(s, 0.78, 1.24, 11.78, 0.38, [
    { t: "文件类型", w: 1.2 }, { t: "交付物", w: 2.4 }, { t: "关键输入", w: 2.5 }, { t: "会议需确认", w: 2.1 },
  ], [
    ["策略/计划", "临床开发策略和方案；临床评价计划", "产品预期用途、适应症、目标人群、禁忌症、风险管理", "临床路径与证据组合"],
    ["SOTA", "SOTA 文献检索方案；SOTA 文献检索报告；SOTA 评价和分析", "适用疾病/技术、指南、标准、同类产品、临床基准", "检索范围和评价终点"],
    ["产品证据", "等同器械/申报产品文献检索方案与报告", "候选器械、相似性资料、公开文献、性能数据", "等同主张可行性"],
    ["安全性", "不良事件和召回检索方案与报告", "EUDAMED/MAUDE/召回数据库、投诉和警戒记录", "检索数据库与时间范围"],
    ["综合结论", "临床数据分析；临床评价报告及附件", "所有临床/非临床/上市后证据与风险管理结论", "CER 审批和更新机制"],
  ], { bodySize: 7.1, headerSize: 7.8, rowGap: 0, fill2: "F7F9FA" });
  addText(s, "策略建议：若缺少直接临床数据，应强化 SOTA、同类产品证据、性能验证、风险控制和 PMS/PMCF 计划之间的一致性。", 0.78, 5.93, 11.3, 0.22, { fontSize: 9.2, bold: true, color: C.cyan, margin: 0 });
  addAgendaBar(s, 4);
  addFooter(s, page++);
}

{
  const s = pptx.addSlide();
  addHeader(s, "QMS 递交不是单纯上传程序文件，而是证明 MDR 相关控制已被体系吸收", "06 质量体系递交要求");
  card(s, 0.78, 1.24, 3.45, 1.6, "差距识别", [
    "现有体系文件和 MDR 体系要求差异识别",
    "输出需补齐/修订程序文件清单",
    "明确文件责任部门和生效计划",
  ], { topBar: C.cyan, fill: C.pale2, bodySize: 8 });
  card(s, 4.72, 1.24, 3.45, 1.6, "体系文件编制和导入", [
    "质量管理手册",
    "CE 控制程序、风险控制程序",
    "标签和语言、PMS、警戒、DHR 等控制程序",
  ], { topBar: C.dark, fill: C.white, bodySize: 8 });
  card(s, 8.66, 1.24, 3.45, 1.6, "递交与审核准备", [
    "递交文件版本冻结",
    "与公告机构/监管机构/客户沟通控制",
    "重大变更与 CAPA/记录追溯准备",
  ], { topBar: C.cyan, fill: C.white, bodySize: 8 });
  table(s, 0.78, 3.44, 11.78, 0.36, [
    { t: "MDR 体系文件包", w: 2.2 }, { t: "典型文件", w: 4.4 }, { t: "审核关注点", w: 2.4 },
  ], [
    ["质量与 CE 控制", "质量管理手册；CE 控制程序；风险控制程序", "职责、版本、生效、证据可追溯"],
    ["标签与上市后", "标签和语言控制程序；上市后监管控制程序；上市后警戒系统程序", "PMS/PMCF、警戒、趋势报告"],
    ["记录与沟通", "批记录和 DHR 管理程序；与公告机构/监管机构/客户沟通控制程序", "记录完整性、沟通闭环"],
    ["变更与其他", "产品或 QMS 重大变更告知程序；其他 MDR 相关控制程序", "变更分级、NB 通知和影响评估"],
  ], { bodySize: 7.1, headerSize: 7.8, rowGap: 0, fill2: "F7F9FA" });
  addAgendaBar(s, 5);
  addFooter(s, page++);
}

{
  const s = pptx.addSlide();
  addHeader(s, "下一步应以资料清单、责任分工和里程碑三件事锁住项目节奏", "07 下一步行动");
  table(s, 0.78, 1.22, 11.78, 0.38, [
    { t: "行动项", w: 2.1 }, { t: "负责人", w: 1.1 }, { t: "输入/输出", w: 3.8 }, { t: "建议时点", w: 1.4 },
  ], [
    ["确认产品范围与型号清单", "客户", "最终产品清单、型号差异说明、预期用途、分类依据", "T+3 工作日"],
    ["完成现有资料盘点", "双方", "技术文件、验证报告、风险管理、临床/上市后资料清单", "T+1 周"],
    ["输出技术文件差距清单", "顾问方", "Annex II/III 模块映射、缺口、责任人、优先级", "T+2 周"],
    ["确定临床评价路径", "双方", "CEP 初稿、SOTA 检索范围、同类/等同器械候选清单", "T+2 周"],
    ["确认 NB 沟通与递交计划", "客户", "NB 候选/已选机构、递交窗口、沟通机制", "T+3 周"],
    ["建立周度项目机制", "双方", "周会、问题台账、发补台账、版本控制规则", "立即启动"],
  ], { bodySize: 7.2, headerSize: 7.8, rowGap: 0, fill2: "F7F9FA" });
  addAgendaBar(s, 6);
  addFooter(s, page++);
}

{
  const s = pptx.addSlide();
  addHeader(s, "启动会后建议形成一张“待确认事项清单”，作为项目管理和发补预防工具", "07 下一步行动");
  const qs = [
    ["产品范围", "最终纳入 CE MDR 的型号、附件、证书描述是否已冻结？"],
    ["法规路径", "IIb / IIa 分类依据和适用 MDR 规则是否已有内部确认？"],
    ["技术证据", "关键性能、灭菌、包装、货架期、电安全/机械性能验证是否完整？"],
    ["临床证据", "是否主张等同器械？是否已有同类产品、投诉、不良事件、召回数据？"],
    ["QMS", "MDR 相关程序文件是否已建立并生效？是否可提供执行记录？"],
    ["NB", "是否已确定 NB？是否已有沟通记录、报价、审核窗口或资料格式要求？"],
  ];
  qs.forEach((q, i) => {
    const x = 0.78 + (i % 2) * 5.95;
    const y = 1.28 + Math.floor(i / 2) * 1.42;
    s.addShape(pptx.ShapeType.rect, { x, y, w: 5.35, h: 0.94, fill: { color: i % 2 === 0 ? C.white : C.pale }, line: { color: C.line } });
    addText(s, q[0], x + 0.2, y + 0.17, 1.05, 0.18, { fontSize: 9.5, bold: true, color: C.cyan, margin: 0 });
    addText(s, q[1], x + 1.38, y + 0.17, 3.65, 0.33, { fontSize: 8.2, color: C.text, margin: 0 });
  });
  card(s, 0.78, 5.74, 11.3, 0.52, "建议会后交付", "会议纪要、确认事项台账、资料清单、技术文件目录、首版项目计划、下一次例会议题。", { fill: C.pale2, topBar: C.cyan, bodySize: 8.2 });
  addAgendaBar(s, 6);
  addFooter(s, page++);
}

{
  const s = pptx.addSlide();
  addHeader(s, "附录：服务范围和交付物可作为合同范围与项目启动资料清单的共同基础", "Appendix");
  table(s, 0.78, 1.18, 11.78, 0.36, [
    { t: "模块", w: 1.3 }, { t: "服务范围", w: 3.7 }, { t: "交付文件", w: 2.7 },
  ], [
    ["注册服务", "制定认证计划；CE 技术文件辅导/编制/审核；CE 技术文件递交；CE 认证跟踪和沟通；制定发补策略；项目管理", "认证计划；认证文件；发补通知书；发补计划；发补文件"],
    ["临床评价", "临床开发策略和方案；临床评价计划；SOTA 文献检索；等同器械/申报产品检索；不良事件和召回检索；临床数据分析；临床评价报告", "CEP；检索方案/报告；SOTA 分析；CER 及附件"],
    ["MDR 体系辅导", "现有体系文件和 MDR 要求差异识别；辅导体系文档编制和导入", "质量管理手册；CE 控制程序；风险控制程序；PMS/警戒/DHR/沟通/重大变更等程序"],
  ], { bodySize: 7, headerSize: 7.8, rowGap: 0, fill2: "F7F9FA" });
  card(s, 0.78, 5.13, 11.78, 0.72, "使用建议", "本附录用于启动会快速对齐，不替代最终认证计划。正式计划需根据 NB、产品资料完整性和客户内部资源进一步细化。", { fill: C.pale, topBar: C.dark, bodySize: 8.2 });
  addFooter(s, page++);
}

pptx.writeFile({ fileName: "outputs/CE_MDR_项目启动会_Agenda_麦肯锡风格.pptx" });
