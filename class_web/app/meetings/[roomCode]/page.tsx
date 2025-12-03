"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import api from "@/api/client";
import MeetingGrid from "@/components/meeting/MeetingGrid";
import MeetingControls from "@/components/meeting/MeetingControls";
import useMeetingRoom from "@/hooks/useMeetingRoom";
import { resolveAvatar } from "@/utils/resolveAvatar";

export default function MeetingRoomPage() {
  const params = useParams();
  const roomCode = params?.roomCode as string;
  const router = useRouter();
  const [meeting, setMeeting] = useState<any | null>(null);
  const [joining, setJoining] = useState(true);
  const [localDisplayName, setLocalDisplayName] = useState("Bạn");
  const [memberDirectory, setMemberDirectory] = useState<Record<string, { name: string; avatar?: string }>>({});
  const meetingIdRef = useRef<string | null>(null);
  const meetingInfoRef = useRef<any | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [localAvatar, setLocalAvatar] = useState<string | undefined>();
  const [localUserId, setLocalUserId] = useState<string | null>(null);

  const handleMeetingEnded = useCallback(() => {
    toast.error("Cuộc họp đã kết thúc");
    const info = meetingInfoRef.current;
    const meetingId = info?.id ?? info?.Id ?? meetingIdRef.current;
    if (meetingId) {
      api.post(`/meetings/${meetingId}/leave`).catch(() => {});
    }
    meetingIdRef.current = null;
    meetingInfoRef.current = null;
    const classroomId = info?.classroom?.id ?? info?.classroom?.Id;
    router.replace(classroomId ? `/classrooms/${classroomId}` : "/classrooms");
  }, [router]);

  const resolveMemberName = useCallback((userId: string) => memberDirectory[userId]?.name, [memberDirectory]);
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  const {
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
  } = useMeetingRoom(roomCode, {
    onMeetingEnded: handleMeetingEnded,
    resolveName: resolveMemberName,
  });

  useEffect(() => {
    if (!roomCode) return;
    let cancelled = false;

    const enter = async () => {
      setJoining(true);
      try {
        const { data } = await api.post("/meetings/join", { roomCode });
        if (cancelled) return;
        const normalized = {
          ...data,
          id: data.id ?? data.Id,
          roomCode: data.roomCode ?? data.RoomCode,
          title: data.title ?? data.Title,
          classroom: data.classroom ?? data.Classroom,
          startedAt: data.startedAt ?? data.StartedAt,
          members: data?.classroom?.Members ?? [],
        };
        meetingIdRef.current = normalized.id;
        setMeeting(normalized);
        meetingInfoRef.current = normalized;
        const memberMap: Record<string, { name: string; avatar?: string }> = {};
        (normalized.classroom?.members || normalized.classroom?.Members || []).forEach((m: any) => {
          const id = (m.userId ?? m.UserId ?? "").toString();
          if (!id) return;
          const fullName = m.fullName ?? m.FullName ?? "";
          const rawAvatar = m.avatar ?? m.Avatar ?? m.user?.avatar ?? m.User?.Avatar;
          memberMap[id] = {
            name: fullName,
            avatar: rawAvatar ? resolveAvatar(rawAvatar) || rawAvatar : undefined,
          };
        });
        setMemberDirectory(memberMap);
        if (localUserId) {
          const entry = memberMap[localUserId];
          if (entry?.avatar) {
            setLocalAvatar(entry.avatar);
          }
        }
        await joinRoom();
      } catch (err: any) {
        if (cancelled) return;
        const message = err?.response?.data || "Không thể tham gia phòng";
        toast.error(typeof message === "string" ? message : "Không thể tham gia phòng");
        router.replace("/classrooms");
      } finally {
        if (!cancelled) setJoining(false);
      }
    };

    enter();

    return () => {
      cancelled = true;
      stopScreenShare(true);
      leaveRoom();
      const id = meetingIdRef.current;
      if (id) {
        api.post(`/meetings/${id}/leave`).catch(() => {});
      }
      meetingInfoRef.current = null;
    };
  }, [roomCode, joinRoom, leaveRoom, router]);

  const handleLeave = async () => {
    const meetingId = meetingIdRef.current;
    if (meetingId) {
      await api.post(`/meetings/${meetingId}/leave`).catch(() => {});
    }
    await stopScreenShare();
    await leaveRoom();
    meetingIdRef.current = null;
    meetingInfoRef.current = null;
    const classroomId = meeting?.classroom?.id ?? meeting?.classroom?.Id;
    if (classroomId) {
      router.push(`/classrooms/${classroomId}`);
    } else {
      router.push("/classrooms");
    }
  };

  const remoteEntries = Object.entries(peers);
  const participants = useMemo<{ id: string; name: string; state: string; avatar?: string }[]>(() => {
    const list: { id: string; name: string; state: string; avatar?: string }[] = [
      {
        id: "local",
        name: localDisplayName,
        state: audioEnabled ? "Micro đang bật" : "Micro đang tắt",
        avatar: localAvatar,
      },
    ];
    remoteEntries.forEach(([connectionId, stream], idx) => {
      const userKey = connectionUsers[connectionId];
      const fallbackInfo = userKey ? memberDirectory[userKey] : undefined;
      const cameraOn = cameraStates?.[connectionId] !== false;
      list.push({
        id: connectionId,
        name: participantNames[connectionId] || fallbackInfo?.name || `Người tham gia ${idx + 1}`,
        avatar: fallbackInfo?.avatar,
        state: cameraOn ? "Đang chia sẻ video" : "Camera đang tắt",
      });
    });
    return list;
  }, [remoteEntries, audioEnabled, participantNames, connectionUsers, memberDirectory, localDisplayName, localAvatar, cameraStates]);

  const namesMap = useMemo(() => {
    return participants.reduce((acc, p) => {
      if (p.id === "local") return acc;
      acc[p.id] = p.name;
      return acc;
    }, {} as Record<string, string>);
  }, [participants]);

  const avatarMap = useMemo(() => {
    return participants.reduce((acc, p) => {
      acc[p.id] = p.avatar;
      return acc;
    }, {} as Record<string, string | undefined>);
  }, [participants]);

  const startedDisplay = useMemo(() => {
    const started = meeting?.startedAt ?? meeting?.StartedAt;
    return started ? new Date(started).toLocaleString() : "—";
  }, [meeting]);

  const handleToggleScreenShare = useCallback(() => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      shareScreen(`${localDisplayName} - màn hình`);
    }
  }, [isScreenSharing, stopScreenShare, shareScreen, localDisplayName]);

  const handleSendChat = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    await sendChatMessage(chatInput);
    setChatInput("");
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      if (stored?.fullName) {
        setLocalDisplayName(stored.fullName);
      }
      if (stored?.avatar) {
        const resolved = resolveAvatar(stored.avatar) || stored.avatar;
        setLocalAvatar(resolved);
      }
      if (stored?.id) {
        setLocalUserId(String(stored.id));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!localUserId) return;
    const entry = memberDirectory[localUserId];
    if (entry?.avatar) {
      setLocalAvatar(entry.avatar);
    }
  }, [localUserId, memberDirectory]);

  useEffect(() => {
    let cancelled = false;
    const fetchProfile = async () => {
      try {
        const { data } = await api.get("/auth/me");
        if (cancelled) return;
        if (data?.fullName) setLocalDisplayName(data.fullName);
        if (data?.id) setLocalUserId(String(data.id));
        if (data?.avatar) {
          const resolved = resolveAvatar(data.avatar) || data.avatar;
          setLocalAvatar(resolved);
          try {
            const stored = JSON.parse(localStorage.getItem("user") || "{}");
            localStorage.setItem(
              "user",
              JSON.stringify({ ...stored, ...data, avatar: resolved })
            );
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
    };
    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  if (joining) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-zinc-950 text-white gap-2">
        <div className="animate-pulse text-lg">Đang kết nối tới phòng...</div>
        <div className="text-white/60 text-sm">{roomCode}</div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-950 text-white">
        Không tìm thấy thông tin phòng.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black text-white">
      <div className="flex min-h-screen flex-col">
        <header className="border-b border-white/10 px-4 py-3">
          <div className="max-w-6xl mx-auto flex flex-col gap-1">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <h1 className="text-lg sm:text-xl font-semibold">
                {meeting.title || `Phòng ${meeting.roomCode}`}
              </h1>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-hidden p-4">
          <div className="flex h-full flex-col gap-4 lg:flex-row">
            <div className="flex-1 overflow-y-auto pr-1">
              <MeetingGrid
                localStream={localStream}
                peers={peers}
                namesMap={namesMap}
                localLabel={localDisplayName}
                localAvatar={localAvatar}
                avatarMap={avatarMap}
                localVideoEnabled={videoEnabled}
                cameraStates={cameraStates}
                screenStreams={screenStreams}
                screenLabels={screenLabels}
                pinnedId={pinnedId}
                onPin={(id) => setPinnedId(id)}
              />
            </div>
            <aside className="w-full lg:w-80 space-y-4">
              <div className="flex rounded-2xl border border-white/10 bg-white/5 p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setShowChat(false)}
                  className={`flex-1 rounded-xl px-3 py-1.5 ${!showChat ? "bg-black/40 text-white font-semibold" : "text-white/70"}`}
                >
                  Thông tin
                </button>
                <button
                  type="button"
                  onClick={() => setShowChat(true)}
                  className={`flex-1 rounded-xl px-3 py-1.5 flex items-center justify-center gap-2 ${
                    showChat ? "bg-black/40 text-white font-semibold" : "text-white/70"
                  }`}
                >
                  Chat
                  {chatMessages.length > 0 && (
                    <span className="rounded-full bg-white/10 px-2 text-xs">{chatMessages.length}</span>
                  )}
                </button>
              </div>
              {showChat ? (
                <section className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col h-[460px]">
                  <h3 className="text-base font-semibold mb-2">Trò chuyện</h3>
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {chatMessages.length === 0 && (
                      <p className="text-sm text-white/60 text-center mt-8">Chưa có tin nhắn nào</p>
                    )}
                    {chatMessages.map((msg) => {
                      const isMe = msg.userName === localDisplayName;
                      return (
                        <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[220px] rounded-2xl px-3 py-2 text-sm ${
                              isMe ? "bg-indigo-600 text-white" : "bg-black/30 text-white"
                            }`}
                          >
                            <p className="text-xs font-semibold text-white/70">{msg.userName}</p>
                            <p>{msg.message}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <form onSubmit={handleSendChat} className="pt-3 flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Nhập tin nhắn..."
                      className="flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="submit"
                      className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 text-sm font-semibold"
                    >
                      Gửi
                    </button>
                  </form>
                </section>
              ) : (
                <>
                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                    <div className="flex justify-between text-sm text-white/70">
                      <span>Trạng thái</span>
                      <span className="font-semibold text-emerald-400">Đang diễn ra</span>
                    </div>
                    <div className="flex justify-between text-sm text-white/70">
                      <span>Bắt đầu</span>
                      <span className="font-medium text-white">{startedDisplay}</span>
                    </div>
                    <div className="flex justify-between text-sm text-white/70">
                      <span>Tổng người tham gia</span>
                      <span className="font-medium text-white">{participants.length}</span>
                    </div>
                  </section>
                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-base font-semibold">Người tham gia</p>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{participants.length}</span>
                    </div>
                    <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                      {participants.map((p, idx) => (
                        <div key={p.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                          <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center text-sm font-semibold">
                            {p.name
                              .split(" ")
                              .map((t: string) => t[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{p.name}</p>
                            <p className="text-xs text-white/60">{p.state}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </aside>
          </div>
        </div>
        <MeetingControls
          audioEnabled={audioEnabled}
          videoEnabled={videoEnabled}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onToggleScreenShare={handleToggleScreenShare}
          isScreenSharing={isScreenSharing}
          onLeave={handleLeave}
        />
      </div>
    </div>
  );
}
