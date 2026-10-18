(function (global) {
  const BPM = 72;
  const BEAT_MS = 60000 / BPM;
  const WINDOW_GOOD = 120;
  const WINDOW_OK = 200;
  const WINDOW_HIT = 280;
  const START_STABILITY = 35;
  const SUCCESS_AT = 85;
  const SUCCESS_BEATS = 6;
  const FAIL_AT = 8;
  const FAIL_BEATS = 4;

  const COPY = {
    light: {
      dilemmaTitle: "光族 · 光晶石短缺",
      dilemma:
        "地表的光正在变薄。族人把山体里的光晶石当作最后的燃料。你被派来开采一次，带回足够点亮一夜的碎片。",
      mineFeedback: "你凿下一块仍温热的光晶石。资源到手了——可山体跟着震了一下，像有什么东西在里面翻身。",
    },
    shadow: {
      dilemmaTitle: "影族 · 暗影矿短缺",
      dilemma:
        "夜不能再被织补。暗影矿几乎挖空，族人把这座山当成最后的矿脉。你只需开采一次，带回能续上炉火的矿渣。",
      mineFeedback: "暗影矿落入掌心，凉得像血。山体同时抽动，裂隙里漏出一声极低的搏动。",
    },
  };

  const els = {
    app: document.getElementById("app"),
    panel: document.getElementById("panel"),
    hud: document.getElementById("hud"),
    touch: document.getElementById("touchControls"),
    pause: document.getElementById("pauseOverlay"),
    muteBtn: document.getElementById("muteBtn"),
    startBtn: document.getElementById("startBtn"),
    fill: document.getElementById("stabilityFill"),
    num: document.getElementById("stabilityNum"),
    msg: document.getElementById("syncMsg"),
    pulse: document.getElementById("beatPulse"),
    btnLight: document.getElementById("btnLight"),
    btnShadow: document.getElementById("btnShadow"),
  };

  const Game = {
    state: "boot",
    faction: null,
    stability: START_STABILITY,
    goodStreak: 0,
    failStreak: 0,
    beatIndex: 0,
    nextBeatAt: 0,
    paused: false,
    pauseStartedAt: 0,
    remainingToBeat: 0,
    lastPress: { light: 0, shadow: 0 },
    consumed: { light: 0, shadow: 0 },
    raf: 0,
    cueBeatAt: 0,
    transitionId: 0,

    boot() {
      World.init(document.getElementById("stage"));
      els.muteBtn.addEventListener("click", () => this.toggleMute());
      document.getElementById('musicBtn').addEventListener('click',()=>{
        AudioBus.setMusicEnabled(!AudioBus.musicEnabled);
        const b=document.getElementById('musicBtn');b.textContent=AudioBus.musicEnabled?'配乐 开':'配乐 关';b.setAttribute('aria-pressed',String(AudioBus.musicEnabled));
      });
      document.getElementById('heartbeatBtn').addEventListener('click',()=>{
        AudioBus.heartbeatEnabled=!AudioBus.heartbeatEnabled;
        const b=document.getElementById('heartbeatBtn');b.textContent=AudioBus.heartbeatEnabled?'心跳 开':'心跳 关';b.setAttribute('aria-pressed',String(AudioBus.heartbeatEnabled));
      });
      document.addEventListener("keydown", (e) => this.onKey(e));
      els.btnLight.addEventListener("pointerdown", (e) => this.onTouch(e, "light"));
      els.btnShadow.addEventListener("pointerdown", (e) => this.onTouch(e, "shadow"));
      document.addEventListener("visibilitychange", () => this.onVisibility());
      window.addEventListener("blur", () => this.onVisibility());
      window.addEventListener("focus", () => this.onVisibility());
      els.panel.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-act]");
        if (btn) this.act(btn.dataset.act, btn.dataset.faction);
      });
      this.renderBoot();
    },

    toggleMute() {
      const next = !AudioBus.muted;
      AudioBus.setMuted(next);
      els.muteBtn.textContent = next ? "已静音" : "声音开";
      els.muteBtn.setAttribute("aria-pressed", String(next));
    },

    act(name, faction) {
      if (name === "start") this.start();
      if (name === "choose") this.choose(faction);
      if (name === "toMine") this.showMine();
      if (name === "mine") this.doMine();
      if (name === "toSync") this.enterSync();
      if (name === "retry") this.enterSync(true);
      if (name === "restart") this.restart();
      if (name === "leave") this.leave();
    },

    start() {
      AudioBus.unlock();
      this.enterExploration();
    },

    enterExploration() {
      this.state='explore';this.explorationDriven=true;this.faction='light';
      this.transitionId++;this.stopLoop();this.hidePanel();
      els.hud.hidden=true;els.touch.hidden=true;els.pause.hidden=true;
      els.app.dataset.state='explore';els.app.dataset.faction='';
      document.getElementById('chapterLabel').textContent='01 / 双光入山';
      World.showHeart(false);World.setSceneState('explore');
      AudioBus.setScene('explore');Exploration.start();
    },

    discoverCollection() {
      if(this.state!=='explore')return;
      this.state='mine';
      this.setPanel(`<p class="kicker">02 / 共同发现</p><h2>两束光，<br>同一处矿脉。</h2><p class="copy">你们沿着微光走进山谷，在同一处矿点相遇。金色晶石与幽蓝矿脉交织，像是从山体里缓缓渗出的光。</p><p class="copy">只取一点。两族都等着资源度过长夜。</p><div class="actions"><button class="primary" data-act="mine" type="button">一起开采 <span>↗</span></button></div>`);
    },

    choose(faction) {
      this.faction = faction;
      els.app.dataset.faction = faction;
      World.setFaction(faction);
      this.state = "dilemma";
      const copy = COPY[faction];
      this.setPanel(`
        <p class="kicker">资源困境</p>
        <h2>${copy.dilemmaTitle}</h2>
        <p class="copy">${copy.dilemma}</p>
        <div class="actions">
          <button class="primary" data-act="toMine" type="button">前往开采</button>
        </div>
      `);
    },

    showMine() {
      this.state = "mine";
      this.setPanel(`
        <p class="kicker">一次开采</p>
        <h2>山还被当作矿脉</h2>
        <p class="copy">只要一下。族人等着你把资源带回去。</p>
        <div class="actions">
          <button class="primary" data-act="mine" type="button">开采</button>
        </div>
      `);
    },

    doMine() {
      this.state = "reveal";
      World.mineBurst();
      AudioBus.mine();
      const copy = this.explorationDriven ? {mineFeedback:"两束光共同触碰晶体，矿石微微发热。山体突然收紧，地底传出一声低沉的心跳。"} : COPY[this.faction];
      this.setPanel(`
        <p class="kicker">资源到手</p>
        <h2>它不是山</h2>
        <p class="copy">${copy.mineFeedback}</p>
        <p class="copy">光晶石是汗，暗影矿是血。开采与怨恨正在伤害这头沉睡的巨物。目标不再是带走资源，而是稳住它的心跳。</p>
        <div class="actions">
          <button class="primary" data-act="toSync" type="button">去稳定心跳</button>
        </div>
      `);
      AudioBus.reveal();
    },

    enterSync(isRetry) {
      this.state = "sync";
      this.stability = START_STABILITY;
      this.goodStreak = 0;
      this.failStreak = 0;
      this.beatIndex = 0;
      this.cueBeatAt = 0;
      this.lastPress = { light: 0, shadow: 0 };
      this.consumed = { light: 0, shadow: 0 };
      this.paused = false;
      this.pendingInputs = { light: [], shadow: [] };
      els.pause.hidden = true;
      World.setStability(this.stability);
      World.showHeart(true);
      this.updateHud("A / L 唤起新芽；同步让植物生长，失拍则慢慢缩回。");
      els.hud.hidden = false;
      els.touch.hidden = false;
      this.setPanel(`
        <p class="kicker">${isRetry ? "再试一次" : "心脏大厅"}</p>
        <h2>同步心跳</h2>
        <p class="copy">A / L 都能唤起散落全山的花草。跟随心跳一起按，让花朵、草丛与灌木混生；失去同步，它们会慢慢缩回。按住山体拖动，可换个角度看花园。</p>
      `, true);
      this.nextBeatAt = performance.now() + BEAT_MS;
      this.stopLoop();
      this.loop();
    },

    restart() {
      if(global.Exploration && Exploration.active)Exploration.stop();
      this.state = "boot";
      this.faction = null;
      this.stability = START_STABILITY;
      els.app.dataset.faction = "";
      World.showHeart(false);
      World.setStability(this.stability);
      els.hud.hidden = true;
      els.touch.hidden = true;
      els.pause.hidden = true;
      this.stopLoop();
      this.renderBoot();
    },

    renderBoot() {
      this.setPanel(`
        <p class="kicker">PROLOGUE / 献给仍在沉睡的世界</p>
        <h1>别吵醒<span>它</span><em>LET IT DREAM</em></h1>
        <p class="lead">我们以为，那只是一座山。<br>直到第一块晶石落下，<br>大地传来了一声心跳。</p>
        <div class="actions">
          <button id="startBtn" class="primary" data-act="start" type="button">走入山中 <span>↗</span></button>
        </div>
        <p class="note">约 2 分钟的双人互动寓言<br>双人分屏探索 · WASD / 方向键移动<br>抵达矿点后，A / L 同步心跳</p>
      `);
    },

    setPanel(html, compact) {
      const id = ++this.transitionId;
      const apply = () => {
        if (id !== this.transitionId) return;
        els.panel.hidden = false;
        els.panel.classList.remove("is-leaving");
        els.panel.classList.toggle("is-compact", Boolean(compact));
        els.panel.innerHTML = html;
        els.app.dataset.state = this.state;
        const labels = {boot:'PROLOGUE / 序章',choose:'01 / 光与影',dilemma:'02 / 生存之需',mine:'03 / 一次开采',reveal:'04 / 它不是山',sync:'05 / 同一颗心',ending_ok:'EPILOGUE / 共同守护',ending_fail:'INTERLUDE / 再听一次',farewell:'GOOD NIGHT / 晚安'};
        document.getElementById('chapterLabel').textContent = labels[this.state] || '';
        if (World.setSceneState) World.setSceneState(this.state);
        AudioBus.setScene(this.state);
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches && els.panel.animate) els.panel.animate([{opacity:0,transform:'translateY(18px)',filter:'blur(5px)'},{opacity:1,transform:'translateY(0)',filter:'blur(0)'}],{duration:700,easing:'cubic-bezier(.2,.7,.3,1)'});
      };
      if (els.panel.innerHTML.trim() && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        els.panel.classList.add('is-leaving');
        setTimeout(apply, 220);
      } else apply();
    },

    hidePanel() {
      els.panel.hidden = true;
    },

    onKey(e) {
      if (global.Exploration && Exploration.onKey(e)) return;
      if (e.repeat) return;
      if (e.key === "a" || e.key === "A") this.press("light");
      if (e.key === "l" || e.key === "L") this.press("shadow");
    },

    onTouch(e, side) {
      e.preventDefault();
      this.press(side);
      const btn = side === "light" ? els.btnLight : els.btnShadow;
      btn.classList.add("is-hit");
      setTimeout(() => btn.classList.remove("is-hit"), 120);
    },

    press(side) {
      if (this.state !== "sync" || this.paused) return;
      const now = performance.now();
      this.lastPress[side] = now;
      this.pendingInputs[side].push(now);
      World.plantInput(side);
      AudioBus.hit(side);
    },

    quality(offset) {
      const a = Math.abs(offset);
      if (a <= WINDOW_GOOD) return "good";
      if (a <= WINDOW_OK) return "ok";
      if (a <= WINDOW_HIT) return "late";
      return "miss";
    },

    scoreBeat(now) {
      const beatTime = this.nextBeatAt;
      const read = (side) => {
        const candidates = this.pendingInputs[side].filter(t => Math.abs(t-beatTime) <= WINDOW_HIT);
        const t = candidates.sort((a,b)=>Math.abs(a-beatTime)-Math.abs(b-beatTime))[0];
        this.pendingInputs[side] = this.pendingInputs[side].filter(t => t > beatTime+WINDOW_HIT);
        if (!t || t === this.consumed[side]) return { hit: false, offset: 9999, t: 0 };
        const offset = t - beatTime;
        if (Math.abs(offset) > WINDOW_HIT) return { hit: false, offset, t };
        return { hit: true, offset, t };
      };
      const light = read("light");
      const shadow = read("shadow");
      if (light.hit) this.consumed.light = light.t;
      if (shadow.hit) this.consumed.shadow = shadow.t;

      const lq = light.hit ? this.quality(light.offset) : "miss";
      const sq = shadow.hit ? this.quality(shadow.offset) : "miss";
      const dt = light.hit && shadow.hit ? Math.abs(light.t - shadow.t) : 9999;

      let delta = -4;
      let label = "双方都错过了这一拍";
      if (lq !== "miss" && sq !== "miss") {
        if (lq === "good" && sq === "good" && dt <= 80) {
          delta = 6;
          label = "完全同步，心跳被轻轻托住";
        } else if (dt <= 120 && lq !== "late" && sq !== "late") {
          delta = 4;
          label = "很接近，光波开始合拢";
        } else {
          delta = 2;
          label = "都按到了，但还不够齐";
        }
      } else if (lq !== "miss" || sq !== "miss") {
        delta = -2;
        label = "只有一侧跟上，藤蔓仍缠着心脏";
      }

      this.stability = Math.max(0, Math.min(100, this.stability + delta));
      World.setStability(this.stability);
      World.plantBeat(delta);
      this.updateHud(label);

      if (this.stability >= SUCCESS_AT) this.goodStreak += 1;
      else this.goodStreak = 0;
      if (this.stability <= FAIL_AT) this.failStreak += 1;
      else this.failStreak = 0;

      if (this.goodStreak >= SUCCESS_BEATS) {
        this.win();
        return;
      }
      if (this.failStreak >= FAIL_BEATS) {
        this.lose();
      }

      void now;
    },

    updateHud(msg) {
      els.fill.style.width = `${this.stability}%`;
      els.num.textContent = String(Math.round(this.stability));
      if (msg) els.msg.textContent = msg;
    },

    win() {
      this.state = "ending_ok";
      this.stopLoop();
      els.hud.hidden = true;
      els.touch.hidden = true;
      World.setStability(100);
      AudioBus.success();
      this.setPanel(`
        <p class="kicker">EPILOGUE / 两族，同一颗心</p>
        <div class="ending-mark" aria-hidden="true">☼ <i>◌</i> ☾</div>
        <h2>它睡着了。<br>我们，终于听见彼此。</h2>
        <p class="copy">藤蔓退去，心跳渐缓。<br>光与影第一次不再争夺同一座山，<br>而是共同守护同一个梦。</p>
        <p class="ending-promise">减少开采 / 轮换资源 / 共同守护</p>
        <div class="actions">
          <button class="primary" data-act="leave" type="button">轻轻离开 <span>↗</span></button>
          <button class="ghost" data-act="restart" type="button">再听一次</button>
        </div>
      `);
    },

    lose() {
      this.state = "ending_fail";
      this.stopLoop();
      els.hud.hidden = true;
      els.touch.hidden = true;
      AudioBus.fail();
      this.setPanel(`
        <p class="kicker">心跳紊乱</p>
        <h2>还没有对齐</h2>
        <p class="copy">巨物仍在发抖，但还没有醒来。不必重看开场，从这一拍重新托住它。</p>
        <div class="actions">
          <button class="primary" data-act="retry" type="button">从心跳关重试</button>
        </div>
      `);
    },

    leave() {
      this.state = 'farewell';
      World.showHeart(false);
      this.setPanel(`<p class="kicker">GOOD NIGHT / 留一场梦给它</p><h2>山仍在呼吸。<br>故事，由你带走。</h2><p class="copy">愿我们取用世界时，<br>也记得听一听它的心跳。</p><div class="farewell-line"></div><p class="note">《别吵醒它》 · 光与影的共生寓言<br>感谢你，成为守梦者。</p><div class="actions"><button class="ghost" data-act="restart" type="button">重返山中 ↻</button></div>`);
    },

    shouldPauseClock() {
      if (document.hidden || document.visibilityState === "hidden") return true;
      if (typeof document.hasFocus === "function" && !document.hasFocus()) return true;
      return false;
    },

    onVisibility() {
      if(this.state==='explore'){Exploration.clearInput();AudioBus.setPaused(this.shouldPauseClock());return;}
      if (this.state !== "sync") return;
      if (this.shouldPauseClock()) {
        if (!this.paused) {
          this.paused = true;
          World.plantsPaused = true;
          AudioBus.setPaused(true);
          this.pauseStartedAt = performance.now();
          this.remainingToBeat = this.nextBeatAt - this.pauseStartedAt;
          els.pause.hidden = false;
        }
        return;
      }
      if (this.paused) {
        this.paused = false;
        World.plantsPaused = false;
        AudioBus.setPaused(false);
        els.pause.hidden = true;
        this.nextBeatAt = performance.now() + Math.max(200, this.remainingToBeat);
        this.cueBeatAt = 0;
        this.pendingInputs = { light: [], shadow: [] };
      }
    },

    loop() {
      this.raf = requestAnimationFrame(() => this.loop());
      if (this.state !== "sync" || this.paused) return;
      const now = performance.now();
      const until = this.nextBeatAt - now;
      const phase = 1 - Math.max(0, Math.min(1, until / BEAT_MS));
      els.pulse.style.transform = `scale(${0.35 + phase * 1.4})`;
      els.pulse.style.opacity = String(0.2 + phase * 0.7);
      if (now >= this.nextBeatAt && this.cueBeatAt !== this.nextBeatAt) {
        this.cueBeatAt = this.nextBeatAt;
        World.onBeat(0.5);
        AudioBus.beat();
      }
      if (now >= this.nextBeatAt + WINDOW_HIT) {
        this.scoreBeat(now);
        this.beatIndex += 1;
        this.nextBeatAt += BEAT_MS;
        if (now - this.nextBeatAt > BEAT_MS) this.nextBeatAt = now + BEAT_MS;
      }
    },

    stopLoop() {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
    },
  };

  Game.boot();
  global.Game = Game;
})(window);
