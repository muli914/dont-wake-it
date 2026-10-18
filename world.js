(function (global) {
  const { THREE } = global;

  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeMountain() {
    const segments=72,rings=34,vertices=[],colors=[],indices=[];
    const base=new THREE.Color('#405446'),rock=new THREE.Color('#839084'),moss=new THREE.Color('#607c53');
    const surface=(x,z,r)=>{
      const peaks=Math.max(3.1*Math.exp(-((x+.45)**2/.5+(z+.2)**2/.58)),2.5*Math.exp(-((x-.67)**2/.42+(z+.38)**2/.5)),1.85*Math.exp(-((x+.95)**2/.45+(z-.45)**2/.6)),1.95*Math.exp(-((x-.55)**2/.6+(z-.65)**2/.4)));
      const ridge=(Math.sin(x*9+z*3)*.075+Math.sin(z*13-x*5)*.045+Math.abs(Math.sin(x*5-z*4))*.14)*(1-r);
      return -1.02+peaks*Math.pow(Math.max(0,1-r*r),.45)+ridge;
    };
    const add=(x,y,z)=>{vertices.push(x,y,z);const high=Math.max(0,Math.min(1,(y+.5)/2.6));const c=base.clone().lerp(rock,high*.8).lerp(moss,Math.max(0,.38-high)*.8);colors.push(c.r,c.g,c.b)};
    add(0,surface(0,0,0),0);
    for(let r=1;r<=rings;r++)for(let j=0;j<segments;j++){
      const u=r/rings,t=j/segments*Math.PI*2,edge=1+.065*Math.sin(t*5)+.035*Math.cos(t*9);
      const x=Math.cos(t)*2.18*u*edge,z=Math.sin(t)*1.62*u*edge;
      add(x,surface(x,z,u),z);
    }
    for(let j=0;j<segments;j++)indices.push(0,1+(j+1)%segments,1+j);
    for(let r=1;r<rings;r++)for(let j=0;j<segments;j++){
      const a=1+(r-1)*segments+j,b=1+(r-1)*segments+(j+1)%segments,c=1+r*segments+j,d=1+r*segments+(j+1)%segments;
      indices.push(a,b,c,b,d,c);
    }
    const skirt=vertices.length/3;
    for(let j=0;j<segments;j++){const i=1+(rings-1)*segments+j;add(vertices[i*3],-1.16,vertices[i*3+2])}
    for(let j=0;j<segments;j++){const a=1+(rings-1)*segments+j,b=1+(rings-1)*segments+(j+1)%segments;indices.push(a,b,skirt+j,b,skirt+(j+1)%segments,skirt+j)}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
    const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.93,metalness:.015,flatShading:true,side:THREE.DoubleSide}));mesh.position.y=.15;return mesh;
  }

  function heartShape() {
    const shape = new THREE.Shape();
    const n = 72;
    for (let i = 0; i <= n; i += 1) {
      const t = (i / n) * Math.PI * 2;
      const x = 16 * Math.sin(t) ** 3;
      const y =
        13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t);
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    return shape;
  }

  function makeHeart() {
    const geo = new THREE.ExtrudeGeometry(heartShape(), {
      depth: 8,
      bevelEnabled: true,
      bevelThickness: 2.2,
      bevelSize: 1.6,
      bevelSegments: 3,
    });
    geo.center();
    geo.scale(0.018, 0.018, 0.018);
    const mat = new THREE.MeshStandardMaterial({
      color: "#c45b5b",
      emissive: "#4a1218",
      roughness: 0.45,
      metalness: 0.08,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 0.42, 1.55);
    return mesh;
  }

  function makeVines(root) {
    const vines=[],ray=new THREE.Raycaster();root.updateMatrixWorld(true);
    for(let i=0;i<9;i++){
      const points=[];
      for(let j=0;j<14;j++){
        const angle=i/9*Math.PI*2+Math.sin(j*.5+i)*.09,r=.36+j*.035;
        const x=Math.cos(angle)*2.05*r,z=Math.sin(angle)*1.53*r;
        ray.set(new THREE.Vector3(x,5,z),new THREE.Vector3(0,-1,0));
        const hit=ray.intersectObject(root,false)[0];
        if(hit){const p=root.worldToLocal(hit.point.clone());p.y+=.025;points.push(p)}
      }
      if(points.length<3)continue;
      const mesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),32,.015,5,false),new THREE.MeshStandardMaterial({color:0x51473f,emissive:0x160d10,roughness:.95}));
      root.add(mesh);vines.push(mesh);
    }
    return vines;
  }

  function makeWave() {
    const geo = new THREE.RingGeometry(0.2, 0.26, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: "#e7d7a1",
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2.4;
    mesh.position.set(0, 0.15, 1.7);
    return mesh;
  }

  function makePlants(mountain) {
    const plants=[],random=mulberry32(2026),ray=new THREE.Raycaster();
    const stemGeo=new THREE.CylinderGeometry(.008,.014,.36,5);stemGeo.translate(0,.18,0);
    const leafGeo=new THREE.SphereGeometry(1,6,4),budGeo=new THREE.IcosahedronGeometry(.035,1);
    const greens=[0x86ad62,0x609766,0x9bbf7c,0x66a298,0x839e62];
    const petals=[0xf0c5ae,0xe4d18d,0xc6b5e9,0xf0dfc2,0x9dced0,0xe7a8bf];
    const foliage=greens.map(color=>new THREE.MeshStandardMaterial({color,roughness:.72,emissive:0x203a1d,emissiveIntensity:.35}));
    const flowers=petals.map(color=>new THREE.MeshStandardMaterial({color,roughness:.5,emissive:color,emissiveIntensity:.18}));
    const centerMat=new THREE.MeshStandardMaterial({color:0xeedc91,emissive:0xa7843e,emissiveIntensity:.35});
    mountain.updateMatrixWorld(true);
    for(let i=0;i<170;i++){
      const angle=random()*Math.PI*2,radius=Math.sqrt(random())*.94;
      const x=Math.cos(angle)*2.1*radius,z=Math.sin(angle)*1.55*radius;
      ray.set(new THREE.Vector3(x,5,z),new THREE.Vector3(0,-1,0));
      const hit=ray.intersectObject(mountain,false)[0];if(!hit)continue;
      const root=new THREE.Group(),shoot=new THREE.Group();root.position.copy(mountain.worldToLocal(hit.point.clone()));root.position.y+=.008;
      const normal=hit.face.normal.clone();if(normal.y<0)normal.negate();
      const up=normal.lerp(new THREE.Vector3(0,1,0),.85).normalize();root.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),up);root.rotation.y=angle;
      root.add(shoot);const material=foliage[Math.floor(random()*foliage.length)],kind=Math.floor(random()*3);
      if(kind===0){
        shoot.add(new THREE.Mesh(stemGeo,material));
        for(let n=0;n<3;n++){const leaf=new THREE.Mesh(leafGeo,material);leaf.position.set((n%2?1:-1)*.065,.08+n*.08,0);leaf.scale.set(.11,.022,.043);leaf.rotation.z=(n%2?1:-1)*.45;shoot.add(leaf)}
        const flower=new THREE.Group();flower.position.y=.38;const petalMat=flowers[Math.floor(random()*flowers.length)];
        for(let n=0;n<5;n++){const a=n/5*Math.PI*2,petal=new THREE.Mesh(leafGeo,petalMat);petal.position.set(Math.cos(a)*.057,0,Math.sin(a)*.057);petal.scale.set(.065,.024,.038);petal.rotation.y=-a;flower.add(petal)}
        flower.add(new THREE.Mesh(budGeo,centerMat));shoot.add(flower);
      }else if(kind===1){
        for(let n=0;n<6;n++){const blade=new THREE.Mesh(leafGeo,material),a=n*2.4;blade.position.set(Math.cos(a)*.035,.13+random()*.05,Math.sin(a)*.035);blade.scale.set(.018,.18+random()*.09,.025);blade.rotation.set(Math.sin(a)*.3,0,Math.cos(a)*.35);shoot.add(blade)}
      }else{
        for(let n=0;n<6;n++){const leaf=new THREE.Mesh(leafGeo,material),a=n*2.4;leaf.position.set(Math.cos(a)*.08,.09+n*.028,Math.sin(a)*.08);leaf.scale.set(.09,.065,.075);shoot.add(leaf)}
        if(i%2===0){const bud=new THREE.Mesh(budGeo,flowers[Math.floor(random()*flowers.length)]);bud.position.y=.28;shoot.add(bud)}
      }
      const size=.6+random()*.85;root.scale.setScalar(size);shoot.scale.setScalar(.001);mountain.add(root);
      plants.push({root,shoot,kind,side:i%2===0?'light':'shadow',growth:0,target:0,phase:random()*6.28});
    }
    return plants;
  }

  const World = {
    renderer: null,
    scene: null,
    camera: null,
    mountain: null,
    heart: null,
    vines: [],
    wave: null,
    clock: new THREE.Clock(),
    pulse: 0,
    shake: 0,
    faction: null,
    stability: 35,
    wounded: 0,
    sceneState: 'boot',
    cameraDistance: 8.3,
    targetDistance: 8.3,
    mountainYaw: -.18,
    mountainTilt: 0,
    dragVelocity: 0,
    mountainDrag: null,
    plants: [],
    lastPlantSync: -100,
    plantCursor: {light:0,shadow:0},
    plantsPaused: false,

    init(container) {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setClearColor(0x081018, 1);
      container.appendChild(this.renderer.domElement);
      this.enableMountainDrag();

      this.scene = new THREE.Scene();
      this.scene.fog = new THREE.Fog(0x081018, 6, 16);

      this.camera = new THREE.PerspectiveCamera(
        42,
        window.innerWidth / window.innerHeight,
        0.1,
        40
      );
      this.camera.position.set(0, 1.5, 6.2);

      const hemi = new THREE.HemisphereLight(0xc9ddd8, 0x25352b, 1.4);
      const key = new THREE.DirectionalLight(0xffe6b8, 1.7);
      key.position.set(4, 6, 5);
      const fill = new THREE.DirectionalLight(0x6f7cff, 0.35);
      fill.position.set(-5, 1, 2);
      this.scene.add(hemi, key, fill);

      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(7, 48),
        new THREE.MeshStandardMaterial({ color: "#121a18", roughness: 1 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -1.15;
      this.scene.add(ground);

      this.mountain = makeMountain();
      this.heart = makeHeart();
      this.heart.visible = false;
      this.wave = makeWave();
      this.scene.add(this.mountain, this.heart, this.wave);
      this.vines = makeVines(this.mountain);
      this.plants = makePlants(this.mountain);

      const dustGeometry = new THREE.BufferGeometry();
      const dust = new Float32Array(210 * 3);
      const random = mulberry32(37);
      for (let i = 0; i < dust.length; i += 3) {
        dust[i] = (random() - .5) * 12;
        dust[i + 1] = random() * 6 - 1;
        dust[i + 2] = (random() - .5) * 8;
      }
      dustGeometry.setAttribute('position', new THREE.BufferAttribute(dust, 3));
      this.dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({color:0xcab88e,size:.018,transparent:true,opacity:.45,depthWrite:false}));
      this.scene.add(this.dust);
      this.rimLight = new THREE.PointLight(0x8faec7, 8, 12);
      this.rimLight.position.set(-2,2,-2);
      this.scene.add(this.rimLight);
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.25;
      this.resize();

      window.addEventListener("resize", () => this.resize());
      this.loop();
    },

    resize() {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      if (window.innerWidth > 760) this.camera.setViewOffset(window.innerWidth,window.innerHeight,-window.innerWidth*.16,0,window.innerWidth,window.innerHeight);
      else this.camera.clearViewOffset();
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    },

    enableMountainDrag() {
      const canvas=this.renderer.domElement;
      canvas.style.touchAction='none';
      const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
      const hit=e=>{
        if(!this.mountain||(global.Exploration&&global.Exploration.active))return false;
        const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
        ray.setFromCamera(pointer,this.camera);return ray.intersectObject(this.mountain,false).length>0;
      };
      canvas.addEventListener('pointerdown',e=>{
        if(!hit(e))return;
        this.mountainDrag={id:e.pointerId,x:e.clientX,y:e.clientY};this.dragVelocity=0;
        canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';
      });
      canvas.addEventListener('pointermove',e=>{
        if(this.mountainDrag&&this.mountainDrag.id===e.pointerId){
          const dx=e.clientX-this.mountainDrag.x,dy=e.clientY-this.mountainDrag.y;
          this.mountainYaw+=dx*.008;this.mountainTilt=Math.max(-.13,Math.min(.2,this.mountainTilt+dy*.002));
          this.dragVelocity=Math.max(-1.5,Math.min(1.5,dx*.08));this.mountainDrag.x=e.clientX;this.mountainDrag.y=e.clientY;
        }else canvas.style.cursor=hit(e)?'grab':'default';
      });
      const release=e=>{if(this.mountainDrag?.id===e.pointerId){this.mountainDrag=null;canvas.style.cursor='grab'}};
      canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
      canvas.addEventListener('dblclick',e=>{if(hit(e)){this.mountainYaw=-.18;this.mountainTilt=0;this.dragVelocity=0}});
      window.addEventListener('blur',()=>{this.mountainDrag=null;this.dragVelocity=0});
    },

    setSceneState(state) {
      this.sceneState = state;
      if (state==='boot'||state==='sync') {
        this.plants.forEach(p=>{p.target=0;if(state==='boot')p.growth=0});
        this.lastPlantSync=-100;
        this.plantsPaused=false;
      }
      if(state==='boot')this.plants.forEach(p=>p.target=p.kind===1?.16:.08);
      if(state==='ending_ok'||state==='farewell')this.plants.forEach(p=>p.target=1);
      this.targetDistance = state === 'sync' ? 7.1 : state === 'farewell' ? 10.5 : state === 'ending_ok' ? 8.7 : 8.3;
      if (state === 'boot') {
        this.faction = null;
        this.renderer.setClearColor(0x081018, 1);
        this.scene.fog.color.set(0x081018);
      }
    },

    setFaction(faction) {
      this.faction = faction;
      const fog = faction === "light" ? 0x1a1710 : 0x0c1018;
      this.scene.fog.color.set(fog);
      this.renderer.setClearColor(fog, 1);
    },

    showHeart(show) {
      this.heart.visible = show;
    },

    mineBurst() {
      this.shake = 1;
      this.wounded = 1;
      this.showHeart(true);
    },

    onBeat(strength) {
      this.pulse = Math.max(this.pulse, 0.85 + strength * 0.15);
      this.wave.material.opacity = 0.7;
      this.wave.scale.set(1, 1, 1);
    },

    setStability(value) {
      this.stability = value;
    },

    plantInput(side) {
      const choices=this.plants.filter(p=>p.side===side);
      if(!choices.length)return;
      for(let i=0;i<4;i++){
        const plant=choices[(this.plantCursor[side]++)%choices.length];
        plant.target=Math.min(1,Math.max(plant.target,plant.growth)+.4);
      }
    },

    plantBeat(delta) {
      if(delta>0){
        this.lastPlantSync=this.clock.elapsedTime;
        this.plants.forEach(p=>p.target=Math.min(1,p.target+.07+delta*.014));
      }else this.plants.forEach(p=>p.target=Math.max(0,p.target-.19));
    },

    updatePlants(dt,t) {
      const active=this.sceneState==='sync'&&!this.plantsPaused;
      for(const plant of this.plants){
        if(active && t-this.lastPlantSync>1.5)plant.target=Math.max(0,plant.target-dt*.25);
        if(this.sceneState==='ending_fail')plant.target=Math.max(0,plant.target-dt*.4);
        if(!this.plantsPaused)plant.growth+=(plant.target-plant.growth)*Math.min(1,dt*(plant.target>plant.growth?5:2));
        plant.root.visible=plant.growth>.008;
        plant.shoot.scale.set(Math.max(.001,Math.sqrt(plant.growth)),Math.max(.001,plant.growth),Math.max(.001,Math.sqrt(plant.growth)));
        plant.shoot.rotation.z=Math.sin(t*1.5+plant.phase)*.06*plant.growth;
      }
    },

    loop() {
      requestAnimationFrame(() => this.loop());
      const dt = Math.min(this.clock.getDelta(), 0.05);
      const t = this.clock.elapsedTime;
      if(global.Exploration && global.Exploration.active){global.Exploration.frame(dt,t,this.renderer);return;}
      this.updatePlants(dt,t);
      this.pulse = Math.max(0, this.pulse - dt * 2.4);
      this.shake = Math.max(0, this.shake - dt * 2.1);
      this.wounded = Math.max(0, this.wounded - dt * 0.35);
      this.cameraDistance += (this.targetDistance - this.cameraDistance) * Math.min(1,dt*1.2);
      this.camera.position.z = this.cameraDistance + (window.innerWidth < 760 ? 2.1 : 0);
      this.dust.rotation.y = t*.018;
      this.dust.position.y = Math.sin(t*.2)*.12;
      this.rimLight.intensity = 7 + Math.sin(t*.6)*1.2;

      const camX = Math.sin(t * 0.12) * 0.35 + (Math.random() * 2 - 1) * this.shake * 0.04;
      this.camera.position.x = camX;
      this.camera.position.y = 1.45 + Math.sin(t * 0.18) * 0.08;
      this.camera.lookAt(0, 0.45, 0);

      const beatScale = 1 + this.pulse * 0.18;
      const life = this.stability / 100;
      this.heart.scale.setScalar(beatScale * (0.92 + life * 0.12));
      this.heart.material.emissive.setHSL(0.0, 0.7, 0.08 + this.pulse * 0.12 + life * 0.05);
      this.heart.material.color.setHSL(0.0, 0.55, 0.28 + life * 0.18);

      if(!this.mountainDrag){this.mountainYaw+=this.dragVelocity*dt;this.dragVelocity*=Math.exp(-dt*4)}
      this.mountain.rotation.y = this.mountainYaw + Math.sin(t * 0.05) * 0.025;
      this.mountain.rotation.x = this.mountainTilt;
      this.mountain.position.y = 0.15 + Math.sin(t*.75)*.025 + this.pulse * 0.05 + this.wounded * 0.04;

      this.vines.forEach((vine, i) => {
        const recede = Math.max(0.12, 1 - life * 0.85);
        vine.scale.set(recede, recede, recede);
        vine.material.emissive.setHSL(0.97, 0.45, 0.04 + (1 - life) * 0.08);
        vine.material.opacity = 0.35 + recede * 0.65;
        vine.material.transparent = true;
        vine.rotation.y = Math.sin(t * 0.3 + i) * 0.04 * recede;
      });

      if (this.wave.material.opacity > 0) {
        this.wave.scale.addScalar(dt * 2.8);
        this.wave.material.opacity = Math.max(0, this.wave.material.opacity - dt * 1.4);
        const hue = this.faction === "shadow" ? 0.66 : 0.12;
        this.wave.material.color.setHSL(hue, 0.45, 0.72);
      }

      this.renderer.render(this.scene, this.camera);
    },
  };

  global.World = World;
})(window);
