// The popup injects this file on every click. Everything is wrapped in a
// function so re-injection doesn't throw "already declared", and the newest
// copy replaces the previous message listener.
(()=>{

let selectionLayer;


if(window.__traceListener){
try{chrome.runtime.onMessage.removeListener(window.__traceListener);}catch(e){}
}

window.__traceListener=(msg,sender,sendResponse)=>{


const overlayVisible=()=>{
const o=document.querySelector("#trace-overlay");
return !!o && o.style.display!=="none";
};


if(msg.action==="toggle"){
if(overlayVisible()){
document.querySelector("#trace-overlay").style.setProperty("display","none");
sendResponse({visible:false});
}else{
const o=document.querySelector("#trace-overlay");
if(o)o.style.removeProperty("display");
else showOverlay();
sendResponse({visible:true});
}
return;
}


if(msg.action==="status"){
sendResponse({visible:overlayVisible()});
return;
}


if(msg.action==="manual")
manualSelect();


if(msg.action==="auto")
captureAuto();


if(msg.action==="fullpage")
captureFullPage();


if(msg.action==="saveImage")
processImage(msg);


if(msg.action==="show")
showOverlay();


if(msg.action==="hide")
document.querySelector("#trace-overlay")?.style.setProperty(
"display",
"none"
);


if(msg.action==="clear"){
removeOverlay();
window.__traceOffset={x:0,y:0};
}


if(msg.action==="resetPosition")
resetOffset();


if(msg.action==="opacity"){
let img=document.querySelector("#trace-overlay");
if(img)
img.style.opacity=msg.value;
}

};

chrome.runtime.onMessage.addListener(window.__traceListener);



// ---- Ctrl + drag: move only the overlay (page does not scroll) ----
// Ctrl + drag        = move overlay up/down
// Ctrl + Shift + drag = move overlay freely (up/down/left/right)

if(!window.__traceOffset)window.__traceOffset={x:0,y:0};

function applyOffset(img){
img=img||document.querySelector("#trace-overlay");
if(img)img.style.transform=`translate(${window.__traceOffset.x}px,${window.__traceOffset.y}px)`;
}

function resetOffset(){
window.__traceOffset={x:0,y:0};
applyOffset();
}

if(window.__traceDragCleanup)window.__traceDragCleanup();

{

let drag=null;
let suppressClick=false;
let cursorStyle=null;

const visibleOverlay=()=>{
const o=document.querySelector("#trace-overlay");
return o && o.style.display!=="none" ? o : null;
};

const setCursor=c=>{
if(!c){cursorStyle?.remove();cursorStyle=null;return;}
if(!cursorStyle){
cursorStyle=document.createElement("style");
document.documentElement.appendChild(cursorStyle);
}
cursorStyle.textContent=`*{cursor:${c}!important;user-select:none!important}`;
};

const onKeyDown=e=>{
if(e.key==="Control" && !drag && visibleOverlay())setCursor("grab");
};

const onKeyUp=e=>{
if(e.key==="Control" && !drag)setCursor(null);
};

const onDown=e=>{
if(!e.ctrlKey || e.button!==0 || !visibleOverlay())return;
e.preventDefault();
e.stopPropagation();
drag={
sx:e.clientX,
sy:e.clientY,
ox:window.__traceOffset.x,
oy:window.__traceOffset.y,
moved:false
};
setCursor("grabbing");
};

const onMove=e=>{
if(!drag)return;
e.preventDefault();
e.stopPropagation();
const dx=e.clientX-drag.sx;
const dy=e.clientY-drag.sy;
if(Math.abs(dx)+Math.abs(dy)>2)drag.moved=true;
window.__traceOffset={
x:e.shiftKey ? drag.ox+dx : drag.ox,
y:drag.oy+dy
};
applyOffset();
};

const onUp=e=>{
if(!drag)return;
e.preventDefault();
e.stopPropagation();
// Ctrl+click on a link would otherwise open it in a new tab
suppressClick=true;
setTimeout(()=>suppressClick=false,0);
drag=null;
setCursor(e.ctrlKey && visibleOverlay() ? "grab" : null);
};

const onClick=e=>{
if(!suppressClick)return;
e.preventDefault();
e.stopPropagation();
suppressClick=false;
};

const onBlur=()=>{
drag=null;
setCursor(null);
};

const opts={capture:true};
const passiveOff={capture:true,passive:false};
window.addEventListener("keydown",onKeyDown,opts);
window.addEventListener("keyup",onKeyUp,opts);
window.addEventListener("mousedown",onDown,passiveOff);
window.addEventListener("mousemove",onMove,passiveOff);
window.addEventListener("mouseup",onUp,passiveOff);
window.addEventListener("click",onClick,passiveOff);
window.addEventListener("auxclick",onClick,passiveOff);
window.addEventListener("blur",onBlur);

window.__traceDragCleanup=()=>{
window.removeEventListener("keydown",onKeyDown,opts);
window.removeEventListener("keyup",onKeyUp,opts);
window.removeEventListener("mousedown",onDown,passiveOff);
window.removeEventListener("mousemove",onMove,passiveOff);
window.removeEventListener("mouseup",onUp,passiveOff);
window.removeEventListener("click",onClick,passiveOff);
window.removeEventListener("auxclick",onClick,passiveOff);
window.removeEventListener("blur",onBlur);
setCursor(null);
};

}



function manualSelect(){

selectionLayer=document.createElement("div");

Object.assign(
selectionLayer.style,
{
position:"fixed",
inset:"0",
zIndex:"2147483647",
cursor:"crosshair"
}
);

document.body.appendChild(selectionLayer);


let box=document.createElement("div");

Object.assign(
box.style,
{
position:"fixed",
border:"2px dashed #2563eb",
background:"rgba(37,99,235,.15)"
}
);

selectionLayer.appendChild(box);


let sx,sy;


selectionLayer.onmousedown=e=>{
sx=e.clientX;
sy=e.clientY;
};


selectionLayer.onmousemove=e=>{

if(sx===undefined)return;

box.style.left=Math.min(e.clientX,sx)+"px";
box.style.top=Math.min(e.clientY,sy)+"px";
box.style.width=Math.abs(e.clientX-sx)+"px";
box.style.height=Math.abs(e.clientY-sy)+"px";

};


selectionLayer.onmouseup=()=>{

let r=box.getBoundingClientRect();

selectionLayer.remove();


chrome.runtime.sendMessage({
action:"capture",
rect:{
x:r.x,
y:r.y,
width:r.width,
height:r.height
}
});

};

}



function captureAuto(){

chrome.runtime.sendMessage({
action:"capture",
rect:null
});

}



const sleep=ms=>new Promise(r=>setTimeout(r,ms));


// Send a request to the background worker; explains the 'stale worker' case clearly
function askBackground(msg){
return new Promise(resolve=>{
chrome.runtime.sendMessage(msg,res=>{
const err=chrome.runtime.lastError?.message;
if(!res && err && /port closed|Receiving end/i.test(err))
resolve({error:'the extension background is outdated or stopped. Open chrome://extensions, click the reload icon on Trace Overlay, then refresh this tab.'});
else
resolve(res||{error:err||'No response from background'});
});
});
}


function captureStep(){
return askBackground({action:'captureStep'}).then(res=>{
if(!res.image)throw new Error(res.error||'Capture failed');
return res.image;
});
}


function loadImage(src){
return new Promise((resolve,reject)=>{
let img=new Image();
img.onload=()=>resolve(img);
img.onerror=reject;
img.src=src;
});
}


// Find what actually scrolls: the window, or (for app-style layouts) the
// largest scrollable element on the page.
function findScroller(){

const root=document.documentElement;
const bodyStyle=document.body?getComputedStyle(document.body):null;
const rootStyle=getComputedStyle(root);
const windowCanScroll=
root.scrollHeight-window.innerHeight>5 &&
rootStyle.overflowY!=="hidden" &&
(!bodyStyle || bodyStyle.overflowY!=="hidden" || root.scrollHeight>document.body.scrollHeight);

if(windowCanScroll)return null;

let best=null,bestArea=0;

document.querySelectorAll("body *").forEach(el=>{
if(el.scrollHeight-el.clientHeight<=5)return;
const oy=getComputedStyle(el).overflowY;
if(oy!=="auto" && oy!=="scroll" && oy!=="overlay")return;
const area=el.clientWidth*el.clientHeight;
if(area>bestArea){
best=el;
bestArea=area;
}
});

return best;

}


// Scroll through the page once so lazy images and scroll animations load
async function preScroll(){
const root=document.documentElement;
const original=window.scrollY;
const behavior=root.style.scrollBehavior;
root.style.scrollBehavior="auto";
const step=Math.max(200,Math.round(window.innerHeight*0.8));
for(let y=0;y<root.scrollHeight;y+=step){
window.scrollTo(0,y);
await sleep(120);
}
window.scrollTo(0,root.scrollHeight);
await sleep(400);
window.scrollTo(0,0);
await sleep(400);
root.style.scrollBehavior=behavior;
return original;
}


function finishFullPage(dataUrl){

chrome.storage.local.set({
image:dataUrl,
fullPage:true
});

// Also download the PNG
fetch(dataUrl).then(r=>r.blob()).then(blob=>{
const a=document.createElement("a");
a.href=URL.createObjectURL(blob);
a.download="fullpage-"+location.hostname+"-"+Date.now()+".png";
document.documentElement.appendChild(a);
a.click();
a.remove();
setTimeout(()=>URL.revokeObjectURL(a.href),10000);
});

}


// Crop away the solid background around the design (Figma canvas background)
async function trimBackground(dataUrl){

const img=await loadImage(dataUrl);
const c=document.createElement("canvas");
c.width=img.width;
c.height=img.height;
const ctx=c.getContext("2d",{willReadFrequently:true});
ctx.drawImage(img,0,0);

const {data,width,height}=ctx.getImageData(0,0,c.width,c.height);
const at=(x,y)=>(y*width+x)*4;
const b=at(0,height-1);
const bg=[data[b],data[b+1],data[b+2]];
const isBg=(x,y)=>{
const i=at(x,y);
return Math.abs(data[i]-bg[0])<10 && Math.abs(data[i+1]-bg[1])<10 && Math.abs(data[i+2]-bg[2])<10;
};
const rowHas=y=>{for(let x=0;x<width;x+=2)if(!isBg(x,y))return true;return false;};
const colHas=(x,t,bm)=>{for(let y=t;y<=bm;y+=2)if(!isBg(x,y))return true;return false;};

let top=0;while(top<height&&!rowHas(top))top++;
let bottom=height-1;while(bottom>top&&!rowHas(bottom))bottom--;
let left=0;while(left<width&&!colHas(left,top,bottom))left++;
let right=width-1;while(right>left&&!colHas(right,top,bottom))right--;

if(top>=bottom||left>=right)return dataUrl;

const out=document.createElement("canvas");
out.width=right-left+1;
out.height=bottom-top+1;
out.getContext("2d").drawImage(c,left,top,out.width,out.height,0,0,out.width,out.height);
return out.toDataURL("image/png");

}


// Per-row fingerprint of a frame: grayscale samples across each row
function rowSignatures(img,cols){

const c=document.createElement("canvas");
c.width=cols;
c.height=img.height;
const ctx=c.getContext("2d",{willReadFrequently:true});
ctx.drawImage(img,0,0,img.width,img.height,0,0,cols,img.height);
const d=ctx.getImageData(0,0,cols,img.height).data;
const sig=new Float32Array(cols*img.height);
for(let i=0,p=0;i<sig.length;i++,p+=4)
sig[i]=d[p]*0.299+d[p+1]*0.587+d[p+2]*0.114;
return sig;

}


// How many device pixels did the content move up between prev and next?
function findShift(prevSig,nextSig,cols,h,expected){

const bandStart=Math.floor(h*0.25);   // skip top area (fixed headers)
const bandEnd=Math.floor(h*0.95);
let best=0,bestScore=Infinity;

for(let s=0;s<h-bandStart-10;s++){

let diff=0,n=0;
for(let r=bandStart;r<bandEnd && r+s<h;r+=3){
const a=(r+s)*cols,b=r*cols;
for(let x=0;x<cols;x+=2){
diff+=Math.abs(prevSig[a+x]-nextSig[b+x]);
n++;
}
}
if(n<cols*5)break;   // overlap too small to judge
let score=diff/n + Math.abs(s-expected)*0.002;   // tiny bias toward expected step
if(score<bestScore){
bestScore=score;
best=s;
}

}

return {shift:best,score:bestScore};

}


async function captureFigma(){

const url=new URL(location.href);

// Prototype viewer: hide Figma UI and use "fit width" for a clean, 1:1 capture
if(url.pathname.startsWith("/proto/") &&
(url.searchParams.get("hide-ui")!=="1" || url.searchParams.get("scaling")!=="scale-down-width")){
if(confirm("Trace Overlay: reload this prototype in capture mode (Figma UI hidden, fit width)?\n\nClick Full Page Capture again after it reloads.")){
url.searchParams.set("hide-ui","1");
url.searchParams.set("scaling","scale-down-width");
location.href=url.toString();
}
return;
}

window.__traceFullPageBusy=true;
const overlay=document.querySelector("#trace-overlay");
const overlayDisplay=overlay?.style.display;
if(overlay)overlay.style.display="none";

try{

let r=await askBackground({action:"dbgAttach"});
if(r.error)throw new Error(r.error);

// The "debugging this browser" bar changes the viewport size, wait for it
await sleep(1200);

const viewH=window.innerHeight;
const mx=Math.round(window.innerWidth/2);
const my=Math.round(viewH/2);
const wheel=async deltaY=>{
const res=await askBackground({action:"dbgWheel",x:mx,y:my,deltaY});
if(res.error)throw new Error(res.error);
};

// Go to the top of the prototype
for(let i=0;i<5;i++)await wheel(-viewH*5);
await sleep(1000);

const COLS=96;
const step=Math.round(viewH*0.5);   // CSS px per scroll; keeps big overlap for matching

let img=await loadImage(await captureStep());
const scale=img.width/window.innerWidth;
const H=img.height;
let prevSig=rowSignatures(img,COLS);

// pieces: {img, srcY, destY, h}
const pieces=[{img,srcY:0,destY:0,h:H}];
let offset=0;
const maxH=Math.floor(32000);

for(let i=0;i<80;i++){

await wheel(step);
await sleep(750);   // Figma smooth scroll + captureVisibleTab rate limit

img=await loadImage(await captureStep());
const sig=rowSignatures(img,COLS);
const {shift}=findShift(prevSig,sig,COLS,H,Math.round(step*scale));

if(shift<3)break;   // nothing moved: reached the bottom

// Only the newly revealed strip at the bottom of this frame
pieces.push({img,srcY:H-shift,destY:offset+H,h:shift});
offset+=shift;
prevSig=sig;

if(offset+H>=maxH)break;

}

const canvas=document.createElement("canvas");
canvas.width=img.width;
canvas.height=Math.min(offset+H,maxH);
const ctx=canvas.getContext("2d");
pieces.forEach(p=>{
ctx.drawImage(p.img,0,p.srcY,p.img.width,p.h,0,p.destY,p.img.width,p.h);
});

// Scroll prototype back to top
for(let i=0;i<5;i++)await wheel(-viewH*5);

finishFullPage(await trimBackground(canvas.toDataURL("image/png")));

}catch(err){

console.error("Trace Overlay: Figma capture failed",err);
alert("Trace Overlay: Figma capture failed – "+err.message);

}finally{

await askBackground({action:"dbgDetach"});
if(overlay)overlay.style.display=overlayDisplay;
window.__traceFullPageBusy=false;

}

}


async function captureFullPage(){

if(window.__traceFullPageBusy)return;

if(/(^|\.)figma\.com$/.test(location.hostname)){
await captureFigma();
return;
}

// Normal pages: use Chrome's real full-size screenshot
if(!findScroller()){

window.__traceFullPageBusy=true;
const overlay=document.querySelector("#trace-overlay");
const overlayDisplay=overlay?.style.display;
if(overlay)overlay.style.display="none";

try{
const original=await preScroll();
const res=await askBackground({action:"captureFull",width:document.documentElement.clientWidth});
window.scrollTo(0,original);
if(res.image){
finishFullPage(res.image);
return;
}
console.warn("Trace Overlay: full-size capture failed, falling back to stitching",res.error);
}finally{
if(overlay)overlay.style.display=overlayDisplay;
window.__traceFullPageBusy=false;
}

}

await captureStitched();

}


async function captureStitched(){

if(window.__traceFullPageBusy)return;
window.__traceFullPageBusy=true;

const root=document.documentElement;
const scroller=findScroller();   // null = window scrolling

const viewW=root.clientWidth;
const viewH=root.clientHeight;

// Region of the viewport that changes while scrolling (CSS px)
let region,contentH;

if(scroller){
const r=scroller.getBoundingClientRect();
region={
x:Math.max(0,r.left+scroller.clientLeft),
y:Math.max(0,r.top+scroller.clientTop),
w:Math.min(scroller.clientWidth,viewW),
h:Math.min(scroller.clientHeight,viewH)
};
contentH=scroller.scrollHeight;
}else{
region={x:0,y:0,w:viewW,h:viewH};
contentH=Math.max(root.scrollHeight,document.body?.scrollHeight||0);
}

const getScroll=()=>scroller?scroller.scrollTop:window.scrollY;
const setScroll=y=>scroller?(scroller.scrollTop=y):window.scrollTo(0,y);

const scrollEl=scroller||root;
const originalScroll=getScroll();
const originalBehavior=scrollEl.style.scrollBehavior;
scrollEl.style.scrollBehavior="auto";

// Hide our own overlay while capturing
const overlay=document.querySelector("#trace-overlay");
const overlayDisplay=overlay?.style.display;
if(overlay)overlay.style.display="none";

let hiddenFixed=[];
let canvas,ctx,scale,lastImg;

// Full stitched height: area above region + scroll content + area below region
const totalH=region.y+contentH+(viewH-region.y-region.h);

try{

setScroll(0);
let y=0;
let first=true;

while(true){

setScroll(y);
// Let layout/lazy content settle; also respects captureVisibleTab rate limit (~2/sec)
await sleep(first?250:600);

const actualY=getScroll();
const img=await loadImage(await captureStep());
lastImg=img;

if(first){
scale=img.width/window.innerWidth;
// Canvas max dimension is ~32767px in most browsers
const maxH=Math.floor(32000/scale);
canvas=document.createElement("canvas");
canvas.width=Math.round(viewW*scale);
canvas.height=Math.round(Math.min(totalH,maxH)*scale);
ctx=canvas.getContext("2d");
ctx.fillStyle="#fff";
ctx.fillRect(0,0,canvas.width,canvas.height);

// Whole first screen (header, sidebars, etc.)
ctx.drawImage(
img,
0,0,Math.round(viewW*scale),Math.round(viewH*scale),
0,0,Math.round(viewW*scale),Math.round(viewH*scale)
);

// Hide fixed/sticky elements after the first frame so they don't repeat.
// In container mode only touch elements inside the scroller.
(scroller||document.body).querySelectorAll("*").forEach(el=>{
const pos=getComputedStyle(el).position;
if(pos==="fixed"||pos==="sticky"){
hiddenFixed.push([el,el.style.visibility]);
el.style.visibility="hidden";
}
});
first=false;
}

// Scrolling region slice
ctx.drawImage(
img,
Math.round(region.x*scale),Math.round(region.y*scale),
Math.round(region.w*scale),Math.round(region.h*scale),
Math.round(region.x*scale),Math.round((region.y+actualY)*scale),
Math.round(region.w*scale),Math.round(region.h*scale)
);

const next=actualY+region.h;
if(next>=contentH || (region.y+next)*scale>=canvas.height || getScroll()===actualY && y>actualY)break;
y=next;

}

// Area below the scrolling container (footer bars etc.)
const belowH=viewH-region.y-region.h;
if(scroller && belowH>0 && lastImg){
ctx.drawImage(
lastImg,
0,Math.round((region.y+region.h)*scale),Math.round(viewW*scale),Math.round(belowH*scale),
0,Math.round((region.y+contentH)*scale),Math.round(viewW*scale),Math.round(belowH*scale)
);
}

finishFullPage(canvas.toDataURL("image/png"));

}catch(err){

console.error("Trace Overlay: full page capture failed",err);
alert("Trace Overlay: full page capture failed – "+err.message);

}finally{

hiddenFixed.forEach(([el,v])=>el.style.visibility=v);
if(overlay)overlay.style.display=overlayDisplay;
setScroll(originalScroll);
scrollEl.style.scrollBehavior=originalBehavior;
window.__traceFullPageBusy=false;

}

}



function processImage(msg){

if(msg.rect){

let img=new Image();

img.onload=()=>{

let c=document.createElement("canvas");

c.width=msg.rect.width;
c.height=msg.rect.height;

let ctx=c.getContext("2d");


ctx.drawImage(
img,
msg.rect.x,
msg.rect.y,
msg.rect.width,
msg.rect.height,
0,
0,
c.width,
c.height
);


chrome.storage.local.set({
image:c.toDataURL("image/png"),
fullPage:false
});

};

img.src=msg.image;


}else{

chrome.storage.local.set({
image:msg.image,
fullPage:false
});

}

}



function removeOverlay(){
document.querySelector("#trace-overlay")?.remove();
if(window.__traceOverlayUrl){
URL.revokeObjectURL(window.__traceOverlayUrl);
window.__traceOverlayUrl=null;
}
}


function showOverlay(){

chrome.storage.local.get(
["image","fullPage"],
data=>{

if(!data.image)return;


removeOverlay();


let img=document.createElement("img");

img.id="trace-overlay";
img.decoding="async";

// Use a short blob: URL instead of the multi-MB data: URL. A huge data URL in
// the src attribute makes DevTools (Elements/Styles panel) freeze whenever
// the DOM is inspected or a style value is edited.
fetch(data.image).then(r=>r.blob()).then(blob=>{
window.__traceOverlayUrl=URL.createObjectURL(blob);
img.src=window.__traceOverlayUrl;
});


Object.assign(
img.style,
{
position:"fixed",
top:"0",
left:"0",
width:"100vw",
height:"auto",
zIndex:"2147483646",
pointerEvents:"none",
opacity:"0.5",
// Keep the overlay on its own layer so page style edits don't repaint it
willChange:"opacity, transform",
contain:"layout paint"
}
);

// Keep any Ctrl+drag position from before
applyOffset(img);


if(data.fullPage){
// Full page image scrolls with the document
Object.assign(
img.style,
{
position:"absolute",
width:document.documentElement.clientWidth+"px"
}
);
document.documentElement.appendChild(img);
}else{
document.body.appendChild(img);
}

});

}
})();
