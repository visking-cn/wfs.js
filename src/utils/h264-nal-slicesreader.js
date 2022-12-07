/*
 * H264 NAL Slicer
 */
import Event from '../events';
import EventHandler from '../event-handler';
import H264Demuxer from '../demux/h264-demuxer';

let num = 0;
let nalnum = 0;
class SlicesReader extends EventHandler {

    constructor(wfs, config = null) {
        super(wfs, //Event.H264_DATA_PARSING
            );

        this.config = this.wfs.config || config;
        this.h264Demuxer = new H264Demuxer(wfs);
        this.wfs = wfs;
        this.lastBuf = null;
        this.nals = [];
        
        // setInterval(this.outputlog, 1000);
    }

    destroy() {
        this.lastBuf = null;
        this.nals = [];
        EventHandler.prototype.destroy.call(this);
    }

    outputlog(){
        console.log("_read frame count:" + num + " nal count:" + nalnum);
      }
    _read(buffer) {
        var typedAr = null;
        this.nals = [];
        if (!buffer || buffer.byteLength < 1) return;
        if (this.lastBuf) {
            typedAr = new Uint8Array(buffer.byteLength + this.lastBuf.length);
            typedAr.set(this.lastBuf);
            typedAr.set(new Uint8Array(buffer), this.lastBuf.length);
        } else {
            typedAr = new Uint8Array(buffer);
        }
        var lastNalEndPos = 0;
        var b1 = -1; // byte before one
        var b2 = -2; // byte before two
        var nalStartPos = new Array();
        for (var i = 0; i < typedAr.length; i += 2) {
            var b_0 = typedAr[i];
            var b_1 = typedAr[i + 1];
            // if (typedAr[i] === 0 && typedAr[i + 1] === 0){
            //     if (typedAr[i + 2] === 0 && typedAr[i + 3] === 1){
            //         nalStartPos.push(i);
            //     }
            // }
            var b_4 = typedAr[i + 4];
            if (b1 == 0 && b_0 == 0 && b_1 == 0) {
                nalStartPos.push(i - 1);
            } else if (b_1 == 1 && b_0 == 0 && b1 == 0 && b2 == 0) {
                nalStartPos.push(i - 2);
            }
            b2 = b_0;
            b1 = b_1;
        }
        if (nalStartPos.length > 1) {
            for (var i = 0; i < nalStartPos.length - 1; ++i) {
                this.nals.push(typedAr.subarray(nalStartPos[i], nalStartPos[i + 1] + 1));
                lastNalEndPos = nalStartPos[i + 1];
            }
        } else {
            lastNalEndPos = nalStartPos[0];
        }
        if (lastNalEndPos != 0 && lastNalEndPos < typedAr.length) {
            this.lastBuf = typedAr.subarray(lastNalEndPos);
        } else {
            if ( !! !this.lastBuf) {
                this.lastBuf = typedAr;
            }
            var _newBuf = new Uint8Array(this.lastBuf.length + buffer.byteLength);
            _newBuf.set(this.lastBuf);
            _newBuf.set(new Uint8Array(buffer), this.lastBuf.length);
            this.lastBuf = _newBuf;
        }
    }

	onH264DataParsing(event) {
        if(event.payload == 14 || event.payload == 22 || event.payload == 37){
            console.log("音频数据")
        }
		this._read(event.data);
		var $this = this;
        num++;
        nalnum += this.nals.length;
		this.nals.forEach(function(nal) {
			$this.wfs.trigger(Event.H264_DATA_PARSED, {
				data: nal
			});
		});
	}

}

export default SlicesReader;
