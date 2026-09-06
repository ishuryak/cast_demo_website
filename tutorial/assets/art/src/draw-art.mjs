// Generates the tutorial's hand-drawn illustrations as SVG.
// Every stroke is a seeded, wobbled polyline so the drawings are reproducible
// and remain editable here rather than in a binary source file.
// Run: node tutorial/assets/art/src/draw-art.mjs
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const outDir=fileURLToPath(new URL('../',import.meta.url));
const INK='#242a29',GRAPHITE='#777970',TEAL='#087e8b',RUST='#b56746';

// Deterministic RNG (mulberry32) so a rerun reproduces the same drawing.
function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
// Smooth 1-D noise on [0,1] from a few random sines, normalised to roughly [-1,1].
function wave(r){const k=[.5,1,1.7,2.6].map(f=>({f,a:(r()*2-1)/f,p:r()*Math.PI*2}));return t=>k.reduce((s,{f,a,p})=>s+a*Math.sin(Math.PI*2*f*t+p),0)/1.4;}
const fmt=v=>(+v.toFixed(1)).toString();
const lerp=(a,b,t)=>a+(b-a)*t;

// Sample fn:[0,1]->[x,y], add pencil wobble along the normal, extend slightly past both ends.
function sketch(fn,{n=28,wobble=2,r,over=.02}){
  const w=wave(r),w2=wave(r),eps=1e-3;
  const at=t=>{if(t>=0&&t<=1)return fn(t);const c=t<0?0:1,p=fn(c),q=fn(c+(t<0?eps:-eps));const k=(t<0?-t:t-1)/eps;return[p[0]+(p[0]-q[0])*k,p[1]+(p[1]-q[1])*k];};
  const pts=[];
  for(let i=0;i<=n;i++){const t=-over+(1+2*over)*i/n;const p=at(t),q=at(t+eps);let dx=q[0]-p[0],dy=q[1]-p[1];const len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;const off=wobble*w(t),along=wobble*.35*w2(t);pts.push([p[0]-dy*off+dx*along,p[1]+dx*off+dy*along]);}
  let d=`M${fmt(pts[0][0])},${fmt(pts[0][1])}`;
  for(let i=1;i<pts.length-1;i++){const m=[(pts[i][0]+pts[i+1][0])/2,(pts[i][1]+pts[i+1][1])/2];d+=`Q${fmt(pts[i][0])},${fmt(pts[i][1])} ${fmt(m[0])},${fmt(m[1])}`;}
  const l=pts.at(-1);d+=`L${fmt(l[0])},${fmt(l[1])}`;return d;
}
const line=(a,b)=>t=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t)];
const bez=(p0,p1,p2,p3)=>t=>{const u=1-t;return[u*u*u*p0[0]+3*u*u*t*p1[0]+3*u*t*t*p2[0]+t*t*t*p3[0],u*u*u*p0[1]+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t*t*t*p3[1]];};
const circle=(cx,cy,rad,start=0,turns=1.06)=>t=>{const a=start+t*Math.PI*2*turns;return[cx+rad*Math.cos(a),cy+rad*Math.sin(a)];};

// A drawing collects strokes in narrative order; --i drives the page's draw-on stagger.
class Drawing{
  constructor(id,w,h){this.id=id;this.w=w;this.h=h;this.parts=[];this.i=0;}
  stroke(fn,{color=INK,width=1.7,opacity=1,wobble=2,n=28,over=.02,r,dash}={}){
    const d=sketch(fn,{n,wobble,r,over});
    const path=`<path d="${d}" stroke="${color}" stroke-width="${width}"${opacity<1?` opacity="${opacity}"`:''}`;
    // Dashed strokes cannot use the pathLength draw-on trick, so they fade in as a group instead.
    this.parts.push(dash?`<g class="s-dash" style="--i:${this.i++}">${path} stroke-dasharray="${dash}"/></g>`:`${path} class="s" pathLength="1" style="--i:${this.i++}"/>`);
  }
  // Two passes read as a pencil going over a line twice; the second pass is lighter and steadier.
  double(fn,opts){this.stroke(fn,opts);this.stroke(fn,{...opts,width:(opts.width||1.7)*.7,opacity:(opts.opacity||1)*.45,wobble:(opts.wobble||2)*.6});}
  wash(fn,{color=TEAL,opacity=.12,r,wobble=10,n=40}){const d=sketch(fn,{n,wobble,r,over:0})+'Z';this.parts.push(`<g class="wash" style="--i:${this.i++}"><path d="${d}" fill="${color}" fill-opacity="${opacity}" stroke="none"/></g>`);}
  group(open){this.parts.push(open);}
  end(){this.parts.push('</g>');}
  svg(title,desc){
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${this.h}" role="img" aria-labelledby="${this.id}-title ${this.id}-desc">
<title id="${this.id}-title">${title}</title>
<desc id="${this.id}-desc">${desc}</desc>
<defs><filter id="${this.id}-pencil" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.4" xChannelSelector="R" yChannelSelector="G"/></filter></defs>
<g fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#${this.id}-pencil)">
${this.parts.join('\n')}
</g>
</svg>
`;
  }
}

// One loosely sketched person: a head and an open-bottomed shoulder arch.
// Shape comes from the person's own seed so the same figure recurs recognisably.
function person(dr,x,y,s,idx,strokeR,{color=INK,opacity=1,width=1.7}={}){
  const shape=rng(1000+idx);const h=.85+shape()*.3,wd=.85+shape()*.3,tilt=(shape()-.5)*3,headR=6.5*s*(.9+shape()*.2),start=shape()*Math.PI*2;
  const hx=x+tilt*s,hy=y-22*s*h;
  dr.stroke(circle(hx,hy,headR,start),{color,opacity,width:width*s,wobble:.55*s,n:26,over:0,r:strokeR});
  const l=x-9*s*wd,rt=x+9*s*wd,top=y-12*s*h,bot=y+8*s*h;
  dr.stroke(bez([l,bot],[l-1.5*s,top-4*s],[rt+1.5*s,top-4*s],[rt,bot]),{color,opacity,width:width*s,wobble:.9*s,n:30,over:.03,r:strokeR});
}
// The same nine people, always in the same arrangement.
const COHORT=[[0,0,1],[-70,-30,.9],[72,-26,.95],[-42,46,1.05],[46,52,.9],[-112,18,.85],[112,24,1],[-14,-72,.85],[24,92,.95]];
function cohort(dr,cx,cy,scale,strokeR,opts={},people=COHORT){
  for(const [k,[dx,dy,sc]] of people.entries())person(dr,cx+dx*scale,cy+dy*scale,2.1*scale*sc,k,strokeR,opts);
}
function ground(dr,cx,cy,span,r,opts={}){
  for(let k=0;k<3;k++){const w=span*(.35+r()*.4),x0=cx-span/2+r()*(span-w),y=cy+k*7+r()*4;dr.stroke(line([x0,y],[x0+w,y]),{color:GRAPHITE,opacity:.45,width:1.2,wobble:1.2,n:12,r,...opts});}
}

// Deliverable 1: cohort at the fork (4:3).
function cohortFork(){
  const dr=new Drawing('fork',1200,900),r=rng(20260905);
  const base=[300,480];
  cohort(dr,base[0],base[1],1,r);
  ground(dr,base[0],base[1]+120,300,r);
  const split=[590,480];
  dr.double(line([base[0]+170,base[1]+6],split),{color:INK,width:2.4,wobble:1.8,n:20,r});
  dr.double(bez(split,[740,478],[790,262],[930,258]),{color:TEAL,width:2.8,wobble:2.2,n:34,r});
  dr.double(bez(split,[740,482],[790,698],[930,702]),{color:GRAPHITE,width:2.6,wobble:2.2,n:34,r});
  dr.wash(circle(1015,262,148,.6),{color:TEAL,opacity:.11,r,wobble:14});
  cohort(dr,1015,262,.72,r,{color:TEAL,opacity:.6});
  cohort(dr,1015,702,.72,r,{color:GRAPHITE,opacity:.6});
  ground(dr,1015,262+88,220,r,{color:TEAL,opacity:.3});
  ground(dr,1015,702+88,220,r);
  return dr.svg('The same cohort at a fork','A loosely sketched group of people stands at the base of a forking path. The same group is echoed faintly at the end of both branches: two possible treatment worlds for one population. One branch carries a light teal wash; the other stays graphite.');
}

// Deliverable 2: follow-up sketchbook (3:1).
function followUpSketchbook(){
  const dr=new Drawing('frames',1800,600),r=rng(3651);
  const centers=[300,600,900,1200,1500],fw=210,fh=230;
  const rail=x=>320+22*Math.sin(x/260)+10*Math.sin(x/97);
  const seg=(x0,x1,opts={})=>dr.stroke(t=>{const x=lerp(x0,x1,t);return[x,rail(x)];},{color:GRAPHITE,width:2,wobble:2.5,n:Math.max(8,Math.round((x1-x0)/40)),over:0,r,...opts});
  const edges=centers.map(c=>[c-fw/2-14,c+fw/2+14]);
  seg(120,edges[0][0]);
  for(let k=0;k<4;k++)seg(edges[k][1],edges[k+1][0]);
  // The stroke is unfinished: it thins into three shortening dashes.
  seg(edges[4][1],1585);let x=1605;for(const len of [26,16,8]){seg(x,x+len,{opacity:.5,width:1.6});x+=len+18;}
  centers.forEach((cx,k)=>{
    const cy=300+[8,-12,4,-6,10][k],rot=[-2.5,1.8,-1.2,2.6,-1.6][k];
    dr.group(`<g transform="rotate(${rot} ${cx} ${cy})">`);
    if(k===2)dr.wash(t=>{const a=t*Math.PI*2;return[cx+(fw/2-18)*Math.cos(a)*1.02,cy+(fh/2-18)*Math.sin(a)*1.02];},{color:TEAL,opacity:.1,r,wobble:6});
    const l=cx-fw/2,rt=cx+fw/2,top=cy-fh/2,bot=cy+fh/2;
    for(const [a,b] of [[[l,top],[rt,top]],[[rt,top],[rt,bot]],[[rt,bot],[l,bot]],[[l,bot],[l,top]]])dr.stroke(line(a,b),{color:k===2?TEAL:INK,width:1.6,wobble:1.4,n:14,over:.035,r});
    cohort(dr,cx,cy+8,.44,r,{opacity:.9},COHORT.slice(0,5));
    dr.end();
  });
  return dr.svg('Five sketchbook frames along an unfinished line','Five lightly drawn frames sit along a single unfinished graphite stroke. Each frame holds the same small group of people: successive opportunities to observe one cohort. One frame carries a light teal wash.');
}

// Deliverable 3: hidden common cause (4:3).
function hiddenThread(){
  const dr=new Drawing('lamp',1200,900),r=rng(8811);
  dr.stroke(line([600,70],[600,222]),{color:GRAPHITE,width:1.6,wobble:1.2,n:14,r});
  dr.wash(t=>{const pts=[[478,336],[722,336],[1000,790],[200,790]];const k=Math.min(3,Math.floor(t*4)),u=t*4-k;return line(pts[k],pts[(k+1)%4])(u);},{color:TEAL,opacity:.06,r,wobble:5,n:48});
  dr.double(line([562,222],[478,332]),{color:INK,width:1.8,wobble:1.5,n:14,r});
  dr.double(line([638,222],[722,332]),{color:INK,width:1.8,wobble:1.5,n:14,r});
  dr.stroke(line([562,222],[638,222]),{color:INK,width:1.8,wobble:1,n:10,r});
  dr.stroke(bez([478,332],[540,352],[660,352],[722,332]),{color:INK,width:1.8,wobble:1.4,n:22,r});
  dr.stroke(circle(600,322,15,1.2,.62),{color:GRAPHITE,width:1.4,wobble:.6,n:16,over:0,r});
  const knot=(x,y)=>dr.stroke(circle(x,y,13,r()*6,2.3),{color:INK,width:1.6,wobble:2.2,n:40,over:0,r});
  knot(300,640);knot(900,640);
  const threads=[[[300,640],[420,560],[760,560],[900,640]],[[300,640],[470,600],[720,690],[900,640]],[[300,640],[520,720],[700,740],[900,640]],[[300,640],[440,660],[780,600],[900,640]]];
  for(const t of threads)dr.stroke(bez(...t),{color:GRAPHITE,width:1.5,wobble:1.8,n:30,r});
  // One thread continues past the lit area.
  dr.stroke(bez([300,640],[560,520],[880,470],[1000,462]),{color:RUST,width:1.6,wobble:1.8,n:30,r});
  dr.stroke(bez([1000,462],[1050,458],[1090,452],[1128,446]),{color:RUST,width:1.5,wobble:1.5,n:12,r,opacity:.6,dash:'7 8'});
  ground(dr,600,806,420,r);
  return dr.svg('A lamp lights several threads; one runs past the light','A quiet hanging lamp lights a cone of space. Several sketched threads connect two small knots inside the light. One thread leaves the lit area and fades into the margin.');
}

for(const [name,make] of [['cohort-fork.svg',cohortFork],['follow-up-sketchbook.svg',followUpSketchbook],['hidden-thread.svg',hiddenThread]]){
  const svg=make();writeFileSync(path.join(outDir,name),svg);console.log(`${name}: ${(Buffer.byteLength(svg)/1024).toFixed(1)} KB`);
}
