const controls=document.getElementById("controls");

function send(action,data={}){
chrome.tabs.query(
{active:true,currentWindow:true},
tabs=>{
chrome.scripting.executeScript({
target:{tabId:tabs[0].id},
files:["content.js"]
},()=>{
chrome.tabs.sendMessage(
tabs[0].id,
{action,...data}
);
});
});
}


manual.onclick=()=>{
send("manual");
controls.classList.add("hidden");
};


auto.onclick=()=>{
send("auto");
controls.classList.remove("hidden");
};


show.onclick=()=>{
send("show");
};


hide.onclick=()=>{
send("hide");
};


clear.onclick=()=>{
send("clear");
controls.classList.add("hidden");
};


opacity.oninput=e=>{
send(
"opacity",
{
value:e.target.value/100
}
);
};


chrome.storage.local.get(
["image"],
data=>{
if(data.image){
controls.classList.remove("hidden");
}
}
);