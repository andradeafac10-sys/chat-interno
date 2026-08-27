import React, { useEffect, useState, useCallback, useRef } from "react";
import { api } from "../api";
import { getSocket } from "../socket";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import NewGroupModal from "../components/NewGroupModal";
import AccountModal from "../components/AccountModal";
import AdminPanel from "./AdminPanel";
import UsersPage from "./Users";
import AnnouncementsPage from "./Announcements";
import MonitoringPage from "./Monitoring";
import AnnouncementOverlay from "../components/AnnouncementOverlay";
import HiddenGroupsModal from "../components/HiddenGroupsModal";
import OnlinePanel from "../components/OnlinePanel";
import UpdateBanner from "../components/UpdateBanner";
import { playNotificationSound } from "../sound";

const ORIGINAL_TITLE = "Chat Nacional";
const DISMISSED_KEY = "chatinterno_dismissed_announcement";

export default function Chat() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [pendingConversation, setPendingConversation] = useState(null); // conversa aberta pelo painel de online, ainda sem mensagem
  const [messagesByConv, setMessagesByConv] = useState({});
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showMonitoring, setShowMonitoring] = useState(false);
  const [showHiddenGroups, setShowHiddenGroups] = useState(false);
  const [hiddenGroupsCount, setHiddenGroupsCount] = useState(0);
  const [announcement, setAnnouncement] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(() => new Set());
  const [unreadCounts, setUnreadCounts] = useState(() => ({})); // { conversationId: quantidade }

  const activeConvIdRef = useRef(activeConvId);
  useEffect(() => { activeConvIdRef.current = activeConvId; }, [activeConvId]);

  // Título da aba mostra a quantidade de mensagens não lidas, igual o WhatsApp —
  // não pisca mais, só atualiza o número.
  useEffect(() => {
    const total = Object.values(unreadCounts).reduce((soma, n) => soma + n, 0);
    document.title = total > 0 ? `(${total}) ${ORIGINAL_TITLE}` : ORIGINAL_TITLE;
  }, [unreadCounts]);

  const loadConversations = useCallback(async () => {
    const { data } = await api.get("/conversations");
    setConversations(data.conversations);
    setActiveConvId((prev) => prev || data.conversations[0]?.id || null);
  }, []);

  const loadHiddenGroupsCount = useCallback(async () => {
    try {
      const { data } = await api.get("/conversations/hidden-groups");
      setHiddenGroupsCount(data.groups.length);
    } catch { /* silencioso: não é crítico se falhar */ }
  }, []);

  const hideGroup = useCallback(async (groupId, groupName) => {
    if (!window.confirm(`Esconder "${groupName}" da sua lista? Você pode trazer de volta quando quiser.`)) return;
    await api.post(`/conversations/groups/${groupId}/hide`);
    loadConversations();
    loadHiddenGroupsCount();
  }, [loadConversations, loadHiddenGroupsCount]);

  const togglePinConversation = useCallback(async (conversationId, pinned) => {
    await api[pinned ? "post" : "delete"](`/conversations/${conversationId}/pin`);
    loadConversations();
  }, [loadConversations]);

  const closeConversation = useCallback(async (conversationId, title) => {
    if (!window.confirm(`Fechar a conversa com "${title}"? O histórico continua salvo — ela volta a aparecer se algum dos dois mandar mensagem de novo.`)) return;
    await api.post(`/conversations/${conversationId}/close`);
    if (activeConvIdRef.current === conversationId) setActiveConvId(null);
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    loadConversations();
    loadHiddenGroupsCount();
  }, [loadConversations, loadHiddenGroupsCount]);

  // Além de escutar em tempo real (socket), confere sozinho de tempos em tempos
  // se saiu um comunicado novo — assim ninguém depende só da conexão em tempo real
  // continuar funcionando pra saber que tem um comunicado esperando.
  useEffect(() => {
    let cancelado = false;
    const checar = () => {
      api.get("/announcements/latest").then(({ data }) => {
        if (cancelado) return;
        const a = data.announcement;
        if (!a) return;
        const dismissedId = localStorage.getItem(DISMISSED_KEY);
        if (String(a.id) === dismissedId) return;
        setAnnouncement((prev) => (prev?.id === a.id ? prev : a));
      });
    };
    checar();
    const intervalo = setInterval(checar, 20000);
    return () => { cancelado = true; clearInterval(intervalo); };
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNewMessage = (message) => {
      setMessagesByConv((prev) => {
        if (!prev[message.conversation_id]) return prev; // conversa ainda não foi aberta/carregada
        return { ...prev, [message.conversation_id]: [...prev[message.conversation_id], message] };
      });
      setConversations((prev) => {
        const jaExiste = prev.some((c) => c.id === message.conversation_id);
        if (!jaExiste) {
          // Conversa nova pra mim (ex: acabou de reabrir sozinha por ter sido fechada) —
          // busca a lista completa de novo pra ela aparecer certinho, com nome/foto etc.
          loadConversations();
          return prev;
        }
        return prev.map((c) => (c.id === message.conversation_id ? { ...c, lastMessage: message } : c));
      });

      const isMine = message.sender_id === user.id;
      const isViewingIt = message.conversation_id === activeConvIdRef.current && document.visibilityState === "visible";
      if (!isMine && !isViewingIt) {
        setUnreadCounts((prev) => ({ ...prev, [message.conversation_id]: (prev[message.conversation_id] || 0) + 1 }));
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
    const onAnnouncementDeleted = ({ id }) => {
      setAnnouncement((prev) => (prev && prev.id === id ? null : prev));
    };
    const onMessagesCleared = () => {
      setMessagesByConv({});
      loadConversations();
    };
    const onAnnouncementsCleared = () => setAnnouncement(null);

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
    const onPresenceOnline = ({ userId }) => {
      setOnlineUsers((prev) => new Set(prev).add(userId));
    };
    const onPresenceOffline = ({ userId }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    };

    socket.on("message:new", onNewMessage);
    socket.on("message:pinned", onPinned);
    socket.on("message:edited", onEdited);
    socket.on("message:deleted", onDeleted);
    socket.on("message:reaction", onReaction);
    socket.on("announcement:new", onAnnouncementNew);
    socket.on("announcement:deleted", onAnnouncementDeleted);
    socket.on("maintenance:messages-cleared", onMessagesCleared);
    socket.on("maintenance:announcements-cleared", onAnnouncementsCleared);
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
      socket.off("announcement:deleted", onAnnouncementDeleted);
      socket.off("maintenance:messages-cleared", onMessagesCleared);
      socket.off("maintenance:announcements-cleared", onAnnouncementsCleared);
      socket.off("group:created", onGroupCreated);
      socket.off("group:removed", onGroupRemoved);
      socket.off("group:updated", onGroupUpdatedEvent);
      socket.off("presence:list", onPresenceList);
      socket.off("presence:online", onPresenceOnline);
      socket.off("presence:offline", onPresenceOffline);
    };
  }, [loadConversations, user.id]);

  const setMessagesForConv = (convId, msgs) => {
    setMessagesByConv((prev) => ({ ...prev, [convId]: msgs }));
  };

  const togglePin = async (message, pinned) => {
    try {
      await api.patch(`/conversations/${message.conversation_id}/messages/${message.id}/pin`, { pinned });
    } catch (err) {
      alert(err.response?.data?.error || "Não foi possível fixar essa mensagem.");
    }
  };

  const setActiveConvIdAndStopBlink = (id) => {
    setActiveConvId(id);
    setUnreadCounts((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // Abre (ou começa) uma conversa a partir do painel de "online", mesmo que
  // ainda não exista histórico de mensagem com essa pessoa.
  const openFromOnlinePanel = (conv) => {
    setPendingConversation(conv);
    setActiveConvIdAndStopBlink(conv.id);
  };

  const activeConv = conversations.find((c) => c.id === activeConvId) || (pendingConversation?.id === activeConvId ? pendingConversation : null);

  return (
    <div className="w-screen h-screen flex" style={{ background: "#111B21" }}>
      <Sidebar
        conversations={conversations}
        activeConvId={activeConvId}
        setActiveConvId={setActiveConvIdAndStopBlink}
        onNewGroup={() => setShowNewGroup(true)}
        onOpenAccount={() => (user.role === "admin" ? setShowAdminPanel(true) : setShowAccount(true))}
        onOpenUsers={() => setShowUsers(true)}
        onOpenAnnouncement={() => setShowAnnouncements(true)}
        onOpenMonitoring={() => setShowMonitoring(true)}
        onlineUsers={onlineUsers}
        unreadCounts={unreadCounts}
        onHideGroup={hideGroup}
        onTogglePinConversation={togglePinConversation}
        onCloseConversation={closeConversation}
        hiddenGroupsCount={hiddenGroupsCount}
        onOpenHiddenGroups={() => setShowHiddenGroups(true)}
      />
      {showUsers ? (
        <UsersPage onBack={() => setShowUsers(false)} />
      ) : showAnnouncements ? (
        <AnnouncementsPage onBack={() => setShowAnnouncements(false)} />
      ) : showMonitoring ? (
        <MonitoringPage onBack={() => setShowMonitoring(false)} />
      ) : showAdminPanel ? (
        <AdminPanel onBack={() => setShowAdminPanel(false)} />
      ) : (
        <>
          {activeConv ? (
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
              {conversations.length === 0 ? "Nenhuma conversa em andamento ainda. Escolha alguém online ao lado pra começar." : "Selecione uma conversa"}
            </div>
          )}
          <OnlinePanel onlineUsers={onlineUsers} onOpenConversation={openFromOnlinePanel} />
        </>
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
      {showAccount && (
        <AccountModal
          onClose={() => setShowAccount(false)}
          onOpenUsers={() => setShowUsers(true)}
          onOpenMonitoring={() => setShowMonitoring(true)}
        />
      )}

      {showHiddenGroups && (
        <HiddenGroupsModal
          onClose={() => setShowHiddenGroups(false)}
          onChanged={() => { loadConversations(); loadHiddenGroupsCount(); }}
        />
      )}

      <AnnouncementOverlay
        announcement={announcement}
        onClose={() => {
          if (announcement) localStorage.setItem(DISMISSED_KEY, String(announcement.id));
          setAnnouncement(null);
        }}
      />

      <UpdateBanner />
    </div>
  );
}
