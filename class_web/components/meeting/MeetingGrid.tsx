"use client";

import { useEffect, useRef, useState } from "react";
import { Pin } from "lucide-react";

type MeetingGridProps = {
  localStream: MediaStream | null;
  peers: Record<string, MediaStream>;
  namesMap?: Record<string, string>;
  localLabel?: string;
  localAvatar?: string;
  avatarMap?: Record<string, string | undefined>;
  localVideoEnabled?: boolean;
  cameraStates?: Record<string, boolean>;
  screenStreams?: Record<string, MediaStream>;
  screenLabels?: Record<string, string>;
  pinnedId?: string | null;
  onPin?: (id: string | null) => void;
};

type TileProps = {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
  highlight?: boolean;
  pinned?: boolean;
  avatarUrl?: string;
  fallbackName?: string;
  forceAvatar?: boolean;
  onPin?: () => void;
  onUnpin?: () => void;
  large?: boolean;
};

const getInitials = (name?: string) => {
  if (!name) return "??";
  const letters = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase());
  return letters.slice(-2).join("") || "??";
};

function VideoTile({
  stream,
  label,
  muted,
  highlight,
  pinned,
  avatarUrl,
  fallbackName,
  forceAvatar,
  onPin,
  onUnpin,
  large = false,
}: TileProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [hasLiveVideo, setHasLiveVideo] = useState(Boolean(stream));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!stream) {
      el.srcObject = null;
      return;
    }
    el.srcObject = stream;
    el.play().catch(() => {});
  }, [stream]);

  useEffect(() => {
    if (!stream) {
      setHasLiveVideo(false);
      return;
    }
    const updateState = () => {
      const tracks = stream.getVideoTracks();
      if (!tracks.length) {
        setHasLiveVideo(false);
        return;
      }
      const live = tracks.some((track) => track.readyState === "live" && track.enabled !== false && !track.muted);
      setHasLiveVideo(live);
    };
    updateState();
    const tracks = stream.getVideoTracks();
    tracks.forEach((track) => {
      track.addEventListener("mute", updateState);
      track.addEventListener("unmute", updateState);
      track.addEventListener("ended", updateState);
      track.addEventListener("enabled", updateState as any);
      track.addEventListener("disabled", updateState as any);
    });
    return () => {
      tracks.forEach((track) => {
        track.removeEventListener("mute", updateState);
        track.removeEventListener("unmute", updateState);
        track.removeEventListener("ended", updateState);
        track.removeEventListener("enabled", updateState as any);
        track.removeEventListener("disabled", updateState as any);
      });
    };
  }, [stream]);

  const showPlaceholder = forceAvatar || !hasLiveVideo;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-black/40 text-white text-sm shadow-lg ${
        highlight ? "border-indigo-500/70 ring-2 ring-indigo-400/60" : "border-white/10"
      } ${large ? "w-full aspect-video max-h-[520px]" : "aspect-video"}`}
    >
      {stream ? (
        <video ref={ref} muted={muted} autoPlay playsInline className="w-full h-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-white/70">
          <span>Đang chờ video...</span>
        </div>
      )}
      {showPlaceholder && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 backdrop-blur">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={fallbackName || label}
              className="h-16 w-16 rounded-full object-cover border border-white/20"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-white/10 text-white flex items-center justify-center text-xl font-semibold">
              {getInitials(fallbackName || label)}
            </div>
          )}
          <span className="text-xs text-white/70">{stream ? "Camera đang tắt" : "Đang chờ video..."}</span>
        </div>
      )}
      <span className="absolute left-3 bottom-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold backdrop-blur">
        {label}
      </span>
      {onPin && (
        <button
          type="button"
          className={`absolute right-3 top-3 rounded-full border border-white/30 bg-black/40 p-1 text-white transition ${pinned ? "text-yellow-300" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            pinned ? onUnpin?.() : onPin();
          }}
          title={pinned ? "Bỏ ghim" : "Ghim màn hình"}
        >
          <Pin className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default function MeetingGrid({
  localStream,
  peers,
  namesMap = {},
  localLabel,
  localAvatar,
  avatarMap = {},
  localVideoEnabled,
  cameraStates = {},
  screenStreams = {},
  screenLabels = {},
  pinnedId,
  onPin,
}: MeetingGridProps) {
  const remoteEntries = Object.entries(peers);
  const screenEntries = Object.entries(screenStreams);
  type Tile = {
    id: string;
    stream: MediaStream | null;
    label: string;
    muted?: boolean;
    highlight?: boolean;
    avatar?: string;
    forceAvatar?: boolean;
  };
  const cameraTiles: Tile[] = [];
  const screenTiles: Tile[] = [];

  cameraTiles.push({
    id: "local",
    stream: localStream,
    label: localLabel || "Bạn",
    muted: true,
    highlight: true,
    avatar: avatarMap.local ?? localAvatar,
    forceAvatar: localVideoEnabled === false || !localStream,
  });

  remoteEntries.forEach(([id, stream], idx) => {
    cameraTiles.push({
      id,
      stream,
      label: namesMap[id] || `Người tham gia ${idx + 1}`,
      avatar: avatarMap[id],
      forceAvatar: cameraStates[id] === false || !stream,
    });
  });

  screenEntries.forEach(([id, stream]) => {
    screenTiles.push({
      id: `screen-${id}`,
      stream,
      label: screenLabels[id] || `${namesMap[id] || "Người tham gia"} (màn hình)`,
      avatar: avatarMap[id],
    });
  });

  const tiles: Tile[] = [...cameraTiles, ...screenTiles];
  const pinnedTile = pinnedId ? tiles.find((t) => t.id === pinnedId) : null;
  const remainingTiles = pinnedTile ? tiles.filter((t) => t.id !== pinnedId) : tiles;

  const renderTile = (tile: Tile) => (
    <VideoTile
      key={tile.id}
      stream={tile.stream}
      label={tile.label}
      muted={tile.id === "local"}
      highlight={tile.highlight}
      pinned={tile.id === pinnedId}
      avatarUrl={tile.avatar}
      fallbackName={tile.label}
      forceAvatar={tile.forceAvatar}
      onPin={onPin ? () => onPin(tile.id) : undefined}
      onUnpin={onPin ? () => onPin(null) : undefined}
    />
  );

  if (pinnedTile) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto">
        {renderTile({ ...pinnedTile, id: pinnedTile.id })}
        <div className="w-full overflow-hidden">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
            {remainingTiles.slice(0, 6).map((tile) => (
              <div key={tile.id} className="min-w-[160px]">
                {renderTile(tile)}
              </div>
            ))}
            {remainingTiles.length > 6 && (
              <div className="flex items-center justify-center rounded-2xl border border-white/15 bg-black/40 text-white/80 text-sm">
                +{remainingTiles.length - 6} thành viên
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(220px,1fr))] auto-rows-[minmax(200px,1fr)]">
      {tiles.slice(0, 9).map(renderTile)}
      {tiles.length > 9 && (
        <div className="flex items-center justify-center rounded-2xl border border-white/15 bg-black/40 text-white/80 text-sm">
          +{tiles.length - 9} thành viên
        </div>
      )}
    </div>
  );
}
