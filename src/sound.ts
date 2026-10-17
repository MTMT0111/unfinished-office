export class Sound {
  context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private nodes = new Set<OscillatorNode>();
  muted = false;
  constructor() {
    try { this.muted = localStorage.getItem('unfinished-office-muted') === 'true'; } catch { /* 设置不可保存时仍可静音。 */ }
  }
  async unlock(): Promise<boolean> {
    if (this.muted) return true;
    try {
      if (!this.context) { this.context=new AudioContext();this.gain=this.context.createGain();this.gain.gain.value=.32;this.gain.connect(this.context.destination); }
      await this.context.resume();
      return this.context.state==='running';
    } catch { return false; }
  }
  setMuted(value:boolean) {
    this.muted=value;
    if(this.gain)this.gain.gain.value=value?0:.32;
    if(value)this.stop();
    try {localStorage.setItem('unfinished-office-muted',String(value));}catch{/* 无存储权限时保留本次设置。 */}
  }
  private note(frequency:number,length:number,volume:number,type:OscillatorType='sine',endFrequency?:number) {
    if(this.muted||!this.context||!this.gain||this.context.state!=='running')return;
    const ctx=this.context,osc=ctx.createOscillator(),envelope=ctx.createGain(),now=ctx.currentTime;
    osc.type=type;osc.frequency.setValueAtTime(frequency,now);
    if(endFrequency)osc.frequency.exponentialRampToValueAtTime(endFrequency,now+length);
    envelope.gain.setValueAtTime(0,now);envelope.gain.linearRampToValueAtTime(volume,now+.012);envelope.gain.exponentialRampToValueAtTime(.0001,now+length);
    osc.connect(envelope);envelope.connect(this.gain);this.nodes.add(osc);
    osc.onended=()=>{this.nodes.delete(osc);osc.disconnect();envelope.disconnect();};
    osc.start();osc.stop(now+length+.03);
  }
  tick(time:number,previous:number) {
    const beat=Math.floor(time/.8);
    if(beat!==Math.floor(previous/.8)){
      const notes=[196,0,233.08,293.66,0,261.63,233.08,0,174.61,0,196,0];
      const frequency=notes[beat%notes.length];if(frequency)this.note(frequency,.65,.14,'sine');
    }
  }
  step(push=false){this.note(push?140:240,.06,.08,'triangle',push?95:180);}
  switch(){this.note(440,.1,.1,'sine',660);}
  found(){this.note(660,.22,.13,'sine',880);}
  win(){this.note(523.25,.4,.14);this.note(659.25,.5,.1);this.note(783.99,.65,.08);}
  blocked(){this.note(110,.06,.06,'triangle',90);}
  lamp(){this.note(750,.06,.2,'triangle',150);}
  stop(){for(const node of this.nodes){try{node.stop();}catch{/* 已结束音源无需再停止。 */}node.disconnect();}this.nodes.clear();}
  suspend(){this.stop();void this.context?.suspend().catch(()=>{});}
}
