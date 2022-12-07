import Event from '../events';
import EventHandler from '../event-handler';
// import {playAudio} from "./audio.sj"
// import * as audioParams from './audio'

const DECODER_WEBAUDIO = 0;
const DECODER_MSE = 1;
class AudioPlay  extends EventHandler {
    constructor(wfs) {
        super(wfs,
          Event.AUDIODATA_APPENDING,
          Event.INIT_AUDIOPLAY
        );
        this.CHUNK_SIZE = 4096;
        this.audioContext;
        this.audioSource;
        this.fileBuffer = [];
        this.BufferSize = 0;
        this.audioEl;
        this.mediaSource;
        this.sourceBuffer;
        this.isMSEStart = false;
        this.audioDecoder = 0;//0 - audio context; 1 - media source extention
        this.scriptBuffer;
        this.scriptPos = 0;

        this.scriptNode;
        this.state = 0;

        this.isInit = false

        this.onmseopen = this.sourceOpenCallback.bind(this);
        this.onmseended = this.updateEndCallback.bind(this);
      }
    onInitAudioPlay(data){
        if(data.type == "start"){
            if(this.audioDecoder === DECODER_WEBAUDIO){
                this.init();
            }else if(this.audioDecoder === DECODER_MSE)
                this.initMSE()
        }else{
            this.closeAudio();
        }
        
    }
    onAudioDataAppending(data){
        if(!this.isInit)
            return
        this.fileBuffer.push(data.data);
        this.BufferSize += data.data.byteLength;
        if(this.audioDecoder === DECODER_MSE){
            if(this.sourceBuffer && !this.sourceBuffer.updating) {
                this.loadNextBuffer()
            }
            if(!this.isMSEStart) {
                this.isMSEStart = true
                this.startMSEPlay()
            }
        }else{
            if(this.fileBuffer.length > 3 && this.state === 0){
                let dataBuffer = this.mergeBuffer(this.fileBuffer, this.BufferSize)
                this.getData(dataBuffer)
                this.fileBuffer = [];
                this.BufferSize = 0
            }
        }
    }
    closeAudio(){
        this.isInit = false;
    }
    initWebAudio() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    initMSE() {
        this.mediaSource = new MediaSource();
        this.mediaSource.addEventListener('sourceopen', this.onmseopen, false);
        this.mediaSource.addEventListener('webkitsourceopen', this.onmseopen, false);
        this.mediaSource.addEventListener('sourceclose', this.sourceCloseCallback, false);
        this.mediaSource.addEventListener('webkitsourceclose', this.sourceCloseCallback, false);
        this.mediaSource.addEventListener('sourceended', this.sourceEndedCallback, false);
        this.mediaSource.addEventListener('webkitsourceended', this.sourceEndedCallback, false);
    
        this.audioEl = document.createElement('audio');
        this.audioEl.src = window.URL.createObjectURL(this.mediaSource);
    
        this.initWebAudio();
        var source = this.audioContext.createMediaElementSource(this.audioEl);
        source.connect(this.audioContext.destination);
        this.isInit = true;
    }
    
    sourceOpenCallback() {
        console.log('Media Source Ready')
        this.sourceBuffer = this.mediaSource.addSourceBuffer('audio/aac')
        this.sourceBuffer.addEventListener('updateend', this.onmseended, false)
        // this.loadNextBuffer();
    }
    sourceCloseCallback() {
        // console.log('Media Source closed')
    }
    sourceEndedCallback() {
        // console.log('Media Source ended')
    }
    updateEndCallback() {
        // console.log('load next buffer in update end')
        // this.loadNextBuffer()
    }
    
    loadNextBuffer() {
        if(this.fileBuffer.length > 3){
            let dataBuffer = this.mergeBuffer(this.fileBuffer, this.BufferSize)
            this.sourceBuffer.appendBuffer(dataBuffer);
            this.fileBuffer = [];
            this.BufferSize = 0
        }
    }
    
    startMSEPlay() {
        if (this.audioEl.paused) {
            this.audioEl.play();
        }
    }

    mergeBuffer(arr, size) {
        var res = new Uint8Array(size)
        var pos = 0;
        for(let i=0; i< arr.length; i++) {
            var tmp = new Uint8Array(arr[i])
            res.set(tmp, pos)
            pos += tmp.byteLength
        }
        return res.buffer
    }
    
    
    init() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.audioSource = this.audioContext.createBufferSource();

        // Create a ScriptProcessorNode with a bufferSize of 4096 and a single input and output channel
        let bufferSize = 1024
        this.scriptNode = this.audioContext.createScriptProcessor(bufferSize, 2, 2);
        console.log(this.scriptNode.bufferSize);

        let _this = this;
        // Give the node a function to process audio events
        this.scriptNode.onaudioprocess = function(audioProcessingEvent) {
            if(_this.scriptBuffer) {
                var inputBuffer = _this.scriptBuffer;
                var outputBuffer = audioProcessingEvent.outputBuffer;
                var lastLength = _this.scriptBuffer.length - _this.scriptPos
                if(lastLength > 0){
                    var currentPos = _this.scriptPos
                    let copyLength = Math.min(lastLength, outputBuffer.length)
                    _this.scriptPos += copyLength
                    for (var channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
                        var inputData = inputBuffer.getChannelData(channel);
                        var outputData = outputBuffer.getChannelData(channel);
                        for (var sample = 0; sample < copyLength; sample++) {
                            outputData[sample] = inputData[sample + currentPos];
                        }
                    }
                }
                if(lastLength === 0)
                    _this.state = 0;
            }
        }
        this.scriptNode.connect(this.audioContext.destination);
        this.isInit = true;
      }
    getData(audioData) {
        let _this = this;
        this.audioContext.decodeAudioData(audioData, function(buffer) {
            _this.state = 1;
            _this.scriptPos = 0;
            _this.scriptBuffer = buffer;
        },
        function(e){"Error with decoding audio data" + e.err});
    }
}
export default AudioPlay;