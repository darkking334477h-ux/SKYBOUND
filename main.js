import * as THREE from 'three';
import './style.css';

// SKYBOUND — mobile-first procedural passenger-airliner flight prototype.
const $ = (id) => document.getElementById(id);
const host = $('world');
const input = { pitchUp:false, pitchDown:false, rollLeft:false, rollRight:false, yawLeft:false, yawRight:false, throttleUp:false, throttleDown:false };
let scene, camera, renderer, aircraft, clock, started=false, camMode=0, preset='balanced';
let speed=0, throttle=0.42, heading=0, verticalSpeed=0, bank=0, pitch=0, fpsFrames=0, fpsTime=0;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mat=(color,roughness=.7,metalness=.05)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const white=mat(0xf0f4f6,.34,.16), blue=mat(0x075b91,.36,.3), dark=mat(0x172c3b,.28,.55), glass=new THREE.MeshPhysicalMaterial({color:0x63c9e9,metalness:.25,roughness:.12,transparent:true,opacity:.72});

function cylinderBetween(parent, radiusTop, radiusBottom, length, material, position, rotation={x:0,y:0,z:0}, radial=18){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(radiusTop,radiusBottom,length,radial),material);
  m.position.set(...position); m.rotation.set(rotation.x,rotation.y,rotation.z); parent.add(m); return m;
}
function makeWing(parent, span, chord, y, z, material){
  const shape=new THREE.Shape();
  shape.moveTo(-span/2, chord*.28); shape.lineTo(-span/2, -chord*.23);
  shape.lineTo(-span*.36,-chord*.36); shape.lineTo(span*.40,-chord*.12);
  shape.lineTo(span/2,chord*.10); shape.lineTo(span/2,chord*.30);
  shape.lineTo(span*.36,chord*.25); shape.lineTo(-span*.36,chord*.42); shape.closePath();
  const geo=new THREE.ExtrudeGeometry(shape,{depth:.22,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.045,bevelThickness:.035});
  geo.rotateX(Math.PI/2); const mesh=new THREE.Mesh(geo,material); mesh.position.set(0,y,z); parent.add(mesh); return mesh;
}
function makeAirliner(){
  const root=new THREE.Group();
  // Long passenger fuselage: lathe profile gives a tapered nose and tail.
  const profile=[new THREE.Vector2(0,-8.5),new THREE.Vector2(.18,-8.1),new THREE.Vector2(.55,-7.1),new THREE.Vector2(.83,-5.4),new THREE.Vector2(.94,-3.2),new THREE.Vector2(.96,2.8),new THREE.Vector2(.88,5.8),new THREE.Vector2(.65,7.3),new THREE.Vector2(.34,8.2),new THREE.Vector2(0,8.55)];
  const fuselage=new THREE.Mesh(new THREE.LatheGeometry(profile,28),white); fuselage.rotation.x=Math.PI/2; root.add(fuselage);
  // Blue lower fuselage stripe.
  const stripe=new THREE.Mesh(new THREE.CylinderGeometry(.80,.80,11.8,28,1,true,0,Math.PI),blue); stripe.rotation.x=Math.PI/2; stripe.position.y=-.03; root.add(stripe);
  // Nose cockpit glazing and windshield panels.
  const cockpit=new THREE.Mesh(new THREE.SphereGeometry(.78,20,12,0,Math.PI*2,0,Math.PI/2),glass); cockpit.scale.set(1.0,.65,1.55); cockpit.position.set(0,.62,-5.9); root.add(cockpit);
  for(let side of [-1,1]) for(let i=0;i<18;i++){
    const z=-4.5+i*.57; const w=new THREE.Mesh(new THREE.SphereGeometry(.105,8,6),new THREE.MeshStandardMaterial({color:0x142e42,roughness:.2,metalness:.35}));
    w.scale.set(.55,.82,1.25); w.position.set(side*(.91-Math.max(0,Math.abs(z)-5)*.035),.24,z); root.add(w);
  }
  // Swept main wings and horizontal stabilizers.
  makeWing(root,23,5.1,-.12,-.05,blue);
  makeWing(root,9.0,2.15,.18,6.65,white);
  const fin=new THREE.Mesh(new THREE.BoxGeometry(.24,3.4,2.9),blue); fin.position.set(0,1.62,6.85); fin.rotation.x=-.16; root.add(fin);
  // Wing flaps and aileron strips.
  for(const s of [-1,1]){
    const flap=new THREE.Mesh(new THREE.BoxGeometry(8,.09,.48),mat(0x164c70,.45,.22)); flap.position.set(s*5.2,-.05,1.75); root.add(flap);
    // Two turbofan nacelles with intake rings and dark fan faces.
    const x=s*5.2, z=-.65;
    const nacelle=cylinderBetween(root,.67,.78,2.35,white,[x,-.82,z],{x:Math.PI/2,y:0,z:0},24);
    const intake=new THREE.Mesh(new THREE.TorusGeometry(.62,.09,8,24),dark); intake.position.set(x,-.82,z-1.19); root.add(intake);
    const fan=new THREE.Mesh(new THREE.CircleGeometry(.51,20),dark); fan.position.set(x,-.82,z-1.205); root.add(fan);
    for(let k=0;k<8;k++){const blade=new THREE.Mesh(new THREE.BoxGeometry(.07,.76,.045),mat(0x9baab1,.3,.65));blade.position.set(x,-.82,z-1.23);blade.rotation.z=k*Math.PI/4;root.add(blade);}
    cylinderBetween(root,.24,.24,.18,dark,[x,-.82,z+1.18],{x:Math.PI/2},16);
  }
  // Landing gear struts and wheels.
  const gearMat=mat(0x8a969c,.35,.7), tire=mat(0x171d22,.92,0);
  for(const x of [-3.1,3.1]){
    cylinderBetween(root,.075,.10,1.0,gearMat,[x,-1.08,1.0]);
    for(const z of [.78,1.18]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.36,.36,.19,16),tire);wheel.rotation.z=Math.PI/2;wheel.position.set(x,-1.62,z);root.add(wheel);}
  }
  cylinderBetween(root,.07,.09,.85,gearMat,[0,-.92,-6.2]);
  const noseWheel=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,.16,14),tire);noseWheel.rotation.z=Math.PI/2;noseWheel.position.set(0,-1.35,-6.2);root.add(noseWheel);
  // Navigation lights.
  for(const [x,c] of [[-11.3,0xff3434],[11.3,0x35ff9a]]){const light=new THREE.Mesh(new THREE.SphereGeometry(.14,8,8),new THREE.MeshBasicMaterial({color:c}));light.position.set(x,-.05,.4);root.add(light);}
  root.position.set(0,170,0); root.scale.setScalar(1.25); scene.add(root); return root;
}
function heightAt(x,z){const r=Math.hypot(x,z), edge=clamp((3100-r)/780,0,1);return -28+edge*(Math.sin(x*.0018)*Math.cos(z*.0021)*125+Math.sin((x+z)*.004)*29+Math.cos(x*.007)*8);}
function makeWorld(){
  const seg=preset==='high'?170:preset==='balanced'?112:68;
  const geo=new THREE.PlaneGeometry(7600,7600,seg,seg);geo.rotateX(-Math.PI/2);const p=geo.attributes.position,colors=[];
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),r=Math.hypot(x,z),h=heightAt(x,z);p.setY(i,h);const c=r>2850?new THREE.Color(0xb4a77f):h>100?new THREE.Color(0x858d88):h>35?new THREE.Color(0x55775a):new THREE.Color(0x71975e);colors.push(c.r,c.g,c.b);}
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();scene.add(new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1})));
  const ocean=new THREE.Mesh(new THREE.PlaneGeometry(18000,18000),new THREE.MeshStandardMaterial({color:0x145b80,roughness:.38,metalness:.06}));ocean.rotation.x=-Math.PI/2;ocean.position.y=-29;scene.add(ocean);
  // Airport runway, markings and terminal.
  const runway=new THREE.Mesh(new THREE.PlaneGeometry(115,2100),mat(0x303a42,.95));runway.rotation.x=-Math.PI/2;runway.position.set(0,-17,-760);scene.add(runway);
  const paint=new THREE.MeshBasicMaterial({color:0xf4f2df});
  for(let z=-1740;z<-30;z+=95){const mark=new THREE.Mesh(new THREE.PlaneGeometry(2.3,42),paint);mark.rotation.x=-Math.PI/2;mark.position.set(0,-16.7,z);scene.add(mark);}
  for(const x of [-54,54]){const edge=new THREE.Mesh(new THREE.PlaneGeometry(1.4,2020),paint);edge.rotation.x=-Math.PI/2;edge.position.set(x,-16.6,-760);scene.add(edge);}
  const terminal=new THREE.Group();const building=new THREE.Mesh(new THREE.BoxGeometry(190,22,62),mat(0x9daeb8,.7));building.position.set(0,-5,-1900);terminal.add(building);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(205,3,72),mat(0x24617c,.35,.2));roof.position.set(0,7,-1900);terminal.add(roof);
  for(let i=0;i<12;i++){const win=new THREE.Mesh(new THREE.BoxGeometry(9,10,.5),glass);win.position.set(-82+i*15,-3,-1868.5);terminal.add(win);}scene.add(terminal);
  // Instanced forest for mobile performance.
  const count=preset==='high'?900:preset==='balanced'?480:210, treeGeo=new THREE.ConeGeometry(5,20,6),treeMat=mat(0x28563c),forest=new THREE.InstancedMesh(treeGeo,treeMat,count),trunkGeo=new THREE.CylinderGeometry(.7,1.05,5,6),trunks=new THREE.InstancedMesh(trunkGeo,mat(0x60482f),count),dummy=new THREE.Object3D();let n=0;
  for(let i=0;i<count*4&&n<count;i++){const a=Math.random()*Math.PI*2,r=580+Math.random()*2100,x=Math.cos(a)*r,z=Math.sin(a)*r,h=heightAt(x,z);if(h>115)continue;const s=.5+Math.random()*.85;dummy.position.set(x,h+8*s,z);dummy.scale.set(s,s,s);dummy.rotation.y=Math.random()*6.28;dummy.updateMatrix();forest.setMatrixAt(n,dummy.matrix);dummy.position.set(x,h-2,z);dummy.scale.set(s,s,s);dummy.updateMatrix();trunks.setMatrixAt(n,dummy.matrix);n++;}scene.add(forest,trunks);
  // Distant low-poly city.
  const city=new THREE.Group(),buildingMat=mat(0x9aa9ae,.82);for(let i=0;i<110;i++){const x=(Math.random()-.5)*1050,z=(Math.random()-.5)*900-1300,h=12+Math.random()*85,b=new THREE.Mesh(new THREE.BoxGeometry(13+Math.random()*20,h,13+Math.random()*20),buildingMat);b.position.set(x,h/2-17,z);city.add(b);}scene.add(city);
}
function makeClouds(){
 const cloudMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,transparent:true,opacity:.84}),sphere=new THREE.SphereGeometry(1,9,7),n=preset==='high'?110:preset==='balanced'?62:28;
 for(let i=0;i<n;i++){const g=new THREE.Group(),cx=(Math.random()-.5)*9500,cy=430+Math.random()*850,cz=(Math.random()-.5)*9500;for(let j=0;j<3+Math.floor(Math.random()*4);j++){const m=new THREE.Mesh(sphere,cloudMat);m.position.set((Math.random()-.5)*100,(Math.random()-.5)*18,(Math.random()-.5)*80);m.scale.set(24+Math.random()*38,10+Math.random()*16,22+Math.random()*30);g.add(m);}g.position.set(cx,cy,cz);scene.add(g);}
}
function init(){
 scene=new THREE.Scene();scene.background=new THREE.Color(0x8bc5e8);scene.fog=new THREE.FogExp2(0x9bcce6,.000047);
 camera=new THREE.PerspectiveCamera(66,innerWidth/innerHeight,.1,17000);
 renderer=new THREE.WebGLRenderer({antialias:preset!=='performance',powerPreference:'high-performance'});renderer.setPixelRatio(preset==='high'?Math.min(devicePixelRatio,1.5):preset==='balanced'?Math.min(devicePixelRatio,1.15):1);renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;host.appendChild(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0xdaf2ff,0x52604b,1.75));const sun=new THREE.DirectionalLight(0xffedcf,2.25);sun.position.set(-600,1100,-500);scene.add(sun);
 makeWorld();makeClouds();aircraft=makeAirliner();clock=new THREE.Clock();
}
function reset(){aircraft.position.set(0,170,0);aircraft.rotation.set(0,0,0);speed=0;throttle=.42;heading=0;verticalSpeed=0;bank=0;pitch=0;$('status').textContent='FLIGHT RESET';}
function update(dt){
 if(input.throttleUp)throttle=clamp(throttle+dt*.22,0,1);if(input.throttleDown)throttle=clamp(throttle-dt*.22,0,1);
 const roll=(input.rollRight?1:0)-(input.rollLeft?1:0),pitchInput=(input.pitchUp?1:0)-(input.pitchDown?1:0),yaw=(input.yawRight?1:0)-(input.yawLeft?1:0);
 // Gentle flight model: thrust, drag, lift, bank-turn coordination and gravity.
 const thrust=throttle*175, drag=8+speed*.018; speed=clamp(speed+(thrust-drag)*dt,0,900);
 bank=THREE.MathUtils.damp(bank,roll*.62,2.1,dt);pitch=THREE.MathUtils.damp(pitch,pitchInput*.28,1.7,dt);
 aircraft.rotation.z=bank;aircraft.rotation.x=-pitch;aircraft.rotation.y+= (yaw*.34-bank*.42)*dt;
 heading=(heading+(yaw*16-bank*42)*dt+360)%360;
 const lift=clamp((speed-95)/210,0,1)*Math.cos(bank)*28;
 verticalSpeed+=(pitchInput*speed*.055+lift-9.8)*dt;verticalSpeed=clamp(verticalSpeed,-75,75);
 const forward=new THREE.Vector3(0,0,-1).applyQuaternion(aircraft.quaternion);aircraft.position.addScaledVector(forward,speed*dt*.72);aircraft.position.y=clamp(aircraft.position.y+verticalSpeed*dt,12,4200);
 if(aircraft.position.y<=12&&verticalSpeed<0){verticalSpeed=0;speed=Math.max(0,speed-40*dt);$('status').textContent='LOW ALTITUDE · PULL UP';}
 if(camMode===0){const offset=new THREE.Vector3(0,8,34).applyQuaternion(aircraft.quaternion);camera.position.lerp(aircraft.position.clone().add(offset),1-Math.pow(.0007,dt));camera.lookAt(aircraft.position.clone().add(forward.clone().multiplyScalar(42)));}
 else{camera.position.copy(aircraft.position).add(new THREE.Vector3(0,1.2,-7.1).applyQuaternion(aircraft.quaternion));camera.quaternion.copy(aircraft.quaternion);}
 $('alt').innerHTML=Math.round(aircraft.position.y)+' <i>m</i>';$('spd').innerHTML=Math.round(speed*1.15)+' <i>km/h</i>';$('hdg').textContent=String(Math.round(heading)).padStart(3,'0')+'°';$('thr').textContent=Math.round(throttle*100)+'%';$('vs').textContent=(verticalSpeed>=0?'+':'')+Math.round(verticalSpeed)+' m/s';
}
function toggleCam(){camMode=1-camMode;$('status').textContent=camMode?'COCKPIT VIEW':'CHASE VIEW';}
function loop(){requestAnimationFrame(loop);if(!started)return;const dt=Math.min(clock.getDelta(),.04);update(dt);renderer.render(scene,camera);fpsFrames++;fpsTime+=dt;if(fpsTime>=1){$('fps').textContent=Math.round(fpsFrames/fpsTime)+' FPS';fpsFrames=0;fpsTime=0;}}
const keyMap={ArrowUp:'pitchUp',ArrowDown:'pitchDown',ArrowLeft:'rollLeft',ArrowRight:'rollRight',KeyA:'yawLeft',KeyD:'yawRight',KeyW:'throttleUp',KeyS:'throttleDown'};
addEventListener('keydown',e=>{if(keyMap[e.code]){input[keyMap[e.code]]=true;e.preventDefault();}if(e.code==='KeyC'&&started)toggleCam();if(e.code==='KeyR'&&started)reset();});
addEventListener('keyup',e=>{if(keyMap[e.code])input[keyMap[e.code]]=false;});
document.querySelectorAll('[data-act]').forEach(btn=>{const action=btn.dataset.act,down=e=>{e.preventDefault();input[action]=true;},up=e=>{e.preventDefault();input[action]=false;};btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);btn.addEventListener('pointerleave',up);});
$('camBtn').addEventListener('click',toggleCam);$('brakeBtn').addEventListener('pointerdown',()=>{speed=Math.max(0,speed-65);$('status').textContent='SPEED BRAKE';});$('resetBtn').addEventListener('click',reset);
$('launch').addEventListener('click',()=>{preset=$('quality').value;started=true;$('start').style.display='none';init();loop();});
addEventListener('resize',()=>{if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
