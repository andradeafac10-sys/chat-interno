import React, { useEffect, useState, useCallback, useRef } from "react";
import { api } from "../api";
import { getSocket } from "../socket";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import NewGroupModal from "../components/NewGroupModal";
import AccountModal from "../components/AccountModal";
import UsersPage from "./Users";
import AnnouncementsPage from "./Announcements";
import AnnouncementOverlay from "../components/AnnouncementOverlay";
import { playNotificationSound } from "../sound";

const ORIGINAL_TITLE = "ChatInternoNNC";
const DISMISSED_KEY = "chatinterno_dismissed_announcement";

export default function Chat() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messagesByConv, setMessagesByConv] = useState({});
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [announcement, setAnnouncement] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(() => new Set());
  const [flashIds, setFlashIds] = useState(() => new Set());

  const blinkTimerRef = useRef(null);
  const activeConvIdRef = useRef(activeConvId);
  useEffect(() => { activeConvIdRef.current = activeConvId; }, [activeConvId]);

  const startBlink = useCallback(() => {
    if (blinkTimerRef.current) return; // já piscando
    let flipped = false;
    blinkTimerRef.current = setInterval(() => {
      document.title = flipped ? ORIGINAL_TITLE : "💬 Nova mensagem!";
      flipped = !flipped;
    }, 900);
  }, []);

  const stopBlink = useCallback(() => {
    if (blinkTimerRef.current) {
      clearInterval(blinkTimerRef.current);
      blinkTimerRef.current = null;
    }
    document.title = ORIGINAL_TITLE;
  }, []);

  useEffect(() => {
    window.addEventListener("focus", stopBlink);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") stopBlink();
    });
    return () => window.removeEventListener("focus", stopBlink);
  }, [stopBlink]);

  const loadConversations = useCallback(async () => {
    const { data } = await api.get("/conversations");
    setConversations(data.conversations);
    setActiveConvId((prev) => prev || data.conversations[0]?.id || null);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    api.get("/announcements/latest").then(({ data }) => {
      const a = data.announcement;
      if (!a) return;
      const dismissedId = localStorage.getItem(DISMISSED_KEY);
      if (String(a.id) !== dismissedId) setAnnouncement(a);
    });
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNewMessage = (message) => {
      setMessagesByConv((prev) => {
        if (!prev[message.conversation_id]) return prev; // conversa ainda não foi aberta/carregada
        return { ...prev, [message.conversation_id]: [...prev[message.conversation_id], message] };
      });
      setConversations((prev) =>
        prev.map((c) => (c.id === message.conversation_id ? { ...c, lastMessage: message } : c))
      );

      const isMine = message.sender_id === user.id;
      const isViewingIt = message.conversation_id === activeConvIdRef.current && document.visibilityState === "visible";
      if (!isMine && !isViewingIt) {
        startBlink();
        setFlashIds((prev) => new Set(prev).add(message.conversation_id));
        playNotificationSound();
      }
    };

    const onEdited = (message) => {
      setMessagesByConv((prev) => {
        if (!prev[message.conversation_id]) return prev;
        return {
          ...prev,
          [message.conversation_id]: prev[message.conversation_id].map((m) => (m.id === message.id ? { ...m, ...message } : m)),
        };
      });
    };

    const onDeleted = ({ id, conversation_id }) => {
      setMessagesByConv((prev) => {
        if (!prev[conversation_id]) return prev;
        return {
          ...prev,
          [conversation_id]: prev[conversation_id].map((m) =>
            m.id === id ? { ...m, deleted: true, content: null, file_url: null, file_name: null } : m
          ),
        };
      });
    };

    const onReaction = ({ messageId, conversationId, reactions }) => {
      setMessagesByConv((prev) => {
        if (!prev[conversationId]) return prev;
        return {
          ...prev,
          [conversationId]: prev[conversationId].map((m) => (m.id === messageId ? { ...m, reactions } : m)),
        };
      });
    };

    const onAnnouncementNew = (a) => setAnnouncement(a);

    const onPinned = (message) => {
      setMessagesByConv((prev) => {
        if (!prev[message.conversation_id]) return prev;
        return {
          ...prev,
          [message.conversation_id]: prev[message.conversation_id].map((m) =>
            m.id === message.id ? message : { ...m, pinned: message.pinned ? false : m.pinned }
          ),
        };
      });
    };

    const onGroupCreated = (payload) => {
      // entra na sala do grupo em tempo real (o servidor confere a permissão de novo)
      if (payload?.groupId) socket.emit("group:join", payload.groupId);
      loadConversations();
    };
    const onGroupRemoved = () => loadConversations();

    const onGroupUpdatedEvent = () => loadConversations();

    const onPresenceList = ({ userIds }) => setOnlineUsers(new Set(userIds));
    const onPresenceOnline = ({ userId }) => setOnlineUsers((prev) => new Set(prev).add(userId));
    const onPresenceOffline = ({ userId }) =>
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });

    socket.on("message:new", onNewMessage);
    socket.on("message:pinned", onPinned);
    socket.on("message:edited", onEdited);
    socket.on("message:deleted", onDeleted);
    socket.on("message:reaction", onReaction);
    socket.on("announcement:new", onAnnouncementNew);
    socket.on("group:created", onGroupCreated);
    socket.on("group:removed", onGroupRemoved);
    socket.on("group:updated", onGroupUpdatedEvent);
    socket.on("presence:list", onPresenceList);
    socket.on("presence:online", onPresenceOnline);
    socket.on("presence:offline", onPresenceOffline);

    return () => {
      socket.off("message:new", onNewMessage);
      socket.off("message:pinned", onPinned);
      socket.off("message:edited", onEdited);
      socket.off("message:deleted", onDeleted);
      socket.off("message:reaction", onReaction);
      socket.off("announcement:new", onAnnouncementNew);
      socket.off("group:created", onGroupCreated);
      socket.off("group:removed", onGroupRemoved);
      socket.off("group:updated", onGroupUpdatedEvent);
      socket.off("presence:list", onPresenceList);
      socket.off("presence:online", onPresenceOnline);
      socket.off("presence:offline", onPresenceOffline);
    };
  }, [loadConversations, user.id, startBlink]);

  const setMessagesForConv = (convId, msgs) => {
    setMessagesByConv((prev) => ({ ...prev, [convId]: msgs }));
  };

  const togglePin = async (message, pinned) => {
    await api.patch(`/conversations/${message.conversation_id}/messages/${message.id}/pin`, { pinned });
  };

  const setActiveConvIdAndStopBlink = (id) => {
    setActiveConvId(id);
    stopBlink();
    setFlashIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const activeConv = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="w-screen h-screen flex" style={{ background: "#111B21" }}>
      <Sidebar
        conversations={conversations}
        activeConvId={activeConvId}
        setActiveConvId={setActiveConvIdAndStopBlink}
        onNewGroup={() => setShowNewGroup(true)}
        onOpenAccount={() => setShowAccount(true)}
        onOpenUsers={() => setShowUsers(true)}
        onOpenAnnouncement={() => setShowAnnouncements(true)}
        onlineUsers={onlineUsers}
        flashIds={flashIds}
      />
      {showUsers ? (
        <UsersPage onBack={() => setShowUsers(false)} />
      ) : showAnnouncements ? (
        <AnnouncementsPage onBack={() => setShowAnnouncements(false)} />
      ) : activeConv ? (
        <ChatWindow
          key={activeConv.id}
          conversation={activeConv}
          messages={messagesByConv[activeConv.id]}
          setMessagesForConv={setMessagesForConv}
          onTogglePin={togglePin}
          onGroupUpdated={loadConversations}
          isOnline={activeConv.otherUserId ? onlineUsers.has(activeConv.otherUserId) : false}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
          {conversations.length === 0 ? "Nenhuma conversa disponível ainda." : "Selecione uma conversa"}
        </div>
      )}

      {showNewGroup && (
        <NewGroupModal
          onClose={() => setShowNewGroup(false)}
          onCreated={() => {
            setShowNewGroup(false);
            loadConversations();
          }}
        />
      )}
      {showAccount && <AccountModal onClose={() => setShowAccount(false)} />}
      <AnnouncementOverlay
        announcement={announcement}
        onClose={() => {
          if (announcement) localStorage.setItem(DISMISSED_KEY, String(announcement.id));
          setAnnouncement(null);
        }}
      />
    </div>
  );
}
