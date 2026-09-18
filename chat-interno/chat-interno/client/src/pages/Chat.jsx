import './Chat.css';
import React, { useEffect, useState } from 'react';
import { Heart, MessageCircle, Send, Search, Settings, Phone, Video, MoreVertical, Plus, X, EmojiHappy } from 'lucide-react';
import { api } from './api';
import EmojiPicker from 'emoji-picker-react';

export default function Chat({ socket, usuario }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [unreadCounts, setUnreadCounts] = useState({});

  useEffect(() => {
    loadConversations();
    
    if (socket.current) {
      socket.current.on('user:online', (data) => {
        setOnlineUsers(prev => new Set([...prev, data.userId]));
      });

      socket.current.on('user:offline', (data) => {
        setOnlineUsers(prev => {
          const updated = new Set(prev);
          updated.delete(data.userId);
          return updated;
        });
      });

      socket.current.on('message:new', (msg) => {
        setMessages(prev => [...prev, msg]);
        setUnreadCounts(prev => ({
          ...prev,
          [msg.conversationId]: (prev[msg.conversationId] || 0) + 1
        }));
      });
    }

    return () => {
      if (socket.current) {
        socket.current.off('user:online');
        socket.current.off('user:offline');
        socket.current.off('message:new');
      }
    };
  }, [socket]);

  const loadConversations = async () => {
    try {
      const res = await api.get('/chat/conversations');
      setConversations(res.data);
      if (res.data.length > 0) {
        selectConversation(res.data[0]);
      }
    } catch (e) {
      console.error('Erro ao carregar conversas:', e);
    }
  };

  const selectConversation = async (conv) => {
    setSelectedConversation(conv);
    try {
      const res = await api.get(`/chat/conversations/${conv.id}/messages`);
      setMessages(res.data);
      setUnreadCounts(prev => ({ ...prev, [conv.id]: 0 }));
    } catch (e) {
      console.error('Erro ao carregar mensagens:', e);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const msg = await api.post(`/chat/conversations/${selectedConversation.id}/messages`, {
        content: newMessage,
        userId: usuario.id
      });
      setMessages(prev => [...prev, msg.data]);
      setNewMessage('');
      socket.current?.emit('message:sent', msg.data);
    } catch (e) {
      console.error('Erro ao enviar mensagem:', e);
    }
  };

  const filteredConversations = conversations.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isConvOnline = selectedConversation && onlineUsers.has(selectedConversation.userId);

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f5f5f5', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* SIDEBAR - AZUL CLARO */}
      <div style={{ width: '280px', background: '#2d5a8c', color: '#b3d1e8', borderRight: '1px solid #1e3a5f', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid #1e3a5f' }}>
          <h2 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: '600', color: '#ffffff' }}>Chat Nacional</h2>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '8px', top: '8px', color: '#8b94a5' }} />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: '32px',
                padding: '6px 8px 6px 32px',
                border: '1px solid #3d7ab8',
                borderRadius: '6px',
                background: '#3d7ab8',
                color: '#ffffff',
                fontSize: '13px'
              }}
            />
          </div>
        </div>

        {/* Conversas */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredConversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => selectConversation(conv)}
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid #1e3a5f',
                cursor: 'pointer',
                background: selectedConversation?.id === conv.id ? '#3d7ab8' : 'transparent',
                color: selectedConversation?.id === conv.id ? '#ffffff' : '#b3d1e8',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#3d7ab8'}
              onMouseLeave={(e) => e.currentTarget.style.background = selectedConversation?.id === conv.id ? '#3d7ab8' : 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: onlineUsers.has(conv.userId) ? '#10b981' : '#6b7280'
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: '500' }}>{conv.name}</div>
                  <div style={{ fontSize: '12px', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {conv.lastMessage || 'Sem mensagens'}
                  </div>
                </div>
                {unreadCounts[conv.id] > 0 && (
                  <div style={{
                    background: '#fca5a5',
                    color: '#7f1d1d',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: '600'
                  }}>
                    {unreadCounts[conv.id]}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MAIN CHAT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#ffffff' }}>
        {selectedConversation ? (
          <>
            {/* Header com alertas */}
            <div style={{ background: '#fee2e2', borderBottom: '1px solid #fca5a5', padding: '12px 20px' }}>
              <div style={{ display: 'flex', gap: '12px', fontSize: '12px', flexWrap: 'wrap' }}>
                <span style={{ background: '#fca5a5', color: '#7f1d1d', padding: '4px 8px', borderRadius: '4px', fontWeight: '600' }}>📅 Reunião agora</span>
                <span style={{ background: '#fca5a5', color: '#7f1d1d', padding: '4px 8px', borderRadius: '4px', fontWeight: '600' }}>⚠️ 1 alinhamento</span>
                <span style={{ background: '#fca5a5', color: '#7f1d1d', padding: '4px 8px', borderRadius: '4px', fontWeight: '600' }}>🔴 12 rotinas atrasadas</span>
              </div>
            </div>

            {/* Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <div>
                <h3 style={{ margin: '0', fontSize: '16px', fontWeight: '600', color: '#101828' }}>{selectedConversation.name}</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: isConvOnline ? '#10b981' : '#6b7280' }}>
                  {isConvOnline ? '🟢 Online' : '⚫ Offline'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Phone size={20} style={{ cursor: 'pointer', color: '#667085' }} />
                <Video size={20} style={{ cursor: 'pointer', color: '#667085' }} />
                <MoreVertical size={20} style={{ cursor: 'pointer', color: '#667085' }} />
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {messages.map((msg) => (
                <div key={msg.id} style={{ display: 'flex', justifyContent: msg.userId === usuario.id ? 'flex-end' : 'flex-start', gap: '8px' }}>
                  {msg.userId !== usuario.id && (
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#2563eb',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: '600',
                      flexShrink: 0
                    }}>
                      {msg.userName?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{
                    maxWidth: '60%',
                    background: msg.userId === usuario.id ? '#c7e0f4' : '#e8f0fb',
                    color: '#1e4976',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    fontSize: '13px'
                  }}>
                    {msg.content}
                    <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.7 }}>
                      {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div style={{ borderTop: '1px solid #e5e7eb', padding: '16px 20px', background: '#ffffff' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <Plus size={20} style={{ cursor: 'pointer', color: '#667085', flexShrink: 0 }} />
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Escreva uma mensagem..."
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    border: '1px solid #c7e0f4',
                    borderRadius: '6px',
                    fontSize: '13px',
                    background: '#ffffff',
                    color: '#1e4976'
                  }}
                />
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '20px',
                    padding: 0
                  }}
                >
                  😊
                </button>
                <button
                  onClick={sendMessage}
                  style={{
                    padding: '10px 16px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#667085' }}>
            Selecione uma conversa
          </div>
        )}
      </div>
    </div>
  );
}
