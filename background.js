chrome.runtime.onMessage.addListener(
(msg,sender)=>{

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

});