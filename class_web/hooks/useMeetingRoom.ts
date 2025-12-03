"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HubConnection } from "@microsoft/signalr";
import { HubConnectionState } from "@microsoft/signalr";
import { getSignalR } from "@/lib/signalr";

type PeersRecord = Record<string, MediaStream>;
type ChatMessage = {
  id: string;
  userId: string;
  userName: string;
  message: string;
  sentAt: string;
};
type MeetingRoomOptions = {
  onMeetingEnded?: (payload?: any) => void;
  resolveName?: (userId: string) => string | undefined;
};

export default function useMeetingRoom(roomCode?: string, options: MeetingRoomOptions = {}) {
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenSendersRef = useRef<Map<string, RTCRtpSender[]>>(new Map());
  const pendingScreenRef = useRef<Set<string>>(new Set());
  const connectionRef = useRef<HubConnection | null>(null);
  const optionsRef = useRef<MeetingRoomOptions>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<PeersRecord>({});
  const cameraStreamsRef = useRef<PeersRecord>({});
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});
  const [connectionUsers, setConnectionUsers] = useState<Record<string, string>>({});
  const [screenStreams, setScreenStreams] = useState<Record<string, MediaStream>>({});
  const [screenLabels, setScreenLabels] = useState<Record<string, string>>({});
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [cameraStates, setCameraStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const hubBase = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5081/api";
    return base.replace(/\/api$/, "");
  }, []);

  const ensureConnection = useCallback(() => {
    if (!connectionRef.current) {
      connectionRef.current = getSignalR(hubBase, "/hubs/meeting");
    }
    return connectionRef.current;
  }, [hubBase]);

  const attachStream = useCallback((connectionId: string, stream: MediaStream) => {
    const isPendingScreen = pendingScreenRef.current.has(connectionId);
    const hasCamera = Boolean(cameraStreamsRef.current[connectionId]);
    if (isPendingScreen || hasCamera) {
      pendingScreenRef.current.delete(connectionId);
      setScreenStreams((prev) => {
        const next = { ...prev, [connectionId]: stream };
        return next;
      });
      return;
    }
    setPeers((prev) => {
      const next = { ...prev, [connectionId]: stream };
      cameraStreamsRef.current = next;
      return next;
    });
  }, []);

  const removePeer = useCallback((connectionId: string) => {
    setPeers((prev) => {
      if (!(connectionId in prev)) return prev;
      const clone = { ...prev };
      delete clone[connectionId];
      cameraStreamsRef.current = clone;
      return clone;
    });
    setScreenStreams((prev) => {
      if (!(connectionId in prev)) return prev;
      const clone = { ...prev };
      delete clone[connectionId];
      return clone;
    });
    setScreenLabels((prev) => {
      if (!(connectionId in prev)) return prev;
      const clone = { ...prev };
      delete clone[connectionId];
      return clone;
    });
    screenSendersRef.current.delete(connectionId);
    const peer = peersRef.current.get(connectionId);
    if (peer) peer.close();
    peersRef.current.delete(connectionId);
  }, []);

  const createPeer = useCallback(
    (connectionId: string) => {
      let peer = peersRef.current.get(connectionId);
      if (peer) return peer;

      const iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
      if (process.env.NEXT_PUBLIC_TURN_URL) {
        iceServers.push({
          urls: process.env.NEXT_PUBLIC_TURN_URL!,
          username: process.env.NEXT_PUBLIC_TURN_USER,
          credential: process.env.NEXT_PUBLIC_TURN_CRED,
        });
      }

      peer = new RTCPeerConnection({ iceServers });
      const currentStream = streamRef.current;
      if (currentStream) {
        currentStream.getTracks().forEach((track) => peer!.addTrack(track, currentStream));
      }

      const screenStream = screenStreamRef.current;
      if (screenStream) {
        const senders = screenStream.getTracks().map((track) => peer!.addTrack(track, screenStream));
        const existing = screenSendersRef.current.get(connectionId) ?? [];
        screenSendersRef.current.set(connectionId, [...existing, ...senders]);
      }

      peer.ontrack = (event) => {
        const stream = event.streams[0];
        if (stream) attachStream(connectionId, stream);
      };

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          connectionRef.current?.invoke("SendIceCandidate", connectionId, event.candidate).catch(() => {});
        }
      };

      peer.onconnectionstatechange = () => {
        if (["failed", "disconnected", "closed"].includes(peer!.connectionState)) {
          removePeer(connectionId);
        }
      };

      peersRef.current.set(connectionId, peer);
      return peer;
    },
    [attachStream, removePeer]
  );

  const renegotiatePeer = useCallback(async (connectionId: string) => {
    const pc = peersRef.current.get(connectionId);
    const conn = connectionRef.current;
    if (!pc || !conn) return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await conn.invoke("SendOffer", connectionId, offer);
  }, []);

  const renegotiateAll = useCallback(async () => {
    const promises: Promise<void>[] = [];
    peersRef.current.forEach((_, id) => {
      promises.push(renegotiatePeer(id));
    });
    await Promise.all(promises);
  }, [renegotiatePeer]);

  const leaveRoom = useCallback(async () => {
    const conn = connectionRef.current;
    if (conn && conn.state !== HubConnectionState.Disconnected) {
      await conn.invoke("LeaveRoom").catch(() => {});
    }
    if (conn) {
      conn.off("ParticipantJoined");
      conn.off("ReceiveOffer");
      conn.off("ReceiveAnswer");
      conn.off("ReceiveIceCandidate");
      conn.off("ParticipantLeft");
      conn.off("MeetingEnded");
      if (conn.state !== HubConnectionState.Disconnected) {
        await conn.stop().catch(() => {});
      }
      connectionRef.current = null;
    }

    peersRef.current.forEach((peer) => peer.close());
    peersRef.current.clear();
    setPeers({});

    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    streamRef.current = null;
    setLocalStream(null);
    setAudioEnabled(true);
    setVideoEnabled(true);
    setParticipantNames({});
    setConnectionUsers({});
    setScreenStreams({});
    setScreenLabels({});
    setIsScreenSharing(false);
    setChatMessages([]);
    setCameraStates({});
    screenStreamRef.current = null;
    screenSendersRef.current.clear();
    pendingScreenRef.current.clear();
  }, []);

  const registerHandlers = useCallback(
    (conn: HubConnection) => {
      const handleParticipantJoined = async ({ connectionId, userName, userId, cameraOn }: any) => {
        if (!connectionId) return;
        const userKey = userId ? String(userId) : undefined;
        setConnectionUsers((prev) => ({ ...prev, [connectionId]: userKey ?? prev[connectionId] }));
        const resolvedName = userName || (userKey ? optionsRef.current.resolveName?.(userKey) : undefined);
        if (resolvedName) {
          setParticipantNames((prev) => ({ ...prev, [connectionId]: resolvedName }));
        }
        setCameraStates((prev) => ({ ...prev, [connectionId]: cameraOn !== false }));
        const peer = createPeer(connectionId);
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        await conn.invoke("SendOffer", connectionId, offer);
      };

      const handleOffer = async ({ from, payload }: any) => {
        if (!from || !payload) return;
        const peer = createPeer(from);
        await peer.setRemoteDescription(new RTCSessionDescription(payload));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await conn.invoke("SendAnswer", from, answer);
      };

      const handleAnswer = async ({ from, payload }: any) => {
        const peer = peersRef.current.get(from);
        if (!peer || !payload) return;
        await peer.setRemoteDescription(new RTCSessionDescription(payload));
      };

      const handleIce = async ({ from, candidate }: any) => {
        if (!candidate) return;
        const peer = peersRef.current.get(from);
        if (!peer) return;
        await peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      };

      const handleLeft = ({ connectionId }: any) => {
        if (!connectionId) return;
        removePeer(connectionId);
        setParticipantNames((prev) => {
          if (!(connectionId in prev)) return prev;
          const clone = { ...prev };
          delete clone[connectionId];
          return clone;
        });
        setConnectionUsers((prev) => {
          if (!(connectionId in prev)) return prev;
          const clone = { ...prev };
          delete clone[connectionId];
          return clone;
        });
        setCameraStates((prev) => {
          if (!(connectionId in prev)) return prev;
          const clone = { ...prev };
          delete clone[connectionId];
          return clone;
        });
      };

      const handleMeetingEnded = async (payload: any) => {
        if (payload?.roomCode && roomCode && payload.roomCode !== roomCode) return;
        await leaveRoom();
        optionsRef.current.onMeetingEnded?.(payload);
      };

      const handleSnapshot = (items: any[]) => {
        if (!Array.isArray(items)) return;
        const nextNames: Record<string, string> = {};
        const nextConnections: Record<string, string> = {};
        const nextCameras: Record<string, boolean> = {};
        for (const item of items) {
          const id = item?.connectionId;
          if (!id) continue;
          const userKey = item?.userId ? String(item.userId) : undefined;
          if (userKey) nextConnections[id] = userKey;
          const resolved = item?.userName || (userKey ? optionsRef.current.resolveName?.(userKey) : undefined);
          if (resolved) nextNames[id] = resolved;
          nextCameras[id] = item?.cameraOn !== false;
        }
        setParticipantNames(nextNames);
        setConnectionUsers(nextConnections);
        setCameraStates((prev) => ({ ...prev, ...nextCameras }));
      };

      const handleScreenUpdated = ({ connectionId, active, label }: any) => {
        if (!connectionId) return;
        if (active) {
          pendingScreenRef.current.add(connectionId);
          setScreenLabels((prev) => ({ ...prev, [connectionId]: label || "Chia sẻ màn hình" }));
        } else {
          pendingScreenRef.current.delete(connectionId);
          setScreenStreams((prev) => {
            if (!(connectionId in prev)) return prev;
            const clone = { ...prev };
            delete clone[connectionId];
            return clone;
          });
          setScreenLabels((prev) => {
            if (!(connectionId in prev)) return prev;
            const clone = { ...prev };
            delete clone[connectionId];
            return clone;
          });
        }
      };

      const handleChatMessage = (payload: any) => {
        if (!payload?.message) return;
        const id = payload?.id ?? `${Date.now()}-${Math.random()}`;
        setChatMessages((prev) => [
          ...prev,
          {
            id,
            userId: payload?.userId ?? "",
            userName: payload?.userName ?? "Ẩn danh",
            message: payload.message,
            sentAt: payload?.sentAt ?? new Date().toISOString(),
          },
        ]);
      };
      const handleCameraUpdated = ({ connectionId, enabled }: any) => {
        if (!connectionId) return;
        setCameraStates((prev) => ({ ...prev, [connectionId]: enabled !== false }));
      };

      conn.off("ParticipantJoined");
      conn.off("ReceiveOffer");
      conn.off("ReceiveAnswer");
      conn.off("ReceiveIceCandidate");
      conn.off("ParticipantLeft");
      conn.off("MeetingEnded");
      conn.off("ParticipantsSnapshot");
      conn.off("ScreenShareUpdated");
      conn.off("ReceiveChatMessage");
      conn.off("CameraStateUpdated");

      conn.on("ParticipantJoined", handleParticipantJoined);
      conn.on("ReceiveOffer", handleOffer);
      conn.on("ReceiveAnswer", handleAnswer);
      conn.on("ReceiveIceCandidate", handleIce);
      conn.on("ParticipantLeft", handleLeft);
      conn.on("MeetingEnded", handleMeetingEnded);
      conn.on("ParticipantsSnapshot", handleSnapshot);
      conn.on("ScreenShareUpdated", handleScreenUpdated);
      conn.on("ReceiveChatMessage", handleChatMessage);
      conn.on("CameraStateUpdated", handleCameraUpdated);
    },
    [createPeer, removePeer, leaveRoom, roomCode]
  );

  const joinRoom = useCallback(async () => {
    if (!roomCode) throw new Error("Missing room code");

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    streamRef.current = stream;
    setLocalStream(stream);
    setAudioEnabled(true);
    setVideoEnabled(true);
    setCameraStates((prev) => ({ ...prev, local: true }));

    const conn = ensureConnection();
    registerHandlers(conn);

    if (conn.state === HubConnectionState.Disconnected) {
      await conn.start();
    }

    await conn.invoke("JoinRoom", roomCode);
  }, [roomCode, ensureConnection, registerHandlers]);

  const toggleAudio = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => (track.enabled = !audioEnabled));
    setAudioEnabled((prev) => !prev);
  }, [audioEnabled]);

  const toggleVideo = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const nextState = !videoEnabled;
    stream.getVideoTracks().forEach((track) => (track.enabled = nextState));
    setVideoEnabled(nextState);
    setCameraStates((prev) => ({ ...prev, local: nextState }));
    connectionRef.current?.invoke("UpdateCameraState", nextState).catch(() => {});
  }, [videoEnabled]);

  const sendChatMessage = useCallback(async (text: string) => {
    const trimmed = (text || "").trim();
    if (!trimmed) return;
    try {
      const conn = ensureConnection();
      if (conn.state === HubConnectionState.Disconnected) {
        await conn.start();
      }
      await conn.invoke("SendChatMessage", trimmed);
    } catch (err) {
      console.error("send chat error", err);
    }
  }, [ensureConnection]);

  const stopScreenShare = useCallback(async (silent: boolean = false) => {
    const current = screenStreamRef.current;
    if (current) {
      current.getTracks().forEach((track) => track.stop());
    }
    screenStreamRef.current = null;
    screenSendersRef.current.forEach((senders, connId) => {
      const pc = peersRef.current.get(connId);
      senders?.forEach((sender) => pc?.removeTrack(sender));
    });
    screenSendersRef.current.clear();
    pendingScreenRef.current.delete("local");
    setScreenStreams((prev) => {
      if (!prev.local) return prev;
      const clone = { ...prev };
      delete clone.local;
      return clone;
    });
    setScreenLabels((prev) => {
      if (!prev.local) return prev;
      const clone = { ...prev };
      delete clone.local;
      return clone;
    });
    setIsScreenSharing(false);
    await renegotiateAll();
    if (!silent) {
      await connectionRef.current?.invoke("UpdateScreenShare", false, "");
    }
  }, [renegotiateAll]);

  const shareScreen = useCallback(
    async (label?: string) => {
      if (isScreenSharing) return;
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        screenStreamRef.current = stream;
        stream.getVideoTracks().forEach((track) => {
          track.onended = () => stopScreenShare();
        });
        const sendersMap = new Map<string, RTCRtpSender[]>();
        peersRef.current.forEach((pc, id) => {
          const senders = stream.getTracks().map((track) => pc.addTrack(track, stream));
          sendersMap.set(id, senders);
        });
        screenSendersRef.current = sendersMap;
        setIsScreenSharing(true);
        setScreenStreams((prev) => ({ ...prev, local: stream }));
        setScreenLabels((prev) => ({ ...prev, local: label || "Chia sẻ màn hình" }));
        await renegotiateAll();
        await connectionRef.current?.invoke("UpdateScreenShare", true, label ?? "Chia sẻ màn hình");
      } catch {
        // ignore
      }
    },
    [isScreenSharing, stopScreenShare, renegotiateAll]
  );

  return {
    peers,
    localStream,
    joinRoom,
    leaveRoom,
    toggleAudio,
    toggleVideo,
    audioEnabled,
    videoEnabled,
    participantNames,
    connectionUsers,
    screenStreams,
    screenLabels,
    shareScreen,
    stopScreenShare,
    isScreenSharing,
    chatMessages,
    sendChatMessage,
    cameraStates,
  };
}
