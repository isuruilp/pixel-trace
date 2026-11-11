chrome.runtime.onMessage.addListener(
(msg,sender,sendResponse)=>{

if(msg.action==="capture"){

chrome.tabs.captureVisibleTab(
null,
{
format:"png"
},
(image)=>{

chrome.tabs.sendMessage(
sender.tab.id,
{
action:"saveImage",
image:image,
rect:msg.rect || null
}
);

});

}


// Single viewport capture used by full-page stitching (responds directly)
if(msg.action==="captureStep"){

chrome.tabs.captureVisibleTab(
sender.tab.windowId,
{
format:"png"
},
(image)=>{
sendResponse({
image:image || null,
error:chrome.runtime.lastError?.message || null
});
});

return true;

}


// True full-size screenshot via DevTools protocol (same as DevTools "Capture full size screenshot")
if(msg.action==="captureFull"){

captureFullCDP(sender.tab.id,msg.width)
.then(image=>sendResponse({image}))
.catch(err=>sendResponse({error:err.message||String(err)}));

return true;

}

// Debugger helpers used by the Figma scroll-capture (driven from content.js)
if(msg.action==="dbgAttach"){
chrome.debugger.attach({tabId:sender.tab.id},"1.3")
.then(()=>sendResponse({ok:true}))
.catch(err=>{
// Already attached is fine
if(/already attached/i.test(err.message))sendResponse({ok:true});
else sendResponse({error:err.message});
});
return true;
}

if(msg.action==="dbgDetach"){
chrome.debugger.detach({tabId:sender.tab.id})
.then(()=>sendResponse({ok:true}))
.catch(()=>sendResponse({ok:true}));
return true;
}

// Real (trusted) mouse wheel, so Figma's canvas scrolls like a user scrolled it
if(msg.action==="dbgWheel"){
const t={tabId:sender.tab.id};
chrome.debugger.sendCommand(t,"Input.dispatchMouseEvent",{type:"mouseMoved",x:msg.x,y:msg.y})
.then(()=>chrome.debugger.sendCommand(t,"Input.dispatchMouseEvent",{
type:"mouseWheel",x:msg.x,y:msg.y,deltaX:0,deltaY:msg.deltaY
}))
.then(()=>sendResponse({ok:true}))
.catch(err=>sendResponse({error:err.message}));
return true;
}


// Figma prototype: temporarily make the viewport very tall so Figma renders
// the whole frame without scrolling, then screenshot the viewport.
if(msg.action==="captureFigma"){

captureFigmaCDP(sender.tab.id,msg.width,msg.height)
.then(image=>sendResponse({image}))
.catch(err=>sendResponse({error:err.message||String(err)}));

return true;

}

});



async function captureFigmaCDP(tabId,width,height){

const target={tabId};

await chrome.debugger.attach(target,"1.3");

try{

await chrome.debugger.sendCommand(target,"Emulation.setDeviceMetricsOverride",{
width:Math.round(width),
height:Math.round(height),
deviceScaleFactor:1,
mobile:false
});

// Give Figma time to resize the canvas and re-render at full resolution
await new Promise(r=>setTimeout(r,3000));

const shot=await chrome.debugger.sendCommand(target,"Page.captureScreenshot",{
format:"png",
fromSurface:true
});

return "data:image/png;base64,"+shot.data;

}finally{

await chrome.debugger.sendCommand(target,"Emulation.clearDeviceMetricsOverride").catch(()=>{});
await chrome.debugger.detach(target).catch(()=>{});

}

}



async function captureFullCDP(tabId,width){

const target={tabId};

await chrome.debugger.attach(target,"1.3");

try{

const measure=async()=>{
const m=await chrome.debugger.sendCommand(target,"Page.getLayoutMetrics");
const size=m.cssContentSize || m.contentSize;
// Very tall screenshots break in Chrome (GPU texture limit), cap it
return Math.min(Math.ceil(size.height),16000);
};

// Make the viewport as tall as the page and take a normal screenshot.
// (captureBeyondViewport repeats <video>/composited layers like hero videos.)
let height=await measure();

for(let i=0;i<3;i++){
await chrome.debugger.sendCommand(target,"Emulation.setDeviceMetricsOverride",{
width:Math.round(width),
height,
deviceScaleFactor:1,
mobile:false
});
await new Promise(r=>setTimeout(r,800));
const h=await measure();
if(h===height)break;
height=h;   // page height changed after resize, adjust
}

// Let video frames / images paint at the new size
await new Promise(r=>setTimeout(r,700));

const shot=await chrome.debugger.sendCommand(target,"Page.captureScreenshot",{
format:"png",
fromSurface:true,
clip:{x:0,y:0,width:Math.round(width),height,scale:1}
});

return "data:image/png;base64,"+shot.data;

}finally{

await chrome.debugger.sendCommand(target,"Emulation.clearDeviceMetricsOverride").catch(()=>{});
await chrome.debugger.detach(target).catch(()=>{});

}

}
