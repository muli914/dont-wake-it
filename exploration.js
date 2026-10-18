(function(global){
  const T=global.THREE;
  const Exploration={
    active:false,scene:null,players:[],keys:new Set(),touches:new Map(),ready:[false,false],cameraTargets:[],
    goal:{x:0,z:-22},radius:3.1,speed:3.8,
    init(){
      this.scene=new T.Scene();this.scene.background=new T.Color('#08141e');this.scene.fog=new T.FogExp2('#08141e',.026);
      this.scene.add(new T.HemisphereLight(0xb9d4d4,0x111c1e,1.6));
      const key=new T.DirectionalLight(0xe9cf9d,2.1);key.position.set(-5,10,5);this.scene.add(key);
      const floorGeo=new T.PlaneGeometry(28,65,28,65);floorGeo.rotateX(-Math.PI/2);
      const positions=floorGeo.attributes.position;
      for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i);positions.setY(i,Math.sin(x*1.1+z*.5)*.07+Math.cos(z*.6)*.06)}
      floorGeo.computeVertexNormals();
      const floor=new T.Mesh(floorGeo,new T.MeshStandardMaterial({color:0x1d3335,roughness:.95,flatShading:true}));floor.position.set(0,-.22,-13);this.scene.add(floor);
      const glowCanvas=document.createElement('canvas');glowCanvas.width=64;glowCanvas.height=64;
      const brush=glowCanvas.getContext('2d'),g=brush.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'#ffffff');g.addColorStop(.12,'#ffffffdd');g.addColorStop(.4,'#ffffff44');g.addColorStop(1,'#ffffff00');brush.fillStyle=g;brush.fillRect(0,0,64,64);this.glowTexture=new T.CanvasTexture(glowCanvas);
      this.players=[0xffd58a,0x9eafff].map((color,index)=>{
        const root=new T.Group();root.position.set(index===0?-1.25:1.25,.42,7);
        const core=new T.Mesh(new T.SphereGeometry(.12,12,8),new T.MeshBasicMaterial({color}));root.add(core);
        const halo=new T.Sprite(new T.SpriteMaterial({map:this.glowTexture,color,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));halo.scale.set(1.5,1.5,1.5);root.add(halo);
        const lamp=new T.PointLight(color,4,5);root.add(lamp);this.scene.add(root);
        const camera=new T.PerspectiveCamera(54,1,.1,90);
        const trail=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color,transparent:true,opacity:.25}));this.scene.add(trail);
        return{root,camera,halo,lamp,trail,points:[],x:root.position.x,z:7};
      });
      // The same shared valley is rendered twice, each camera follows its own light.
      const random=()=>{this.seed=(Math.imul(this.seed||2467,1664525)+1013904223)|0;return(this.seed>>>0)/4294967296};
      const rockGeo=new T.IcosahedronGeometry(1,1),rockMat=new T.MeshStandardMaterial({color:0x293b40,flatShading:true,roughness:1});
      for(let i=0;i<62;i++){const rock=new T.Mesh(rockGeo,rockMat);rock.position.set((i%2?-1:1)*(4+random()*6),-.25,-33+random()*49);rock.scale.set(1+random()*3,1+random()*5,1+random()*3);rock.rotation.set(random(),random()*6,random());this.scene.add(rock)}
      const giant=new T.Mesh(global.World.mountain.geometry,new T.MeshStandardMaterial({color:0x314046,roughness:.9,flatShading:true}));giant.position.set(0,2,-29);giant.scale.set(3.8,3.8,3.8);this.scene.add(giant);
      this.collection=new T.Group();this.collection.position.set(0,.05,-22);this.scene.add(this.collection);
      for(let i=0;i<7;i++){const crystal=new T.Mesh(new T.OctahedronGeometry(.42,0),new T.MeshStandardMaterial({color:i%2?0x929bdf:0xf0ce8c,emissive:i%2?0x494f9e:0x9e6c26,emissiveIntensity:1.1,roughness:.25,metalness:.25}));const a=i/7*Math.PI*2;crystal.position.set(Math.cos(a)*.85,.7+Math.sin(i)*.16,Math.sin(a)*.85);crystal.scale.y=1.8;crystal.rotation.z=.2*Math.sin(i);this.collection.add(crystal)}
      const ringMat=new T.MeshBasicMaterial({color:0xc5bd9a,transparent:true,opacity:.38,side:T.DoubleSide});this.ring=new T.Mesh(new T.RingGeometry(2.8,2.84,64),ringMat);this.ring.rotation.x=-Math.PI/2;this.ring.position.y=.03;this.collection.add(this.ring);
      const beacon=new T.PointLight(0xc7bdff,12,11);beacon.position.set(0,2,0);this.collection.add(beacon);
      for(let z=4;z>=-20;z-=2.8){for(const side of [-1,1]){const stone=new T.Mesh(new T.SphereGeometry(.035,6,4),new T.MeshBasicMaterial({color:side<0?0xa89564:0x687da4}));stone.position.set(side*2,.04,z);this.scene.add(stone)}}
      const dustGeo=new T.BufferGeometry(),dust=new Float32Array(330*3);for(let i=0;i<dust.length;i+=3){dust[i]=(random()-.5)*18;dust[i+1]=random()*7;dust[i+2]=random()*50-35}dustGeo.setAttribute('position',new T.BufferAttribute(dust,3));this.scene.add(new T.Points(dustGeo,new T.PointsMaterial({color:0x98b6c1,size:.025,transparent:true,opacity:.5})));
      document.addEventListener('keyup',e=>this.keys.delete(e.code));
      window.addEventListener('blur',()=>this.clearInput());
      document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clearInput()});
      document.getElementById('collectTogether').addEventListener('click',()=>this.collect());
      document.querySelectorAll('[data-move]').forEach(button=>{
        const release=e=>{this.touches.delete(e.pointerId)};
        button.addEventListener('pointerdown',e=>{if(!this.active)return;e.preventDefault();button.setPointerCapture(e.pointerId);this.touches.set(e.pointerId,button.dataset.move)});
        button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
      });
    },
    clearInput(){this.keys.clear();this.touches.clear()},
    start(){
      if(!this.scene)this.init();this.active=true;this.clearInput();this.ready=[false,false];
      for(let i=0;i<2;i++){const p=this.players[i];p.x=i===0?-1.25:1.25;p.z=7;p.points=[];p.camera.position.set(p.x,4.2,p.z+6.5)}
      document.getElementById('exploreUI').hidden=false;
      this.updateUI();
    },
    stop(){this.active=false;this.clearInput();document.getElementById('exploreUI').hidden=true},
    onKey(e){
      if(!this.active)return false;
      const codes=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
      if(codes.includes(e.code)){e.preventDefault();this.keys.add(e.code);return true}
      if(e.code==='KeyE'||e.code==='Enter'){e.preventDefault();this.collect();return true}return false;
    },
    distance(i){return Math.hypot(this.players[i].x-this.goal.x,this.players[i].z-this.goal.z)},
    step(dt){
      if(!this.active||document.hidden||!document.hasFocus())return;
      const held=new Set([...this.keys,...this.touches.values()]);
      for(let i=0;i<2;i++){
        const p=this.players[i],c=i===0?['KeyW','KeyS','KeyA','KeyD']:['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
        let dx=Number(held.has(c[3]))-Number(held.has(c[2])),dz=Number(held.has(c[1]))-Number(held.has(c[0]));
        const length=Math.hypot(dx,dz)||1;
        p.x=Math.max(-3.3,Math.min(3.3,p.x+dx/length*this.speed*dt));p.z=Math.max(-24,Math.min(9,p.z+dz/length*this.speed*dt));
        this.ready[i]=this.distance(i)<this.radius;
      }
    },
    updateUI(){
      for(let i=0;i<2;i++)document.getElementById(i?'shadowDistance':'lightDistance').textContent=this.ready[i]?'已抵达采集点':`距采集点 ${Math.ceil(this.distance(i))} m`;
      const both=this.ready.every(Boolean),one=this.ready.some(Boolean);const button=document.getElementById('collectTogether');button.disabled=!both;
      button.textContent=both?'共同采集 · E / Enter':one?'等待另一束光抵达':'沿光迹向前探索';
      document.getElementById('exploreMessage').textContent=both?'晶体还温热着。你们准备好靠近了吗？':one?'你已发现矿点。等一等，让另一束光也来到这里。':'山谷深处，有一片尚未熄灭的光。';
    },
    collect(){if(!this.active||!this.ready.every(Boolean))return;this.stop();global.Game.discoverCollection()},
    frame(dt,t,renderer){
      this.step(dt);this.updateUI();
      const width=global.innerWidth,height=global.innerHeight,leftWidth=Math.floor(width/2);
      renderer.setScissorTest(true);
      for(let i=0;i<2;i++){
        const p=this.players[i];p.root.position.set(p.x,.42+Math.sin(t*2.1+i)*.055,p.z);p.halo.scale.setScalar(1.35+Math.sin(t*2+i)*.12);
        const last=p.points[p.points.length-1];if(!last||last.distanceToSquared(p.root.position)>.014){p.points.push(p.root.position.clone());if(p.points.length>32)p.points.shift();p.trail.geometry.dispose();p.trail.geometry=new T.BufferGeometry().setFromPoints(p.points)}
        const target=new T.Vector3(p.x*.65,4.2,p.z+6.5);p.camera.position.lerp(target,Math.min(1,dt*5));p.camera.lookAt(p.x*.6,.3,p.z-1.5);
        const viewWidth=i===0?leftWidth:width-leftWidth;p.camera.aspect=viewWidth/height;p.camera.updateProjectionMatrix();
        renderer.setViewport(i===0?0:leftWidth,0,viewWidth,height);renderer.setScissor(i===0?0:leftWidth,0,viewWidth,height);renderer.render(this.scene,p.camera);
      }
      this.ring.material.opacity=.28+Math.sin(t*2)*.12;
      renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);
    }
  };
  global.Exploration=Exploration;
})(window);

