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
  last_message?: string;
  last_message_at?: string;
};

type ChatMessage = {
  messageid: number;
  conversationid: number;
  senderid: number;
  content: string;
  sent_at: string;
  first_name: string;
  last_name: string;
};

type IncomingSocketEvent =
  | { type: 'identified'; userId: number }
  | { type: 'conversation_started'; conversationId: number; userIds: number[] }
  | { type: 'new_message'; conversationId: number; message: ChatMessage };

function mergeMessage(existing: ChatMessage[], next: ChatMessage): ChatMessage[] {
  if (existing.some((msg) => msg.messageid === next.messageid)) {
    return existing;
  }
  return [...existing, next];
}

function formatName(first: string, last: string) {
  return `${first ?? ''} ${last ?? ''}`.trim();
}

export default function ChatScreen() {
  const { currentUser } = useAuth();
  const userId = currentUser?.userid ?? null;

  const [users, setUsers] = useState<ChatUser[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);

  const selectedConversationRef = useRef<number | null>(null);

  useEffect(() => {
    selectedConversationRef.current = selectedConversationId;
  }, [selectedConversationId]);

  const loadUsers = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_URL}/chat/users?excludeUserId=${userId}`);
      if (!res.ok) return;
      const data = (await res.json()) as ChatUser[];
      setUsers(data);
    } catch (err) {
      console.error('Failed to load chat users:', err);
    }
  }, [userId]);

  const loadConversations = useCallback(async () => {
    if (!userId) return;
    try {
      setLoadingConversations(true);
      const res = await fetch(`${API_URL}/chat/conversations/user/${userId}`);
      if (!res.ok) return;
      const data = (await res.json()) as Conversation[];
      setConversations(data);

      if (data.length === 0) {
        setSelectedConversationId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  }, [userId]);

  const loadMessages = useCallback(async (conversationId: number) => {
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
    } catch (err) {
      console.error('Failed to load messages:', err);
      Alert.alert('Error', 'Could not load messages.');
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.conversationid === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
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
          }
          void loadConversations();
          return;
        }

        if (payload.type === 'conversation_started') {
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
  }, [userId, loadConversations]);

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
      await loadConversations();
      await loadMessages(data.conversationId);
    } catch (err) {
      console.error('Failed to start conversation:', err);
      Alert.alert('Error', 'Could not start conversation.');
    }
  };

  const handleSend = async () => {
    if (!userId || !selectedConversationId) return;

    const content = draft.trim();
    if (!content) return;

    try {
      setSending(true);
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

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Chats</Text>
        <Pressable style={styles.newChatButton} onPress={() => setShowUsersModal(true)}>
          <Text style={styles.newChatButtonText}>New Chat</Text>
        </Pressable>
      </View>

      {loadingConversations ? (
        <ActivityIndicator color="#111827" style={styles.loadingConversations} />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.conversationid.toString()}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.conversationList}
          renderItem={({ item }) => {
            const isSelected = item.conversationid === selectedConversationId;
            return (
              <Pressable
                style={[styles.conversationCard, isSelected && styles.conversationCardSelected]}
                onPress={() => {
                  void loadMessages(item.conversationid);
                }}
              >
                <Text style={styles.conversationName} numberOfLines={1}>
                  {formatName(item.first_name, item.last_name) || item.email}
                </Text>
                <Text style={styles.conversationPreview} numberOfLines={1}>
                  {item.last_message || 'No messages yet'}
                </Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyConversationsCard}>
              <Text style={styles.emptyConversationsText}>No conversations yet. Tap New Chat.</Text>
            </View>
          }
        />
      )}

      <View style={styles.threadContainer}>
        {selectedConversation ? (
          <>
            <Text style={styles.threadTitle}>
              {formatName(selectedConversation.first_name, selectedConversation.last_name) ||
                selectedConversation.email}
            </Text>

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
                    </View>
                  );
                }}
                ListEmptyComponent={<Text style={styles.emptyMessages}>No messages yet.</Text>}
              />
            )}

            <View style={styles.composerRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Type a message"
                style={styles.composerInput}
              />
              <Pressable
                style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                onPress={handleSend}
                disabled={sending}
              >
                <Text style={styles.sendButtonText}>{sending ? '...' : 'Send'}</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.centeredContainer}>
            <Text style={styles.emptyTitle}>Pick a chat</Text>
            <Text style={styles.emptySubtitle}>Select a conversation or start a new one.</Text>
          </View>
        )}
      </View>

      <Modal visible={showUsersModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowUsersModal(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Start a Chat</Text>
            <FlatList
              data={users}
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
    backgroundColor: '#f9fafb',
    paddingTop: 56,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
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
  loadingConversations: {
    marginVertical: 12,
  },
  conversationList: {
    paddingHorizontal: 12,
    gap: 10,
    paddingBottom: 8,
  },
  conversationCard: {
    width: 190,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  conversationCardSelected: {
    borderColor: '#111827',
    backgroundColor: '#f3f4f6',
  },
  conversationName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  conversationPreview: {
    fontSize: 13,
    color: '#6b7280',
  },
  emptyConversationsCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  emptyConversationsText: {
    color: '#6b7280',
    fontSize: 14,
  },
  threadContainer: {
    flex: 1,
    marginTop: 8,
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderBottomWidth: 0,
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  threadTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  loadingMessages: {
    marginTop: 24,
  },
  messageList: {
    paddingBottom: 12,
    gap: 8,
  },
  messageBubble: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: '86%',
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
    paddingHorizontal: 20,
    gap: 6,
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
    maxHeight: '65%',
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
