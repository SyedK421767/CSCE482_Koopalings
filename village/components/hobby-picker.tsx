import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type HobbyTag = {
  tagid: number;
  name: string;
};

type HobbyPickerProps = {
  tags: HobbyTag[];
  selectedIds: number[];
  onSelectionChange: (tagIds: number[]) => void;
  isLoading?: boolean;
  style?: ViewStyle;
};

export function HobbyPicker({
  tags,
  selectedIds,
  onSelectionChange,
  isLoading = false,
  style,
}: HobbyPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tags;
    const q = searchQuery.trim().toLowerCase();
    return tags.filter((t) => t.name.toLowerCase().includes(q));
  }, [tags, searchQuery]);

  const handleToggle = (tagId: number) => {
    const newIds = selectedIds.includes(tagId)
      ? selectedIds.filter((id) => id !== tagId)
      : [...selectedIds, tagId];
    onSelectionChange(newIds);
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search hobbies..."
          placeholderTextColor="#9ca3af"
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <Pressable
            onPress={() => setSearchQuery('')}
            style={styles.clearButton}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={20} color="#9ca3af" />
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <Text style={styles.emptyText}>Loading hobbies…</Text>
      ) : filteredTags.length === 0 ? (
        <Text style={styles.emptyText}>
          {searchQuery ? `No hobbies matching "${searchQuery}"` : 'No hobbies available.'}
        </Text>
      ) : (
        <FlatList
          data={filteredTags}
          keyExtractor={(item) => item.tagid.toString()}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isSelected = selectedIds.includes(item.tagid);
            return (
              <Pressable
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => handleToggle(item.tagid)}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {item.name}
                </Text>
                {isSelected && (
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color="#2563eb"
                    style={styles.checkIcon}
                  />
                )}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
  row: {
    gap: 12,
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  listContent: {
    paddingBottom: 24,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  chipSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  chipText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  chipTextSelected: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  checkIcon: {
    marginLeft: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 24,
  },
});
