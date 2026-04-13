import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/auth-context';

const API_URL = 'https://village-backend-802022146719.us-central1.run.app';
const WS_URL = `${API_URL.replace(/^http/, 'ws')}/ws`;
const PROFILES_API_URL = 'https://village-backend-4f6m46wkfq-uc.a.run.app';

const COLORS = {
  background: '#062f66',
  cardBackground: '#FFFFFF',
  primary: '#2743bc',
  yellow: '#ffbd59',
  red: '#e34348',
  textPrimary: '#062f66',
  textSecondary: '#5a6c8c',
  textLight: '#8892a8',
  textOnDark: '#FFFFFF',
  border: '#E5E7EB',
  shadow: '#000000',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.textOnDark,
    letterSpacing: -0.5,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editChatsButton: {
    borderWidth: 3,
    borderColor: COLORS.textOnDark,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  editChatsButtonText: {
    color: COLORS.textOnDark,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  newChatButton: {
    backgroundColor: COLORS.yellow,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 0,
    borderWidth: 3,
    borderColor: COLORS.yellow,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
    elevation: 4,
  },
  newGroupButton: {
    marginLeft: 4,
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  newChatButtonText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  newGroupButtonText: {
    color: COLORS.textOnDark,
  },
  cancelButton: {
    borderWidth: 3,
    borderColor: COLORS.textOnDark,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  cancelButtonText: {
    color: COLORS.textOnDark,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  deleteSelectedButton: {
    backgroundColor: COLORS.red,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 0,
    borderWidth: 3,
    borderColor: COLORS.red,
  },
  deleteSelectedButtonDisabled: {
    opacity: 0.5,
  },
  deleteSelectedButtonText: {
    color: COLORS.textOnDark,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  searchInput: {
    borderWidth: 3,
    borderColor: COLORS.border,
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.cardBackground,
    marginBottom: 12,
    fontWeight: '600',
  },
  loadingConversations: {
    marginVertical: 20,
  },
  chatList: {
    gap: 10,
    paddingBottom: 20,
  },
  chatRow: {
    borderWidth: 3,
    borderColor: COLORS.border,
    borderRadius: 0,
    backgroundColor: COLORS.cardBackground,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderLeftWidth: 6,
    borderLeftColor: COLORS.primary,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 0,
    elevation: 4,
  },
  selectCircleWrap: {
    padding: 2,
  },
  selectCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardBackground,
  },
  selectCircleSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
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
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chatPreview: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  unreadDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.yellow,
    marginLeft: 6,
    borderWidth: 2,
    borderColor: COLORS.yellow,
  },
  emptyListCard: {
    borderWidth: 3,
    borderColor: COLORS.border,
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.cardBackground,
  },
  emptyListText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  threadContainer: {
    flex: 1,
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    zIndex: 1,
    padding: 4,
  },
  threadHeaderCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 6,
  },
  threadTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.textOnDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  loadingMessages: {
    marginTop: 20,
  },
  messageList: {
    gap: 10,
    paddingBottom: 70,
    paddingTop: 8,
  },
  messageListFooter: {
    height: 60,
  },
  mineWrapper: {
    alignItems: 'flex-end',
  },
  theirWrapper: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '80%',
    minWidth: 80,
    borderWidth: 0,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  mineBubble: {
    backgroundColor: COLORS.yellow,
    alignSelf: 'flex-end',
  },
  theirBubble: {
    backgroundColor: COLORS.cardBackground,
    borderColor: 'transparent',
  },
  messageSender: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageBody: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '500',
    lineHeight: 20,
  },
  mineMessageText: {
    color: COLORS.textOnDark,
  },
  readReceipt: {
    marginTop: 4,
    fontSize: 11,
    color: COLORS.textLight,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  messageActions: {
    marginTop: 6,
    flexDirection: 'row',
    alignSelf: 'flex-end',
    gap: 12,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionDeleteText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.red,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: COLORS.primary,
    borderWidth: 3,
    borderColor: COLORS.primary,
    marginBottom: 8,
  },
  editBannerText: {
    color: COLORS.textOnDark,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cancelEditText: {
    color: COLORS.yellow,
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  composerRow: {
    backgroundColor: COLORS.background,
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 3,
    borderTopColor: COLORS.border,
    paddingTop: 12,
    paddingBottom: 8,
  },
  composerInput: {
    flex: 1,
    borderWidth: 3,
    borderColor: COLORS.border,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.cardBackground,
    fontWeight: '600',
  },
  sendButton: {
    backgroundColor: COLORS.red,
    borderRadius: 0,
    paddingHorizontal: 18,
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.red,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
    elevation: 4,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: COLORS.textOnDark,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.textOnDark,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  emptySubtitle: {
    textAlign: 'center',
    color: COLORS.textLight,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyMessages: {
    color: COLORS.textLight,
    fontSize: 14,
    marginTop: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    maxHeight: '70%',
    borderTopWidth: 4,
    borderTopColor: COLORS.yellow,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.textOnDark,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  userRow: {
    borderWidth: 3,
    borderColor: COLORS.border,
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
    backgroundColor: COLORS.cardBackground,
    borderLeftWidth: 6,
    borderLeftColor: COLORS.primary,
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  groupUserRow: {
    borderWidth: 3,
    borderColor: COLORS.border,
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
    backgroundColor: COLORS.cardBackground,
  },
  groupUserRowSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#e0e7ff',
  },
  groupUserNameSelected: {
    color: COLORS.primary,
  },
  userName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userEmail: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  emptyUsersText: {
    color: COLORS.textLight,
    fontSize: 14,
    marginTop: 8,
    fontWeight: '600',
  },
  closeModalButton: {
    marginTop: 14,
    backgroundColor: COLORS.red,
    borderRadius: 0,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.red,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 0,
    elevation: 6,
  },
  closeModalButtonText: {
    color: COLORS.textOnDark,
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  // Avatars in conversation list
  listAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 2,
    borderColor: COLORS.yellow,
  },
  listAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listAvatarInitial: {
    color: COLORS.textOnDark,
    fontWeight: '900',
    fontSize: 16,
  },
  // Avatar in thread header
  threadAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: COLORS.yellow,
  },
  threadAvatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadAvatarInitial: {
    color: COLORS.textOnDark,
    fontWeight: '900',
    fontSize: 18,
  },
});

type ChatUser = {
  userid: number;
  first_name: string;
  last_name: string;
  email: string;
};

type ConversationParticipant = {
  userid: number;
  first_name: string;
  last_name: string;
  email: string;
};

type Conversation = {
  conversationid: number;
  other_userid?: number | null;
  first_name: string;
  last_name: string;
  email: string;
  conversation_name: string | null;
  is_group: boolean;
  participants: ConversationParticipant[];
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

function getConversationDisplayName(conversation: Conversation, currentUserId: number | null) {
  if (conversation.is_group) {
    if (conversation.conversation_name) {
      return conversation.conversation_name;
    }
    const others = conversation.participants
      .filter((participant) => participant.userid !== currentUserId)
      .map((participant) => formatName(participant.first_name, participant.last_name))
      .filter(Boolean);
    return others.join(', ') || 'Group Chat';
  }
  return formatName(conversation.first_name, conversation.last_name) || conversation.email || 'Chat';
}

function selectConversationAvatarUserId(conversation: Conversation, currentUserId: number | null) {
  if (conversation.other_userid) {
    return conversation.other_userid;
  }
  return (
    conversation.participants.find((participant) => participant.userid !== currentUserId)?.userid ?? null
  );
}

function includesQuery(source: string | null | undefined, query: string) {
  return String(source ?? '').toLowerCase().includes(query.toLowerCase());
}

export default function ChatScreen() {
  const { currentUser } = useAuth();
  const userId = useMemo(() => {
    const candidate = currentUser?.userid;
    if (candidate == null) return null;
    const parsed = Number(candidate);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [currentUser?.userid]);

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
  const [sending, setSending] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [profilePics, setProfilePics] = useState<Record<number, string | null>>({});
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupSelections, setGroupSelections] = useState<number[]>([]);
  const [groupCreating, setGroupCreating] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');

  const selectedConversationRef = useRef<number | null>(null);
  const messageListRef = useRef<FlatList<ChatMessage>>(null);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);

  useEffect(() => {
    selectedConversationRef.current = selectedConversationId;
  }, [selectedConversationId]);

  const fetchProfilePics = useCallback(async (userIds: number[]) => {
    const missing = userIds.filter((id) => !(id in profilePics));
    if (missing.length === 0) return;
    const numericMissing = missing
      .map((value) => Number(value))
      .filter((id): id is number => Number.isInteger(id) && id > 0 && !(id in profilePics));
    if (numericMissing.length === 0) return;
    const results = await Promise.all(
      numericMissing.map(async (id) => {
        try {
          const res = await fetch(`${PROFILES_API_URL}/profiles/${id}`);
          if (!res.ok) return [id, null] as const;
          const data = await res.json();
          return [id, data.profile_picture ?? null] as const;
        } catch {
          return [id, null] as const;
        }
      })
    );
    setProfilePics((prev) => {
      const next = { ...prev };
      for (const [id, url] of results) next[id] = url;
      return next;
    });
  }, [profilePics]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.conversationid === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );

  const filteredConversations = useMemo(() => {
    const query = chatSearch.trim();
    if (!query) return conversations;

    return conversations.filter((conversation) => {
      const displayName = getConversationDisplayName(conversation, userId);
      return (
        includesQuery(displayName, query) ||
        includesQuery(conversation.email ?? '', query) ||
        includesQuery(conversation.last_message ?? '', query)
      );
    });
  }, [conversations, chatSearch, userId]);

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim();
    if (!query) return users;

    return users.filter((user) => {
      const name = `${user.first_name} ${user.last_name}`;
      return includesQuery(name, query) || includesQuery(user.email, query);
    });
  }, [users, userSearch]);

  const filteredGroupUsers = useMemo(() => {
    const query = groupSearch.trim();
    if (!query) return users;

    return users.filter((user) => {
      const name = `${user.first_name} ${user.last_name}`;
      return includesQuery(name, query) || includesQuery(user.email, query);
    });
  }, [users, groupSearch]);

  const toggleGroupSelection = (userid: number) => {
    setGroupSelections((prev) =>
      prev.includes(userid) ? prev.filter((id) => id !== userid) : [...prev, userid]
    );
  };

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
      const normalized = data.map((conversation) => ({
        ...conversation,
        participants: Array.isArray(conversation.participants)
          ? conversation.participants
          : [],
      }));
      setConversations(normalized);
      const otherUserIds = normalized
        .map((conversation) => Number(conversation.other_userid))
        .filter((id): id is number => Number.isInteger(id) && id > 0);
      if (otherUserIds.length > 0) {
        void fetchProfilePics(otherUserIds);
      }

      if (normalized.length === 0 && !selectedConversationRef.current) {
        setSelectedConversationId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      Alert.alert('Error', 'Could not load conversations.');
    } finally {
      setLoadingConversations(false);
    }
  }, [userId, fetchProfilePics]);

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
      // Update ref and state immediately so WebSocket messages that arrive
      // during the fetch are not dropped by the onmessage handler.
      selectedConversationRef.current = conversationId;
      setSelectedConversationId(conversationId);
      setEditingMessageId(null);
      setDraft('');
      try {
        const res = await fetch(`${API_URL}/chat/conversations/${conversationId}/messages`);
        if (!res.ok) {
          Alert.alert('Error', 'Could not load messages.');
          return;
        }
        const data = (await res.json()) as ChatMessage[];
        // Merge fetched messages with any that arrived via WebSocket during the fetch.
        setMessages((prev) => {
          const merged = [...data];
          for (const msg of prev) {
            if (!merged.some((m) => m.messageid === msg.messageid)) {
              merged.push(msg);
            }
          }
          return merged.sort(
            (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
          );
        });
        await markConversationRead(conversationId);
        void loadConversations();
      } catch (err) {
        console.error('Failed to load messages:', err);
        Alert.alert('Error', 'Could not load messages.');
      }
    },
    [loadConversations, markConversationRead]
  );

  useEffect(() => {
    if (!selectedConversationId) return;
    setIsPinnedToBottom(true);
    const timer = setTimeout(() => {
      messageListRef.current?.scrollToEnd({ animated: false });
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;
    if (isPinnedToBottom) {
      messageListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages, selectedConversationId, isPinnedToBottom]);

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

  const handleCreateGroup = async () => {
    if (!currentUser || !userId) return;
    const participantIds = Array.from(
      new Set(
        groupSelections
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0)
      )
    );
    if (participantIds.length < 2) {
      Alert.alert('Select at least two other valid users to create a group.');
      return;
    }
    setGroupCreating(true);
    try {
      console.log('Creating group chat', {
        userId,
        participantIds,
        groupName,
      });
      const res = await fetch(`${API_URL}/chat/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          participantIds,
          name: groupName.trim() || null,
        }),
      });
      if (!res.ok) {
        const text = await res
          .clone()
          .text()
          .catch(() => '');
        console.log('Group create failed', res.status, text);
        const payload = await res.json().catch(() => null);
        const serverMessage =
          typeof payload === 'object' && payload !== null ? (payload as { error?: string }).error : null;
        Alert.alert('Error', serverMessage ?? 'Could not create group chat.');
        return;
      }
      const { conversationId } = (await res.json()) as { conversationId: number };
      setGroupModalVisible(false);
      setGroupName('');
      setGroupSearch('');
      setGroupSelections([]);
      await loadConversations();
      await loadMessages(conversationId);
    } catch (err) {
      console.error('Failed to create group:', err);
      Alert.alert('Error', 'Could not create group chat.');
    } finally {
      setGroupCreating(false);
    }
  };

  const closeGroupModal = () => {
    setGroupModalVisible(false);
    setGroupName('');
    setGroupSearch('');
    setGroupSelections([]);
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
}  const renderList = () => (
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
          renderItem={({ item }) => {
            const displayName = getConversationDisplayName(item, userId);
            const avatarUserId = selectConversationAvatarUserId(item, userId);
            return (
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
                  {avatarUserId && profilePics[avatarUserId] ? (
                    <Image source={{ uri: profilePics[avatarUserId]! }} style={styles.listAvatar} />
                  ) : (
                    <View style={styles.listAvatarPlaceholder}>
                      <Text style={styles.listAvatarInitial}>
                        {(displayName?.[0] ?? '?').toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.chatTextWrap}>
                    <Text style={styles.chatName}>{displayName}</Text>
                    <Text style={styles.chatPreview} numberOfLines={1}>
                      {item.last_message || 'No messages yet'}
                    </Text>
                  </View>
                  {item.unread_count > 0 && <View style={styles.unreadDot} />}
                </Pressable>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyListCard}>
              <Text style={styles.emptyListText}>No matching chats.</Text>
            </View>
          }
        />
      )}
    </>
  );

const renderThread = () => {
  const threadDisplayName = selectedConversation
    ? getConversationDisplayName(selectedConversation, userId)
    : 'Chat';
  const threadAvatarUserId = selectedConversation
    ? selectConversationAvatarUserId(selectedConversation, userId)
    : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
    >
      <View style={styles.threadContainer}>
        <View style={styles.threadHeader}>
          <Pressable
            style={styles.backButton}
            onPress={() => {
              setSelectedConversationId(null);
              setMessages([]);
              setEditingMessageId(null);
              setDraft('');
            }}
          >
            <Ionicons name="arrow-back" size={26} color={COLORS.yellow} />
          </Pressable>

          {selectedConversation && (
            <View style={styles.threadHeaderCenter}>
              {threadAvatarUserId && profilePics[threadAvatarUserId] ? (
                <Image source={{ uri: profilePics[threadAvatarUserId]! }} style={styles.threadAvatar} />
              ) : (
                <View style={styles.threadAvatarPlaceholder}>
                  <Text style={styles.threadAvatarInitial}>
                    {(threadDisplayName?.[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.threadTitle}>{threadDisplayName}</Text>
            </View>
          )}
        </View>

        <FlatList
          ref={messageListRef}
          data={messages}
          keyExtractor={(item) => item.messageid.toString()}
          contentContainerStyle={styles.messageList}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            messageListRef.current?.scrollToEnd({ animated: true });
            setIsPinnedToBottom(true);
          }}
          onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
            const { contentSize, layoutMeasurement, contentOffset } = event.nativeEvent;
            const distanceFromBottom =
              contentSize.height - layoutMeasurement.height - contentOffset.y;
            setIsPinnedToBottom(distanceFromBottom <= 20);
          }}
          scrollEventThrottle={100}
          ListFooterComponent={<View style={styles.messageListFooter} />}
          renderItem={({ item }) => {
            const isMine = item.senderid === userId;
            return (
              <View style={isMine ? styles.mineWrapper : styles.theirWrapper}>
                <View style={[styles.messageBubble, isMine ? styles.mineBubble : styles.theirBubble]}>
                  <Text style={[styles.messageBody, isMine && styles.mineMessageText]}>
                    {item.content}
                  </Text>
                  {isMine && (
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
                  )}
                </View>
                {isMine && (
                  <Text style={styles.readReceipt}>
                    {item.read_at ? `Read ${formatReceiptTime(item.read_at)}` : 'Sent'}
                  </Text>
                )}
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.emptyMessages}>No messages yet.</Text>}
        />

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
    </KeyboardAvoidingView>
  );
};
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        {!selectedConversationId && <Text style={styles.title}>Chat</Text>}
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
                <Pressable
                  style={[styles.newChatButton, styles.newGroupButton]}
                  onPress={() => setGroupModalVisible(true)}
                >
                  <Text style={[styles.newChatButtonText, styles.newGroupButtonText]}>New Group</Text>
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
      <Modal visible={groupModalVisible} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={closeGroupModal}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>New Group</Text>
            <TextInput
              value={groupName}
              onChangeText={setGroupName}
              placeholder="Group name (optional)"
              style={styles.searchInput}
            />
            <TextInput
              value={groupSearch}
              onChangeText={setGroupSearch}
              placeholder="Search users"
              style={styles.searchInput}
            />
            <Text style={styles.modalSectionLabel}>Select at least two people</Text>
            <FlatList
              data={filteredGroupUsers}
              keyExtractor={(item) => item.userid.toString()}
              renderItem={({ item }) => {
                const selected = groupSelections.includes(item.userid);
                return (
                  <Pressable
                    style={[styles.groupUserRow, selected && styles.groupUserRowSelected]}
                    onPress={() => toggleGroupSelection(item.userid)}
                  >
                    <Text
                      style={[styles.userName, selected && styles.groupUserNameSelected]}
                    >
                      {formatName(item.first_name, item.last_name)}
                    </Text>
                    <Text style={styles.userEmail}>{item.email}</Text>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyUsersText}>No users available.</Text>
              }
            />
            <Pressable
              style={[styles.newChatButton, styles.newGroupButton]}
              onPress={handleCreateGroup}
              disabled={groupCreating}
            >
              <Text style={[styles.newChatButtonText, styles.newGroupButtonText]}>
                {groupCreating ? 'Creating…' : 'Create Group'}
              </Text>
            </Pressable>
            <Pressable style={styles.closeModalButton} onPress={closeGroupModal}>
              <Text style={styles.closeModalButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}