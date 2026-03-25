import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/context/auth-context';

const API_URL = 'https://village-backend-802022146719.us-central1.run.app';
const WS_URL = `${API_URL.replace(/^http/, 'ws')}/ws`;

type ChatUser = {
  userid: number;
  first_name: string;
  last_name: string;
  email: string;
};

type Conversation = {
  conversationid: number;
  other_userid: number;
  first_name: string;
  last_name: string;
  email: string;
  last_senderid?: number;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
};

type ChatMessage = {
  messageid: number;
  conversationid: number;
  senderid: number;
  content: string;
  sent_at: string;
  read_at: string | null;
  first_name: string;
  last_name: string;
};

type IncomingSocketEvent =
  | { type: 'identified'; userId: number }
  | { type: 'conversation_started'; conversationId: number; userIds: number[] }
  | { type: 'new_message'; conversationId: number; message: ChatMessage }
  | { type: 'conversation_read'; conversationId: number; readerId: number; readAt: string }
  | { type: 'message_updated'; conversationId: number; message: ChatMessage }
  | { type: 'message_deleted'; conversationId: number; messageId: number }
  | { type: 'conversation_deleted'; conversationId: number; deletedBy: number };

function mergeMessage(existing: ChatMessage[], next: ChatMessage): ChatMessage[] {
  if (existing.some((msg) => msg.messageid === next.messageid)) {
    return existing;
  }
  return [...existing, next];
}

function formatName(first: string, last: string) {
  return `${first ?? ''} ${last ?? ''}`.trim();
}

function formatReceiptTime(value: string) {
  return new Date(value).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function includesQuery(source: string | null | undefined, query: string) {
  return String(source ?? '').toLowerCase().includes(query.toLowerCase());
}

export default function ChatScreen() {
  const { currentUser } = useAuth();
  const userId = currentUser?.userid ?? null;

  const [users, setUsers] = useState<ChatUser[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [isSelectingChats, setIsSelectingChats] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<number[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);

  const selectedConversationRef = useRef<number | null>(null);

  useEffect(() => {
    selectedConversationRef.current = selectedConversationId;
  }, [selectedConversationId]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.conversationid === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );

  const filteredConversations = useMemo(() => {
    const query = chatSearch.trim();
    if (!query) return conversations;

    return conversations.filter((conversation) => {
      const name = `${conversation.first_name} ${conversation.last_name}`;
      return (
        includesQuery(name, query) ||
        includesQuery(conversation.email ?? '', query) ||
        includesQuery(conversation.last_message ?? '', query)
      );
    });
  }, [conversations, chatSearch]);

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim();
    if (!query) return users;

    return users.filter((user) => {
      const name = `${user.first_name} ${user.last_name}`;
      return includesQuery(name, query) || includesQuery(user.email, query);
    });
  }, [users, userSearch]);

  const loadUsers = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_URL}/chat/users?excludeUserId=${userId}`);
      if (!res.ok) {
        Alert.alert('Error', 'Could not load users for chat.');
        return;
      }
      const data = (await res.json()) as ChatUser[];
      setUsers(data);
    } catch (err) {
      console.error('Failed to load chat users:', err);
      Alert.alert('Error', 'Could not load users for chat.');
    }
  }, [userId]);

  const loadConversations = useCallback(async () => {
    if (!userId) return;
    try {
      setLoadingConversations(true);
      const res = await fetch(`${API_URL}/chat/conversations/user/${userId}`);
      if (!res.ok) {
        Alert.alert('Error', 'Could not load conversations.');
        return;
      }
      const data = (await res.json()) as Conversation[];
      setConversations(data);

      if (data.length === 0 && !selectedConversationRef.current) {
        setSelectedConversationId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      Alert.alert('Error', 'Could not load conversations.');
    } finally {
      setLoadingConversations(false);
    }
  }, [userId]);

  const markConversationRead = useCallback(
    async (conversationId: number) => {
      if (!userId) return;
      try {
        await fetch(`${API_URL}/chat/conversations/${conversationId}/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
      } catch (err) {
        console.error('Failed to mark read:', err);
      }
    },
    [userId]
  );

  const loadMessages = useCallback(
    async (conversationId: number) => {
      try {
        setLoadingMessages(true);
        const res = await fetch(`${API_URL}/chat/conversations/${conversationId}/messages`);
        if (!res.ok) {
          Alert.alert('Error', 'Could not load messages.');
          return;
        }
        const data = (await res.json()) as ChatMessage[];
        setMessages(data);
        setSelectedConversationId(conversationId);
        setEditingMessageId(null);
        setDraft('');
        await markConversationRead(conversationId);
        void loadConversations();
      } catch (err) {
        console.error('Failed to load messages:', err);
        Alert.alert('Error', 'Could not load messages.');
      } finally {
        setLoadingMessages(false);
      }
    },
    [loadConversations, markConversationRead]
  );

  useEffect(() => {
    if (!userId) return;
    void loadUsers();
    void loadConversations();
  }, [userId, loadUsers, loadConversations]);

  useEffect(() => {
    if (!userId) return;

    const socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'identify', userId }));
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data as string) as IncomingSocketEvent;

        if (payload.type === 'new_message') {
          if (payload.conversationId === selectedConversationRef.current) {
            setMessages((prev) => mergeMessage(prev, payload.message));
            if (payload.message.senderid !== userId) {
              void markConversationRead(payload.conversationId);
            }
          }
          void loadConversations();
          return;
        }

        if (payload.type === 'message_updated') {
          if (payload.conversationId === selectedConversationRef.current) {
            setMessages((prev) =>
              prev.map((msg) => (msg.messageid === payload.message.messageid ? payload.message : msg))
            );
          }
          void loadConversations();
          return;
        }

        if (payload.type === 'message_deleted') {
          if (payload.conversationId === selectedConversationRef.current) {
            setMessages((prev) => prev.filter((msg) => msg.messageid !== payload.messageId));
          }
          void loadConversations();
          return;
        }

        if (payload.type === 'conversation_deleted') {
          if (payload.conversationId === selectedConversationRef.current) {
            setSelectedConversationId(null);
            setMessages([]);
          }
          void loadConversations();
          return;
        }

        if (payload.type === 'conversation_started') {
          void loadConversations();
          return;
        }

        if (payload.type === 'conversation_read' && payload.readerId !== userId) {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.senderid !== userId || msg.read_at) {
                return msg;
              }

              if (new Date(msg.sent_at).getTime() <= new Date(payload.readAt).getTime()) {
                return { ...msg, read_at: payload.readAt };
              }

              return msg;
            })
          );
          void loadConversations();
        }
      } catch (err) {
        console.error('Invalid socket payload:', err);
      }
    };

    socket.onerror = (err) => {
      console.error('Chat socket error:', err);
    };

    return () => {
      socket.close();
    };
  }, [userId, loadConversations, markConversationRead]);

  const handleStartConversation = async (otherUserId: number) => {
    if (!userId) return;

    try {
      const res = await fetch(`${API_URL}/chat/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, otherUserId }),
      });

      if (!res.ok) {
        Alert.alert('Error', 'Could not start conversation.');
        return;
      }

      const data = (await res.json()) as { conversationId: number };
      setShowUsersModal(false);
      setUserSearch('');
      await loadConversations();
      await loadMessages(data.conversationId);
    } catch (err) {
      console.error('Failed to start conversation:', err);
      Alert.alert('Error', 'Could not start conversation.');
    }
  };

  const handleBulkDeleteConversations = async () => {
    if (!userId || selectedChatIds.length === 0) return;

    Alert.alert(
      'Delete chats',
      `Delete ${selectedChatIds.length} selected chat${selectedChatIds.length > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all(
                selectedChatIds.map((conversationId) =>
                  fetch(`${API_URL}/chat/conversations/${conversationId}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId }),
                  })
                )
              );

              setSelectedChatIds([]);
              setIsSelectingChats(false);
              await loadConversations();
            } catch (err) {
              console.error('Failed to bulk delete conversations:', err);
              Alert.alert('Error', 'Could not delete selected chats.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (!userId) return;

    try {
      const res = await fetch(`${API_URL}/chat/messages/${messageId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) {
        Alert.alert('Error', 'Could not delete message.');
        return;
      }

      setMessages((prev) => prev.filter((msg) => msg.messageid !== messageId));
      if (editingMessageId === messageId) {
        setEditingMessageId(null);
        setDraft('');
      }
      void loadConversations();
    } catch (err) {
      console.error('Failed to delete message:', err);
      Alert.alert('Error', 'Could not delete message.');
    }
  };

  const handleSend = async () => {
    if (!userId || !selectedConversationId) return;

    const content = draft.trim();
    if (!content) return;

    try {
      setSending(true);

      if (editingMessageId) {
        const res = await fetch(`${API_URL}/chat/messages/${editingMessageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, content }),
        });

        if (!res.ok) {
          Alert.alert('Error', 'Could not edit message.');
          return;
        }

        const updated = (await res.json()) as ChatMessage;
        setMessages((prev) => prev.map((msg) => (msg.messageid === updated.messageid ? updated : msg)));
        setEditingMessageId(null);
        setDraft('');
        void loadConversations();
        return;
      }

      const res = await fetch(`${API_URL}/chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversationId,
          senderId: userId,
          content,
        }),
      });

      if (!res.ok) {
        Alert.alert('Error', 'Could not send message.');
        return;
      }

      const sent = (await res.json()) as ChatMessage;
      setMessages((prev) => mergeMessage(prev, sent));
      setDraft('');
      void loadConversations();
    } catch (err) {
      console.error('Failed to send message:', err);
      Alert.alert('Error', 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  if (!userId) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.emptyTitle}>Sign in required</Text>
        <Text style={styles.emptySubtitle}>Log in to start messaging other users.</Text>
      </View>
    );
  }

  const renderList = () => (
    <>
      <TextInput
        value={chatSearch}
        onChangeText={setChatSearch}
        placeholder="Search chats"
        style={styles.searchInput}
      />
      {loadingConversations ? (
        <ActivityIndicator color="#111827" style={styles.loadingConversations} />
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.conversationid.toString()}
          contentContainerStyle={styles.chatList}
          renderItem={({ item }) => (
            <View style={styles.chatRow}>
              {isSelectingChats ? (
                <Pressable
                  style={styles.selectCircleWrap}
                  onPress={() => {
                    setSelectedChatIds((prev) =>
                      prev.includes(item.conversationid)
                        ? prev.filter((id) => id !== item.conversationid)
                        : [...prev, item.conversationid]
                    );
                  }}
                >
                  <View
                    style={[
                      styles.selectCircle,
                      selectedChatIds.includes(item.conversationid) && styles.selectCircleSelected,
                    ]}
                  />
                </Pressable>
              ) : null}
              <Pressable
                style={styles.chatOpenArea}
                onPress={() => {
                  if (isSelectingChats) {
                    setSelectedChatIds((prev) =>
                      prev.includes(item.conversationid)
                        ? prev.filter((id) => id !== item.conversationid)
                        : [...prev, item.conversationid]
                    );
                  } else {
                    void loadMessages(item.conversationid);
                  }
                }}
              >
                <View style={styles.chatTextWrap}>
                  <Text style={styles.chatName}>
                    {formatName(item.first_name, item.last_name) || item.email}
                  </Text>
                  <Text style={styles.chatPreview} numberOfLines={1}>
                    {item.last_message || 'No messages yet'}
                  </Text>
                </View>
                {item.unread_count > 0 && <View style={styles.unreadDot} />}
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyListCard}>
              <Text style={styles.emptyListText}>No matching chats.</Text>
            </View>
          }
        />
      )}
    </>
  );

  const renderThread = () => (
    <View style={styles.threadContainer}>
      <View style={styles.threadHeader}>
        <Pressable
          onPress={() => {
            setSelectedConversationId(null);
            setMessages([]);
            setEditingMessageId(null);
            setDraft('');
          }}
        >
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.threadTitle}>
          {selectedConversation
            ? formatName(selectedConversation.first_name, selectedConversation.last_name) ||
              selectedConversation.email
            : 'Chat'}
        </Text>
      </View>

      {loadingMessages ? (
        <ActivityIndicator color="#111827" style={styles.loadingMessages} />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.messageid.toString()}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => {
            const isMine = item.senderid === userId;
            return (
              <View style={[styles.messageBubble, isMine ? styles.mineBubble : styles.theirBubble]}>
                <Text style={styles.messageSender}>{formatName(item.first_name, item.last_name)}</Text>
                <Text style={styles.messageBody}>{item.content}</Text>
                {isMine && (
                  <>
                    <Text style={styles.readReceipt}>
                      {item.read_at ? `Read ${formatReceiptTime(item.read_at)}` : 'Sent'}
                    </Text>
                    <View style={styles.messageActions}>
                      <Pressable
                        onPress={() => {
                          setEditingMessageId(item.messageid);
                          setDraft(item.content);
                        }}
                      >
                        <Text style={styles.actionText}>Edit</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          Alert.alert('Delete message', 'Delete this message?', [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () => {
                                void handleDeleteMessage(item.messageid);
                              },
                            },
                          ]);
                        }}
                      >
                        <Text style={styles.actionDeleteText}>Delete</Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.emptyMessages}>No messages yet.</Text>}
        />
      )}

      {editingMessageId && (
        <View style={styles.editBanner}>
          <Text style={styles.editBannerText}>Editing message</Text>
          <Pressable
            onPress={() => {
              setEditingMessageId(null);
              setDraft('');
            }}
          >
            <Text style={styles.cancelEditText}>Cancel</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.composerRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={editingMessageId ? 'Edit message' : 'Type a message'}
          style={styles.composerInput}
        />
        <Pressable
          style={[styles.sendButton, sending && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={sending}
        >
          <Text style={styles.sendButtonText}>
            {sending ? '...' : editingMessageId ? 'Save' : 'Send'}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Chat</Text>
        {!selectedConversationId && (
          <View style={styles.headerActions}>
            {isSelectingChats ? (
              <>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => {
                    setIsSelectingChats(false);
                    setSelectedChatIds([]);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.deleteSelectedButton,
                    selectedChatIds.length === 0 && styles.deleteSelectedButtonDisabled,
                  ]}
                  onPress={() => {
                    void handleBulkDeleteConversations();
                  }}
                  disabled={selectedChatIds.length === 0}
                >
                  <Text style={styles.deleteSelectedButtonText}>Delete</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable style={styles.editChatsButton} onPress={() => setIsSelectingChats(true)}>
                  <Text style={styles.editChatsButtonText}>Edit</Text>
                </Pressable>
                <Pressable style={styles.newChatButton} onPress={() => setShowUsersModal(true)}>
                  <Text style={styles.newChatButtonText}>New Chat</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </View>

      {selectedConversationId ? renderThread() : renderList()}

      <Modal visible={showUsersModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowUsersModal(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Start a Chat</Text>
            <TextInput
              value={userSearch}
              onChangeText={setUserSearch}
              placeholder="Search users"
              style={styles.searchInput}
            />
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item.userid.toString()}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.userRow}
                  onPress={() => {
                    void handleStartConversation(item.userid);
                  }}
                >
                  <Text style={styles.userName}>{formatName(item.first_name, item.last_name)}</Text>
                  <Text style={styles.userEmail}>{item.email}</Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyUsersText}>No users available to start a chat.</Text>
              }
            />
            <Pressable style={styles.closeModalButton} onPress={() => setShowUsersModal(false)}>
              <Text style={styles.closeModalButtonText}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 56,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#111827',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editChatsButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  editChatsButtonText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
  },
  newChatButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  newChatButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  cancelButtonText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteSelectedButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  deleteSelectedButtonDisabled: {
    opacity: 0.5,
  },
  deleteSelectedButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  loadingConversations: {
    marginVertical: 20,
  },
  chatList: {
    gap: 10,
    paddingBottom: 20,
  },
  chatRow: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectCircleWrap: {
    padding: 2,
  },
  selectCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#9ca3af',
    backgroundColor: '#fff',
  },
  selectCircleSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  chatOpenArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chatTextWrap: {
    flex: 1,
    marginRight: 10,
  },
  chatName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 3,
  },
  chatPreview: {
    fontSize: 14,
    color: '#6b7280',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563eb',
    marginLeft: 6,
  },
  emptyListCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  emptyListText: {
    color: '#6b7280',
    fontSize: 14,
  },
  threadContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    backgroundColor: '#fff',
    padding: 10,
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  backText: {
    color: '#2563eb',
    fontWeight: '600',
    fontSize: 14,
  },
  threadTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  loadingMessages: {
    marginTop: 20,
  },
  messageList: {
    gap: 8,
    paddingBottom: 10,
  },
  messageBubble: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: '88%',
  },
  mineBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#dbeafe',
  },
  theirBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
  },
  messageSender: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 2,
  },
  messageBody: {
    fontSize: 15,
    color: '#111827',
  },
  readReceipt: {
    marginTop: 3,
    alignSelf: 'flex-end',
    fontSize: 11,
    color: '#1d4ed8',
    fontWeight: '600',
  },
  messageActions: {
    marginTop: 4,
    flexDirection: 'row',
    alignSelf: 'flex-end',
    gap: 10,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  actionDeleteText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
  },
  editBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  editBannerText: {
    color: '#1f2937',
    fontSize: 13,
    fontWeight: '700',
  },
  cancelEditText: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: 12,
  },
  composerRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
  },
  composerInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
  },
  sendButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  emptySubtitle: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 14,
  },
  emptyMessages: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 28,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  userRow: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  userEmail: {
    marginTop: 2,
    fontSize: 13,
    color: '#6b7280',
  },
  emptyUsersText: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 8,
  },
  closeModalButton: {
    marginTop: 10,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
