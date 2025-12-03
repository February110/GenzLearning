"use client";

import { Mic, MicOff, MonitorUp, PhoneOff, Video as VideoIcon, VideoOff } from "lucide-react";

type MeetingControlsProps = {
  audioEnabled: boolean;
  videoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onLeave: () => void;
  onToggleScreenShare: () => void;
  isScreenSharing: boolean;
};

const controlCls =
  "w-12 h-12 rounded-full flex items-center justify-center text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 shadow-lg";

export default function MeetingControls({
  audioEnabled,
  videoEnabled,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  isScreenSharing,
  onLeave,
}: MeetingControlsProps) {
  return (
    <div className="border-t border-white/10 bg-gradient-to-t from-black via-zinc-950/80 to-zinc-950 p-6">
      <div className="mx-auto flex w-full max-w-lg items-center justify-center gap-4">
        <button
          type="button"
          onClick={onToggleAudio}
          className={`${controlCls} ${audioEnabled ? "bg-white/15 hover:bg-white/25" : "bg-red-500 hover:bg-red-400"}`}
          title={audioEnabled ? "Tắt micro" : "Bật micro"}
        >
          {audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={onToggleVideo}
          className={`${controlCls} ${videoEnabled ? "bg-white/15 hover:bg-white/25" : "bg-red-500 hover:bg-red-400"}`}
          title={videoEnabled ? "Tắt camera" : "Bật camera"}
        >
          {videoEnabled ? <VideoIcon className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={onToggleScreenShare}
          className={`${controlCls} ${isScreenSharing ? "bg-emerald-500 hover:bg-emerald-400" : "bg-white/15 hover:bg-white/25"}`}
          title={isScreenSharing ? "Dừng chia sẻ màn hình" : "Chia sẻ màn hình"}
        >
          <MonitorUp className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onLeave}
          className={`${controlCls} h-14 w-14 bg-red-600 hover:bg-red-500`}
          title="Rời phòng"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
