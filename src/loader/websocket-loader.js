/*
 * Websocket Loader
*/

import Event from '../events';
import EventHandler from '../event-handler';
import SlicesReader from '../utils/h264-nal-slicesreader.js';
import ExpGolomb from '../demux/exp-golomb.js'

let count = 0;
const blob2ArrayBuffer = async blob => {
  if (blob instanceof Blob) {
    const arrayBuffer = await new Response(blob).arrayBuffer()
    return arrayBuffer;
  }
}
function getUint64(dataview, byteOffset, littleEndian) {
  // 将 64 位整数值分成两份 32 位整数值
  const left =  dataview.getUint32(byteOffset, littleEndian);
  const right = dataview.getUint32(byteOffset+4, littleEndian);

  // 合并两个 32 位整数值
  const combined = littleEndian? left + 2**32*right : 2**32*left + right;

  if (!Number.isSafeInteger(combined))
    console.warn(combined, 'exceeds MAX_SAFE_INTEGER. Precision may be lost');

  return combined;
}

class WebsocketLoader extends EventHandler {
  constructor(wfs) {
    super(wfs, 
    Event.WEBSOCKET_ATTACHING,
    Event.WEBSOCKET_DATA_UPLOADING,
    Event.WEBSOCKET_MESSAGE_SENDING)   
    // this.buf = null;
    this.slicesReader = new SlicesReader(wfs);
    this.mediaType = undefined; 
    this.channelName = undefined; 
    this.sendmsg = undefined;
    this.recvcount = 0;
    this.callback = undefined;
    this.recvsize = 0;
    this.lastrecvtime = 0;
    this.recvcount = 0;
    this.audioCtx = null;
    this.source = null;
    this.scriptNode = null;

    this.audiochannel = -1;
    this.audioBuffers = [];
    this.audiodecodebufs = [];
    this.audioplaytime = 0;
    this.scriptPos = 0;
  }
  destroy() { 
	!!this.client && this.client.close();
	this.slicesReader.destroy();
    EventHandler.prototype.destroy.call(this);
  }

  onWebsocketAttaching(data) {
  	this.mediaType = data.mediaType; 
  	this.channelName = data.channelName;  
    this.sendmsg = data.sendmsg;
    this.callback = data.callback;
    if( data.websocket instanceof WebSocket ) {
      this.client = data.websocket;
      this.client.onopen = this.initSocketClient.bind(this);   
      this.client.onclose = function(e) {
          console.log('Websocket Disconnected!');
      }; 
    }    
  }
  initSocketClient(client){
    this.client.onmessage = this.receiveSocketMessage.bind(this);
    this.wfs.trigger(Event.WEBSOCKET_MESSAGE_SENDING, this.sendmsg);
    console.log('Websocket Open!'); 
  }

  async receiveSocketMessage (event) {
    if (typeof event.data === "string") {
      var obj = JSON.parse(event.data);
      if (obj.classe == "Play") {
        this.client.binaryType = 'arraybuffer'
      }
    }else{
      let view = new DataView(event.data.slice(0,16), 0)
      let etype = view.getUint8(0);
      let u8arr = new Uint8Array(event.data.slice(16))
      if(etype === 0){  //264
        console.log()
        this.wfs.trigger(Event.H264_DATA_PARSED, { data: u8arr, ftime:parseInt(view.getBigInt64(4, 8))});
      }else if (etype === 19 || etype === 20 || etype === 14 || etype === 22 || etype === 37) {
          this.wfs.trigger(Event.AUDIODATA_APPENDING, {data:u8arr}); 
      } else{
        count ++;
      }
      if(this.callback != undefined){
        let t = parseInt((new Date().getTime() - this.lastrecvtime)/1000);
        // this.callback({pts:datapts, kbps:parseInt(this.recvsize/t)})
      }
      // if (this.mediaType ==='FMp4'){
      //   this.wfs.trigger(Event.WEBSOCKET_ATTACHED, {payload: event.data });
      // } 
    }
  }


  onWebsocketDataUploading( event ){
    this.client.send( event.data );
  }
  
  onWebsocketMessageSending( event ){  
    this.client.send( event );
    // this.client.send( JSON.stringify({ t: event.commandType, c:event.channelName, v: event.commandValue  }) );
  }

}

export default WebsocketLoader;  
