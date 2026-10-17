export type Source = 'user' | 'readme' | 'project' | 'analysis';
export type Fact = { value: string; source: Source | null; evidence: string; confirmed: boolean };
export type Prop = 'umbrella' | 'screen' | 'manuscript' | 'draft' | 'camera' | 'sprout' | 'record';
export type Palette = 'cream' | 'lavender' | 'mint';
export type Accessory = 'none' | 'bow' | 'hat';
export type Field = 'name' | 'purpose' | 'completed' | 'unfinished' | 'reason';
export type GitChange = { path:string; status:string; patch:string; truncated:boolean };
export type GitMilestone = {
  sha:string; subject:string; date:string; committedAt?:string; author?:string; coauthors?:string[]; repository?:string;
  changes?:GitChange[]; limited?:boolean;
  diary?:{text:string;path:string;quote:string}[];
};
export type Identity = {
  demo: boolean;
  facts: Record<Field, Fact>;
  prop: Prop;
  palette: Palette;
  accessory: Accessory;
  regret?: string;
  keywords?: { text:string; evidence:string; category:'purpose'|'built'|'next'|'tech' }[];
  milestones?: GitMilestone[];
  review?: { summary: string; items: { text:string; evidence:string }[]; limits:string[] };
};

export const fields: Field[] = ['name', 'purpose', 'completed', 'unfinished', 'reason'];
export const count = (value: string) => Array.from(value).length;
export const take = (value: string, max: number) => Array.from(value).slice(0, max).join('');
const fact = (value = '', source: Source = 'user'): Fact => ({ value, source: value ? source : null, evidence: value, confirmed: false });

export function suggestProp(text: string): Prop {
  if (/天气|气象|weather/i.test(text)) return 'umbrella';
  if (/音乐|歌曲|播客|唱片|音频|music|song|audio|podcast|spotify/i.test(text)) return 'record';
  if (/植物|花园|种植|园艺|种子|花草|greenhouse|garden|plant|botany|farming/i.test(text)) return 'sprout';
  if (/摄影|相册|照片|影像|摄像|相机|photo|camera|album|photography|video|film/i.test(text)) return 'camera';
  if (/小说|写作|稿纸|章节|绘画|笔记|日记|novel|writing/i.test(text)) return 'manuscript';
  if (/app|软件|程序|网站|工具|硬件|监测|应用|机器人|dashboard/i.test(text)) return 'screen';
  return 'draft';
}

export function parseInput(name: string, text: string, source: Source = 'user'): Identity {
  if (count(text) > 12000) throw new Error('介绍太长了。请保留 12,000 字以内，或只写它原本想做什么。');
  const values: Record<Field, Fact> = { name: fact(name.trim()), purpose: fact(), completed: fact(), unfinished: fact(), reason: fact() };
  let fence = '';
  const ordinary: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const marker = line.match(/^(`{3,}|~{3,})/);
    if (marker) { if (!fence) fence = marker[1][0]; else if (fence === marker[1][0]) fence = ''; continue; }
    if (fence) continue;
    if (!values.name.value && /^#\s+/.test(line)) values.name = fact(line.replace(/^#\s+/, '').trim(), source);
    const match = line.replace(/^[-*]\s+/, '').replace(/\*\*/g, '').match(/^(原本用途|用途|项目介绍|已完成|未完成|暂停原因)\s*[:：]\s*(.+)$/);
    if (match) {
      const key: Field = /用途|介绍/.test(match[1]) ? 'purpose' : match[1] === '已完成' ? 'completed' : match[1] === '未完成' ? 'unfinished' : 'reason';
      if (!/^(未说明|未知|无|暂无)[。.]?$/.test(match[2])) values[key] = fact(match[2].trim(), source);
    } else if (line && !/^(#|[!\[<]|[-*]\s)/.test(line)) ordinary.push(line);
  }
  // shortcut: 只提取明确字段；普通功能列表需用户确认，接入可靠语义提取时再扩展。
  if (!values.purpose.value && source === 'user' && ordinary.length && count(ordinary.join(' ')) <= 240) values.purpose = fact(ordinary.join(' '), source);
  return { demo:false, facts:values, prop:suggestProp(name + ' ' + text), palette:'cream', accessory:'none' };
}

export function confirmIdentity(draft: Identity, edits: Record<Field, string>, prop: string, palette: string, accessory: string, regret=draft.regret??''): Identity {
  if (!['umbrella','screen','manuscript','draft','camera','sprout','record'].includes(prop) || !['cream','lavender','mint'].includes(palette) || !['none','bow','hat'].includes(accessory)) throw new Error('请重新选择道具、颜色和配件。');
  const result = structuredClone(draft);
  if(count(regret.trim())>120)throw new Error('这句遗憾请留在 120 字以内。');
  result.regret=regret.trim();
  for (const key of fields) {
    const value = edits[key].trim();
    const max = key === 'name' ? 40 : 240;
    if (count(value) > max) throw new Error(`${key === 'name' ? '项目名' : '每条项目信息'}请控制在 ${max} 字以内。`);
    if (key === 'name' && !value) throw new Error('给它留一个名字吧。');
    const original = draft.facts[key];
    result.facts[key] = value === original.value ? { ...original, confirmed:true } : { ...fact(value), confirmed:true };
  }
  result.prop = prop as Prop; result.palette = palette as Palette; result.accessory = accessory as Accessory;
  return result;
}

export function example(which: 'weather' | 'novel'): Identity {
  const weather = which === 'weather';
  const name = weather ? '天气 App' : '写到第三章的小说';
  const text = weather
    ? '# 天气 App\n原本用途：输入城市，查看当前天气。\n已完成：城市输入界面和静态天气卡片。\n未完成：实时天气接口尚未接入。'
    : '# 写到第三章的小说\n原本用途：写一部关于夜班邮差的短篇小说。\n已完成：第一至第三章已有初稿。\n未完成：第四章只有标题，没有正文。';
  const result = parseInput('', text, 'readme');
  result.facts.name = fact(name, 'readme');
  result.demo = true;
  return result;
}

export async function readProjectFile(file: File): Promise<{ text: string; truncated: boolean }> {
  if (!/^(?:readme|.+\.(?:md|txt))$/i.test(file.name) || /(^|[._-])(env|credentials|id_rsa|id_ed25519|private[_-]?key)([._-]|$)/i.test(file.name)) throw new Error('请选择 README、.md 或 .txt 说明文件，不要选择凭据或密钥。');
  if (file.size > 256 * 1024) throw new Error('文件超过 256 KB。请改为粘贴一段简短介绍。');
  let text: string;
  try { text = new TextDecoder('utf-8', {fatal:true}).decode(await file.arrayBuffer()).replace(/^\uFEFF/, ''); }
  catch { throw new Error('无法读取这份 UTF-8 文本。请将介绍复制粘贴到输入框。'); }
  if (text.includes('\0') || /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/.test(text)) throw new Error('这看起来不是普通项目说明。请选择一份不含密钥的文字介绍。');
  if (!text.trim()) throw new Error('这份文件是空的。可以直接写一句介绍，或体验样例。');
  return { text:take(text,12000), truncated:count(text)>12000 };
}

export function sourceLabel(identity: Identity, f: Fact): string {
  if (!f.value) return '未说明';
  if (f.source === 'analysis') return f.confirmed ? 'API 整理 · 你已核对' : 'API 整理 · 待你核对';
  if (f.source === 'project') return '所选项目资料';
  return f.source === 'readme' ? (identity.demo ? '演示 README' : 'README 明确提到') : '你填写的信息';
}

export function memorialDetail(identity: Identity): { text: string; source: string } {
  const f = [identity.facts.completed, identity.facts.purpose, identity.facts.name].find(f => f.value && f.confirmed && f.source);
  if (!f) throw new Error('请先确认至少一个有来源的项目信息。');
  return { text:f.value, source:sourceLabel(identity,f) };
}

export function fiction(identity: Identity): { protest: string; finale: string; epitaph: string } {
  if (identity.prop === 'umbrella') return { protest:'预报说，我明天还能上线。', finale:'最后一次预报：局部放晴。', epitaph:'它预报过一个尚未到来的晴天。' };
  if (identity.prop === 'camera') return { protest:'底片还没来得及冲洗。', finale:'最后一张，留给出发之前。', epitaph:'它认真看过这个世界一眼。' };
  if (identity.prop === 'sprout') return { protest:'再多等一天，说不定就发芽。', finale:'替它浇下最后一滴水。', epitaph:'留给明天的一颗小种子。' };
  if (identity.prop === 'record') return { protest:'最后一首还没有播放完。', finale:'把最后的旋律转给你。', epitaph:'这一小段旋律，仍在耳边。' };
  if (identity.prop === 'manuscript') return identity.demo && identity.facts.completed.value === '第一至第三章已有初稿。' && identity.facts.unfinished.value === '第四章只有标题，没有正文。'
    ? { protest:'第四章只是还没选好开头。', finale:'前三章，请签收。', epitaph:'前三章已送达，第四章暂缓投递。' }
    : { protest:'句号可以晚一点再写吗？', finale:'这份记录，请收好。', epitaph:'故事停在这里，留下的仍可翻阅。' };
  if (identity.prop === 'screen') return { protest:'后台还有一个梦想没退出。', finale:'这一次，至少亮了一下。', epitaph:'屏幕熄了，那一点光曾经亮过。' };
  return { protest:'死亡状态能改成战略休眠吗？', finale:'只是一个想法，也认真鞠个躬。', epitaph:'尚未落成的构想，也留下一格。' };
}

export function safeFilename(name: string): string {
  const base = take(name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/[. ]+$/g, '').trim(),40);
  return `纪念-${base || 'project'}.png`;
}
