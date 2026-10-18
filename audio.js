(function (global) {
  const AudioBus = {
    ctx: null,
    muted: false,
    unlocked: false,
    master: null,
    musicEnabled: true,
    heartbeatEnabled: true,
    paused: false,
    scene: 'boot',
    scheduler: null,
    musicBus: null,
    nextChord: 0,
    nextBell: 0,
    nextHeart: 0,
    chordIndex: 0,
    heartBuffers: null,
    heartIndex: 0,

    loadHeartbeat() {
      if(this.heartLoading)return this.heartLoading;
      const button=document.getElementById('heartbeatBtn');
      if(button)button.textContent='心音加载中';
      this.heartLoading=fetch('./heart-original.ogg')
        .then(response=>{if(!response.ok)throw new Error('Recording unavailable');return response.arrayBuffer()})
        .then(bytes=>this.ctx.decodeAudioData(bytes))
        .then(original=>{
          const rate=original.sampleRate,mono=new Float32Array(original.length);
          for(let channel=0;channel<original.numberOfChannels;channel++){
            const data=original.getChannelData(channel);
            for(let i=0;i<mono.length;i++)mono[i]+=data[i]/original.numberOfChannels;
          }
          const windowSize=Math.round(rate*.018);
          let best=0,bestAt=Math.round(rate*.12);
          for(let i=Math.round(rate*.12);i<Math.min(mono.length-rate,rate*1.25);i+=Math.round(rate*.005)){
            let energy=0;for(let k=0;k<windowSize;k++)energy+=mono[i+k]*mono[i+k];
            if(energy>best){best=energy;bestAt=i}
          }
          const from=Math.max(0,bestAt-Math.round(rate*.06));
          const length=Math.min(Math.round(rate*.7),mono.length-from);
          const buffer=this.ctx.createBuffer(1,length,rate),pcm=buffer.getChannelData(0);
          let peak=0;for(let i=0;i<length;i++)peak=Math.max(peak,Math.abs(mono[from+i]));
          const gain=peak>0?.86/peak:1;
          for(let i=0;i<length;i++)pcm[i]=mono[from+i]*gain*Math.max(0,Math.min(1,i/(rate*.006),(length-1-i)/(rate*.025)));
          this.heartBuffers=[buffer];
          if(button)button.textContent=this.heartbeatEnabled?'心跳 开':'心跳 关';
        }).catch(error=>{
          console.warn('Real heart recording could not be loaded',error);
          this.heartLoading=null;
          if(button){button.textContent='心音未加载';button.title='请使用本地服务器或 HTTPS 后刷新；不会改用合成心跳';}
        });
      return this.heartLoading;
    },

    unlock() {
      if (!this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.22;
        this.master.connect(this.ctx.destination);
        this.musicBus=this.ctx.createGain();
        this.musicBus.gain.value=this.musicEnabled?.38:0;
        const filter=this.ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1400;
        const delay=this.ctx.createDelay(2);delay.delayTime.value=.48;
        const feedback=this.ctx.createGain();feedback.gain.value=.28;
        const wet=this.ctx.createGain();wet.gain.value=.2;
        this.musicBus.connect(filter);filter.connect(this.master);filter.connect(delay);delay.connect(feedback);feedback.connect(delay);delay.connect(wet);wet.connect(this.master);
        this.scheduler=setInterval(()=>this.schedule(),120);
        window.addEventListener('pagehide',()=>{clearInterval(this.scheduler);this.scheduler=null;if(this.ctx)this.ctx.close();});
        document.addEventListener('visibilitychange',()=>this.setPaused(document.hidden));
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
      this.unlocked = true;
      this.loadHeartbeat();
      this.schedule();
    },

    setMuted(muted) {
      this.muted = muted;
      if (this.master) this.master.gain.value = muted || this.paused ? 0 : 0.22;
    },

    setMusicEnabled(enabled) {
      this.musicEnabled=enabled;
      if(this.musicBus)this.musicBus.gain.setTargetAtTime(enabled&&!this.paused?.38:0,this.ctx.currentTime,.3);
    },

    setPaused(paused) {
      this.paused=paused;
      if(this.master)this.master.gain.setTargetAtTime(paused||this.muted?0:.22,this.ctx.currentTime,.15);
      if(!paused&&this.ctx){this.nextHeart=this.ctx.currentTime+1;this.nextChord=this.ctx.currentTime+.2;this.nextBell=this.ctx.currentTime+1;}
    },

    setScene(scene) {
      this.scene=scene;
      if(this.musicBus)this.musicBus.gain.setTargetAtTime(this.musicEnabled?(scene==='farewell'?.14:.38):0,this.ctx.currentTime,.8);
    },

    musicTone(freq,start,length,volume,type='sine') {
      const osc=this.ctx.createOscillator(),env=this.ctx.createGain();
      osc.type=type;osc.frequency.value=freq;osc.detune.value=Math.sin(freq)*3;
      env.gain.setValueAtTime(.0001,start);
      env.gain.exponentialRampToValueAtTime(volume,start+Math.min(1.3,length*.25));
      env.gain.exponentialRampToValueAtTime(.0001,start+length);
      osc.connect(env);env.connect(this.musicBus);osc.start(start);osc.stop(start+length+.05);
      osc.onended=()=>{osc.disconnect();env.disconnect()};
    },

    schedule() {
      if(!this.unlocked||this.paused||!this.ctx||this.ctx.state!=='running')return;
      const t=this.ctx.currentTime;
      if(t>=this.nextChord){
        // Original slow pentatonic score: four evolving suspended chords.
        const chords=[[130.81,196,293.66],[110,164.81,261.63],[98,146.83,220],[116.54,174.61,261.63]];
        const chord=chords[this.chordIndex++%chords.length];
        chord.forEach((f,i)=>this.musicTone(f,t+.02+i*.06,7.8,.11,i===0?'sine':'triangle'));
        this.nextChord=t+5.8;
      }
      if(t>=this.nextBell){
        const notes=[523.25,587.33,783.99,659.25,440,587.33];
        this.musicTone(notes[this.chordIndex%notes.length],t+.02,2.6,.065);
        this.nextBell=t+2.4;
      }
      if(this.scene!=='sync'&&this.scene!=='farewell'&&t>=this.nextHeart){this.beat();this.nextHeart=t+(this.scene==='reveal'?1.05:1.6)}
    },

    tone(freq, duration, type, gain) {
      if (!this.unlocked || this.muted || !this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain || 0.4, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + duration + 0.02);
      osc.onended=()=>{osc.disconnect();g.disconnect()};
    },

    beat() {
      if(!this.heartbeatEnabled||!this.unlocked||this.muted||this.paused||!this.ctx)return;
      if(!this.heartBuffers)return;
      const source=this.ctx.createBufferSource();
      source.buffer=this.heartBuffers[(this.heartIndex++)%this.heartBuffers.length];
      source.connect(this.master);source.start(this.ctx.currentTime);
      source.onended=()=>source.disconnect();
    },

    hit(side) {
      this.tone(side === "light" ? 392 : 262, 0.09, "triangle", 0.28);
    },

    mine() {
      this.tone(140, 0.22, "sawtooth", 0.2);
      this.tone(90, 0.3, "sine", 0.35);
    },

    reveal() {
      this.tone(196, 0.4, "sine", 0.2);
      this.tone(247, 0.5, "triangle", 0.16);
    },

    success() {
      this.tone(262, 0.35, "sine", 0.22);
      this.tone(330, 0.45, "sine", 0.18);
      this.tone(392, 0.6, "triangle", 0.14);
    },

    fail() {
      this.tone(110, 0.4, "sawtooth", 0.12);
      this.tone(82, 0.5, "sine", 0.2);
    },
  };

  global.AudioBus = AudioBus;
})(window);


