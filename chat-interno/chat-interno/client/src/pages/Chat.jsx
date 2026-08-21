import React, { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import { getSocket } from "../socket";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import NewGroupModal from "../components/NewGroupModal";

export default function Chat() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messagesByConv, setMessagesByConv] = useState({});
  const [showNewGroup, setShowNewGroup] = useState(false);

  const loadConversations = useCallback(async () => {
    const { data } = await api.get("/conversations");
    setConversations(data.conversations);
    setActiveConvId((prev) => prev || data.conversations[0]?.id || null);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

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
    };

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

    socket.on("message:new", onNewMessage);
    socket.on("message:pinned", onPinned);
    socket.on("group:created", onGroupCreated);
    socket.on("group:removed", onGroupRemoved);

    return () => {
      socket.off("message:new", onNewMessage);
      socket.off("message:pinned", onPinned);
      socket.off("group:created", onGroupCreated);
      socket.off("group:removed", onGroupRemoved);
    };
  }, [loadConversations]);

  const setMessagesForConv = (convId, msgs) => {
    setMessagesByConv((prev) => ({ ...prev, [convId]: msgs }));
  };

  const togglePin = async (message, pinned) => {
    await api.patch(`/conversations/${message.conversation_id}/messages/${message.id}/pin`, { pinned });
  };

  const activeConv = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="w-screen h-screen flex" style={{ background: "#0F1B2D" }}>
      <Sidebar
        conversations={conversations}
        activeConvId={activeConvId}
        setActiveConvId={setActiveConvId}
        onNewGroup={() => setShowNewGroup(true)}
      />
      {activeConv ? (
        <ChatWindow
          key={activeConv.id}
          conversation={activeConv}
          messages={messagesByConv[activeConv.id]}
          setMessagesForConv={setMessagesForConv}
          onTogglePin={togglePin}
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
    </div>
  );
}
