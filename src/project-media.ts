import type { Identity } from './input.ts';

export function renderProjectMedia(root:HTMLElement,identity:Identity){
  root.replaceChildren();
  const photos=identity.photos??[],files=identity.sourceFiles??[];
  if(photos.length){
    const gallery=document.createElement('div');gallery.className='project-gallery';
    for(const photo of photos){const figure=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');img.src=photo.src;img.alt=photo.name;img.loading='lazy';caption.textContent=photo.name;figure.append(img,caption);gallery.append(figure);}
    root.append(gallery);
  }
  const sources=files.length?files:identity.milestones?.flatMap(commit=>(commit.changes??[]).map(file=>({path:`${commit.sha.slice(0,7)} / ${file.path}`,text:file.patch,truncated:file.truncated})))??[];
  if(sources.length){
    const label=document.createElement('label'),select=document.createElement('select'),pre=document.createElement('pre'),note=document.createElement('small');
    label.textContent='翻看项目原件';label.append(select);pre.tabIndex=0;pre.className='source-preview';
    for(const [index,file] of sources.entries()){const option=document.createElement('option');option.value=String(index);option.textContent=file.path;select.append(option);}
    const show=()=>{const file=sources[Number(select.value)];pre.textContent=file.text||'这份文件没有可展示的内容。';note.textContent=file.truncated?'所选文件的截取片段':'所选文件原文';};
    select.addEventListener('change',show);show();root.append(label,pre,note);
  }else{const empty=document.createElement('p');empty.className='note';empty.textContent='可以添加一张项目截图，或从资料入口带来 README 与代码。';root.append(empty);}
}

export async function readProjectPhoto(file:File):Promise<{name:string;src:string}>{
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('请选择 5 MB 以内的 PNG、JPEG 或 WebP 图片。');
  const url=URL.createObjectURL(file),img=new Image();
  try{
    img.src=url;await img.decode().catch(()=>{throw new Error('这张图片没能读出来，请换一张 PNG、JPEG 或 WebP。');});
    if(img.naturalWidth*img.naturalHeight>24000000)throw new Error('图片尺寸过大，请先缩小后添加。');
    const canvas=document.createElement('canvas'),scale=Math.min(1,1200/Math.max(img.naturalWidth,img.naturalHeight));
    canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const context=canvas.getContext('2d');if(!context)throw new Error('暂时无法读取图片，请重试。');context.drawImage(img,0,0,canvas.width,canvas.height);
    return {name:Array.from(file.name).slice(0,100).join(''),src:canvas.toDataURL('image/png')};
  }finally{URL.revokeObjectURL(url);}
}
