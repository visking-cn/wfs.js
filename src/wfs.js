/**
 * WFS interface, Jeff Yang 2016.10
 */
'use strict';

import Event from './events';
import FlowController from  './controller/flow-controller'; 
import BufferController from  './controller/buffer-controller';
import EventEmitter from 'events';
import XhrLoader from './utils/xhr-loader';
import WebsocketLoader from './loader/websocket-loader';
import AudioPlay from './controller/audioplay';


class Wfs {

  static get version() {
    // replaced with browserify-versionify transform
    return '__VERSION__'+'v.0.0.0.1';
  }

  static isSupported() {
    return (window.MediaSource &&
            typeof window.MediaSource.isTypeSupported === 'function' &&
            window.MediaSource.isTypeSupported('video/mp4; codecs="avc1.42c01f,mp4a.40.2"'));
  }
  
  static get Events() {
    return Event;
  }
 
  static get DefaultConfig() {
    if(!Wfs.defaultConfig) {
       Wfs.defaultConfig = {
        autoStartLoad: true,
        startPosition: -1,
        debug: false, 
        fLoader: undefined,
        loader: XhrLoader,
        //loader: FetchLoader,
        // fmp4FileUrl: 'xxxx.mp4',
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 1000,
        fragLoadingMaxRetryTimeout: 64000,
        fragLoadingLoopThreshold: 3,
        forceKeyFrameOnDiscontinuity: true,
        appendErrorMaxRetry: 3
      };
    }
    return Wfs.defaultConfig;
  }

  static set DefaultConfig(defaultConfig) {
    Wfs.defaultConfig = defaultConfig;
  }

  constructor(config = {}) {

    var defaultConfig = Wfs.DefaultConfig;
    for (var prop in defaultConfig) {
        if (prop in config) { continue; }
        config[prop] = defaultConfig[prop];
    }
    this.config = config;  
    // observer setup
    var observer = this.observer = new EventEmitter();
    observer.trigger = function trigger (event, ...data) {
      observer.emit(event, event, ...data);
    };

    observer.off = function off (event, ...data) {
      observer.removeListener(event, ...data);
    };
    this.on = observer.on.bind(observer);
    this.off = observer.off.bind(observer);
    this.trigger = observer.trigger.bind(observer);

    this.flowController = new FlowController(this);
    this.bufferController = new BufferController(this);
  //  this.fileLoader = new FileLoader(this);
    this.websocketLoader = new WebsocketLoader(this);
    this.audioplay = new AudioPlay(this);
    this.mediaType = undefined; 
    this.callback = undefined;
    this.audioCtx = undefined;
    this.source = undefined;
    this.audioplay = false;
  }

  destroy() {
    this.flowController.destroy();
    this.bufferController.destroy();
 //   this.fileLoader.destroy();
    this.websocketLoader.destroy();
  }

  // attachMedia(media, websocketurl, requestmsg, channelName='chX',mediaType='H264Raw', websocketName='play2') { // 'H264Raw' 'FMp4'  
  attachMediaEx(config) { // 'H264Raw' 'FMp4'    
    this.mediaType = config.mediaType; 
    this.media = config.media;
    this.callback = config.callback
    this.bufferController.isLive = config.isLive
    // this.media.playbackRate = 1.5;
    this.websocketUrl = config.websocketurl;
    this.requestMsg = config.requestmsg;
    // this.trigger(Event.MEDIA_ATTACHING, {media:media, websocketUrl: websocketurl, requestMsg:requestmsg, channelName:channelName, mediaType:mediaType, websocketName:"ws" });
    this.trigger(Event.MEDIA_ATTACHING, {media:this.media, websocketUrl: this.websocketurl, requestMsg:this.requestmsg, channelName:config.channelName, mediaType:this.mediaType, websocketName:"ws", callback:this.callback });
  }  
  attachMedia(media, websocketurl, requestmsg, isLive, callback, channelName='chX', mediaType='H264Raw') { // 'H264Raw' 'FMp4'    
    this.mediaType = mediaType; 
    this.media = media;
    this.callback = callback
    if(isLive != undefined)
      this.bufferController.isLive = isLive
    // this.media.playbackRate = 1.5;
    this.websocketUrl = websocketurl;
    this.requestMsg = requestmsg;
    // this.trigger(Event.MEDIA_ATTACHING, {media:media, websocketUrl: websocketurl, requestMsg:requestmsg, channelName:channelName, mediaType:mediaType, websocketName:"ws" });
    this.trigger(Event.MEDIA_ATTACHING, {media:media, websocketUrl: websocketurl, requestMsg:requestmsg, channelName:channelName, mediaType:mediaType, websocketName:"ws", callback:callback });
  }
  
  attachWebsocket(websocket, requestMsg, channelName, callback) { 
    this.trigger(Event.WEBSOCKET_ATTACHING, {websocket: websocket, mediaType:this.mediaType, channelName:channelName, sendmsg:requestMsg, callback:callback });
  }
  send(msg){
    this.trigger(Event.WEBSOCKET_MESSAGE_SENDING, msg);
  }
  startAudio(){
    this.trigger(Event.INIT_AUDIOPLAY, { type: "start"});
  }
  closeAudio(){
    this.trigger(Event.INIT_AUDIOPLAY, { type: "close"});
  }
}

export default Wfs;
