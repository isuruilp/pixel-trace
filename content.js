let selectionLayer;


chrome.runtime.onMessage.addListener(msg=>{


if(msg.action==="manual")
manualSelect();


if(msg.action==="auto")
captureAuto();


if(msg.action==="saveImage")
processImage(msg);


if(msg.action==="show")
showOverlay();


if(msg.action==="hide")
document.querySelector("#trace-overlay")?.style.setProperty(
"display",
"none"
);


if(msg.action==="clear")
document.querySelector("#trace-overlay")?.remove();


if(msg.action==="opacity"){
let img=document.querySelector("#trace-overlay");
if(img)
img.style.opacity=msg.value;
}

});



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



function processImage(msg){

let finalImage=msg.image;


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
image:c.toDataURL("image/png")
});

};

img.src=msg.image;


}else{

chrome.storage.local.set({
image:msg.image
});

}

}



function showOverlay(){

chrome.storage.local.get(
["image"],
data=>{

if(!data.image)return;


document.querySelector("#trace-overlay")?.remove();


let img=document.createElement("img");

img.id="trace-overlay";
img.src=data.image;


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
opacity:"0.5"
}
);


document.body.appendChild(img);

});

}