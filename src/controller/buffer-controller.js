/*
 * Buffer Controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import {ErrorTypes, ErrorDetails} from '../errors';
// import MSE from '../remux/MSE'

class BufferController extends EventHandler {

  constructor(wfs) {
    super(wfs,
      Event.MEDIA_ATTACHING,
      Event.BUFFER_APPENDING,
      Event.BUFFER_RESET,
      Event.BUFFER_SETLIVE
      // Event.AUDIODATA_APPENDING
    );
    
    this.mediaSource = null;
    this.media = null;
    this.pendingTracks = {};
    this.sourceBuffer = {};
    this.segments = [];
 

    // Source Buffer listeners
    this.onsbue = this.onSBUpdateEnd.bind(this);

    this.browserType = 0;
    var BrowName = this.BrowserType();
    if (BrowName === "Edge" || BrowName === "Edg") {
      this.browserType = 2;
    } else if (BrowName === "Edge") {
      this.browserType = 1;
    }
    this.mediaType = 'H264Raw';

    this.websocketName = undefined; 
    this.channelName = undefined;
    this.websocketUrl = undefined;
    this.requestMsg = undefined;

    this.audioMediaSource = null;
    this.audioContext;
    this.audioSourceBuffer;
    this.audioBufs = [];
    this.audioEl;
    this.audiostart = false;
    this.curframetime = 0;
    this.isLive = false;
  }
  BrowserType(){
    var userAgent = navigator.userAgent;  //取得浏览器的userAgent字符串
    var isOpera = userAgent.indexOf("Opera") > -1; //判断是否Opera浏览器
    var isIE = userAgent.indexOf("compatible") > -1 && userAgent.indexOf("MSIE") > -1 && !isOpera; //判断是否IE浏览器
    var isEdge = userAgent.indexOf("Edge") > -1 || userAgent.indexOf("Edg") > -1; //判断是否IE的Edge浏览器
    var isFF = userAgent.indexOf("Firefox") > -1; //判断是否Firefox浏览器
    var isSafari = userAgent.indexOf("Safari") > -1 && userAgent.indexOf("Chrome") == -1; //判断是否Safari浏览器
    var isChrome = userAgent.indexOf("Chrome") > -1 && userAgent.indexOf("Safari") > -1; //判断Chrome浏览器

    if (isIE)
    {
      var reIE = new RegExp("MSIE (\\d+\\.\\d+);");
      reIE.test(userAgent);
      var fIEVersion = parseFloat(RegExp["$1"]);
      if(fIEVersion == 7)
      { return "IE7";}
      else if(fIEVersion == 8)
      { return "IE8";}
      else if(fIEVersion == 9)
      { return "IE9";}
      else if(fIEVersion == 10)
      { return "IE10";}
      else if(fIEVersion == 11)
      { return "IE11";}
      else
      { return "0"}//IE版本过低
    }//isIE end

    if (isFF) { return "FF";}
    if (isOpera) { return "Opera";}
    if (isSafari) { return "Safari";}
    if (isEdge) { return "Edge";}
    if (isChrome) { return "Chrome";}

  }//myBrowser() end
  destroy() {
    EventHandler.prototype.destroy.call(this);
  }
  
  onMediaAttaching(data) {
    let media = this.media = data.media;
    this.mediaType = data.mediaType;
    this.websocketName = data.websocketName;
    this.channelName = data.channelName;
    this.websocketUrl = data.websocketUrl;
    this.requestMsg = data.requestMsg;
    this.callback = data.callback;
    if (media) {
      // setup the media source
      var ms = this.mediaSource = new MediaSource();
      //Media Source listeners
      this.onmso = this.onMediaSourceOpen.bind(this);
      this.onmse = this.onMediaSourceEnded.bind(this);
      this.onmsc = this.onMediaSourceClose.bind(this);
      ms.addEventListener('sourceopen', this.onmso);
      ms.addEventListener('sourceended', this.onmse);
      ms.addEventListener('sourceclose', this.onmsc);
      // link video and media Source
      media.src = URL.createObjectURL(ms);
      // var ms = new MSE(media);
    }
  }

  onMediaDetaching() {
 
  }
   
  onBufferAppending(data) { 
    if (!this.segments) {
      this.segments = [ data ];
    } else {
      this.segments.push(data); 
    }
    this.doAppending(); 
  }
  
  onMediaSourceClose() {
    console.log('media source closed');
  }

  onMediaSourceEnded() {
    // console.log('media source ended');
  }

  onSBUpdateEnd(event) { 
    // Firefox
    if (this.browserType === 1){
      this.mediaSource.endOfStream();
      this.media.play();
    }
    this.appending = false;
    this.doAppending();
    this.updateMediaElementDuration();
 
  }
 
  updateMediaElementDuration() {
    if(this.isLive && this.media.buffered.length > 0){
      let end = this.media.buffered.end(0);
      let diff = end - this.media.currentTime;
      if(diff>0.5){
         this.media.currentTime = end - 0.1;
      }
    }
  }

  onMediaSourceOpen() { 
    let mediaSource = this.mediaSource;
    if (mediaSource) {
      // this.mediaSource.duration = 40;//40/1000;
      // once received, don't listen anymore to sourceopen event
      mediaSource.removeEventListener('sourceopen', this.onmso);
    }

    if (this.mediaType === 'FMp4'){ 
      this.checkPendingTracks();
    }

    this.wfs.trigger(Event.MEDIA_ATTACHED, {media:this.media, websocketUrl:this.websocketUrl, requestMsg:this.requestMsg, channelName:this.channelName, mediaType: this.mediaType, websocketName:this.websocketName, callback:this.callback});
  }

  checkPendingTracks() {  
    this.createSourceBuffers({ tracks : 'video' , mimeType:'' } );
    this.pendingTracks = {};  
  }

  onBufferReset(data) { 
    if (this.mediaType === 'H264Raw'){ 
      this.createSourceBuffers({ tracks : 'video' , mimeType: data.mimeType } );
    }
  }
 
  createSourceBuffers(tracks) {
    var sourceBuffer = this.sourceBuffer,mediaSource = this.mediaSource;
    let mimeType;
    if (tracks.mimeType === ''){
      mimeType = 'video/mp4;codecs=avc1.420028'; // avc1.42c01f avc1.42801e avc1.640028 avc1.420028
    }else{
      mimeType = 'video/mp4;codecs=' + tracks.mimeType;
    }
 
    try {
      let sb = sourceBuffer['video'] = mediaSource.addSourceBuffer(mimeType);
      sb.addEventListener('updateend', this.onsbue);
      tracks.buffer = sb;
    } catch(err) {

    }
    this.wfs.trigger(Event.BUFFER_CREATED, { tracks : tracks } );
    this.media.play();    
  }

  doAppending() {
   
    var wfs = this.wfs, sourceBuffer = this.sourceBuffer, segments = this.segments;
    if (Object.keys(sourceBuffer).length) {
       
      if (this.media.error) {
        // this.media.paused = false;
        this.media.play();
        this.segments = [];
        console.log('trying to append although a media error occured, flush segment and abort');
        return;
      }
      if (this.appending) { 
        return;
      }
         
      if (segments && segments.length) { 
        var segment = segments.shift();
        try {
          if(sourceBuffer[segment.type]) { 
            this.parent = segment.parent;
            sourceBuffer[segment.type].appendBuffer(segment.data);
            this.appendError = 0;
            this.appending = true;
            if(this.callback){
              if(this.curframetime != segment.ftime){
                this.curframetime = segment.ftime;
              }else{
                this.callback({pts:segment.ftime})
              }
            }
          } 
        } catch(err) {
          // in case any error occured while appending, put back segment in segments table 
          console.log("appendBuffer error code:", err.code)
          var event = {type: ErrorTypes.MEDIA_ERROR};
          if(err.code !== 22) {
            if (this.appendError) {
              this.appendError++;
            } else {
              this.appendError = 1;
            }
            event.details = ErrorDetails.BUFFER_APPEND_ERROR;
            event.frag = this.fragCurrent;   
            if (this.appendError > wfs.config.appendErrorMaxRetry) { 
              segments = [];
              event.fatal = true;    
              return;
            } else {
              event.fatal = false; 
            }
          } else { 
            this.segments = [];
            event.details = ErrorDetails.BUFFER_FULL_ERROR; 
            return;
          } 
        }
        
      }
    }
  }
 
}

export default BufferController;
