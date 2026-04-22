import HelpModal from '@/components/HelpModal';
import { PLANTS } from '@/constants/plants';
import { ThemeName } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type PlacedPlant = {
  id: number;
  plant: typeof PLANTS[0];
  soil: string;
  lastWatered: string;
};

type Friend = {
  id: string;
  name: string;
  code: string;
  plantCount: number;
  addedAt: string;
};

function getDaysUntilWater(plant: typeof PLANTS[0], lastWatered: string): number {
  const now = new Date();
  const diffMs = now.getTime() - new Date(lastWatered).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return plant.waterDays - diffDays;
}

function generateCode(name: string): string {
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  const prefix = name.replace(/\s/g, '').substring(0, 3).toUpperCase();
  return `${prefix}-${rand}`;
}

export default function ProfileScreen() {
  const { theme, themeName, setTheme } = useTheme();
  const [placedPlants, setPlacedPlants] = useState<PlacedPlant[]>([]);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [username, setUsername] = useState('Gardener');
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [myCode, setMyCode] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendCode, setFriendCode] = useState('');
  const [friendName, setFriendName] = useState('');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const plants = await AsyncStorage.getItem('placedPlants');
      const img = await AsyncStorage.getItem('profileImage');
      const name = await AsyncStorage.getItem('username');
      const code = await AsyncStorage.getItem('myCode');
      const friendsData = await AsyncStorage.getItem('friends');
      if (plants) setPlacedPlants(JSON.parse(plants));
      if (img) setProfileImage(img);
      if (name) setUsername(name);
      if (friendsData) setFriends(JSON.parse(friendsData));
      if (code) {
        setMyCode(code);
      } else {
        const newCode = generateCode(name || 'Gardener');
        setMyCode(newCode);
        await AsyncStorage.setItem('myCode', newCode);
      }
    } catch (e) {}
  }

  async function pickImage() {
    Alert.alert('Profile Photo', 'Choose a source', [
      {
        text: 'Camera', onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission needed', 'Camera access is required.'); return; }
          const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
          if (!result.canceled) { setProfileImage(result.assets[0].uri); await AsyncStorage.setItem('profileImage', result.assets[0].uri); }
        }
      },
      {
        text: 'Photo Library', onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission needed', 'Photo library access is required.'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
          if (!result.canceled) { setProfileImage(result.assets[0].uri); await AsyncStorage.setItem('profileImage', result.assets[0].uri); }
        }
      },
      { text: 'Cancel', style: 'cancel' }
    ]);
  }

  async function saveName() {
    const newName = tempName.trim() || 'Gardener';
    setUsername(newName);
    setEditingName(false);
    const newCode = generateCode(newName);
    setMyCode(newCode);
    await AsyncStorage.setItem('username', newName);
    await AsyncStorage.setItem('myCode', newCode);
  }

  async function shareCode() {
    const message = `Hey! I'm using Plot, a garden app 🌿\nAdd me with my friend code: ${myCode}`;
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync('', { dialogTitle: message });
    } else {
      await Clipboard.setStringAsync(message);
      Alert.alert('Copied!', 'Your friend code has been copied to clipboard.');
    }
  }

  async function copyCode() {
    await Clipboard.setStringAsync(myCode);
    Alert.alert('Copied!', 'Your friend code has been copied.');
  }

  async function addFriend() {
    const code = friendCode.trim().toUpperCase();
    const name = friendName.trim() || 'Friend';
    if (!code) { Alert.alert('Enter a code', 'Please enter your friend\'s code.'); return; }
    if (code === myCode) { Alert.alert('That\'s you!', 'You can\'t add yourself as a friend.'); return; }
    if (friends.find(f => f.code === code)) { Alert.alert('Already added', 'This friend is already in your list.'); return; }
    const newFriend: Friend = { id: Date.now().toString(), name, code, plantCount: Math.floor(Math.random() * 12) + 1, addedAt: new Date().toISOString() };
    const newFriends = [...friends, newFriend];
    setFriends(newFriends);
    await AsyncStorage.setItem('friends', JSON.stringify(newFriends));
    setFriendCode('');
    setFriendName('');
    setShowAddFriend(false);
    Alert.alert('Friend added! 🌱', `${name} has been added to your garden friends.`);
  }

  async function removeFriend(id: string) {
    Alert.alert('Remove friend?', 'They will be removed from your friends list.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          const newFriends = friends.filter(f => f.id !== id);
          setFriends(newFriends);
          await AsyncStorage.setItem('friends', JSON.stringify(newFriends));
        }
      }
    ]);
  }

  const needsWater = placedPlants.filter(pp => getDaysUntilWater(pp.plant, pp.lastWatered) <= 0);
  const healthy = placedPlants.filter(pp => getDaysUntilWater(pp.plant, pp.lastWatered) > 0);
  const uniqueFamilies = [...new Set(placedPlants.map(pp => pp.plant.family))];

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} showsVerticalScrollIndicator={false}>

      {/* Header */}
<View style={[styles.headerBg, { backgroundColor: theme.headerBg }]}>
  <View style={{ position: 'absolute', top: 16, right: 16 }}>
    <HelpModal
      title="How to use your Profile 👤"
      items={[
        { icon: '📸', title: 'Profile photo', desc: 'Tap the avatar to set a profile photo using your camera or photo library.' },
        { icon: '✏️', title: 'Edit your name', desc: 'Tap your name to edit it. Your friend code updates automatically.' },
        { icon: '🔗', title: 'Friend code', desc: 'Share your unique code with friends so they can add you. Tap Copy or Share.' },
        { icon: '🌱', title: 'Add friends', desc: 'Tap + Add and enter a friend\'s code and name to add them to your list.' },
        { icon: '💧', title: 'Plant status', desc: 'See which of your plants need water now and which are healthy.' },
        { icon: '🎨', title: 'Themes', desc: 'Change the app\'s look at the bottom — Light, Dark, Forest, or Sunset.' },
      ]}
    />
  </View>
  <TouchableOpacity onPress={pickImage} style={styles.avatarWrapper}>
          {profileImage
            ? <Image source={{ uri: profileImage }} style={styles.avatarImage} />
            : <View style={[styles.avatarCircle, { backgroundColor: theme.tint }]}><Text style={styles.avatarEmoji}>🌿</Text></View>
          }
          <View style={styles.avatarEditBadge}><Text style={styles.avatarEditText}>✏️</Text></View>
        </TouchableOpacity>
        {editingName ? (
          <View style={styles.nameEditRow}>
            <TextInput
              style={[styles.nameInput, { backgroundColor: theme.background, color: theme.text }]}
              value={tempName}
              onChangeText={setTempName}
              autoFocus
              placeholder="Your name"
              placeholderTextColor={theme.textMuted}
            />
            <TouchableOpacity style={[styles.nameSaveBtn, { backgroundColor: theme.tint }]} onPress={saveName}>
              <Text style={styles.nameSaveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => { setTempName(username); setEditingName(true); }}>
            <Text style={[styles.username, { color: theme.text }]}>{username} ✏️</Text>
          </TouchableOpacity>
        )}
        <Text style={[styles.userSub, { color: theme.textMuted }]}>{placedPlants.length} plant{placedPlants.length !== 1 ? 's' : ''} growing</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard value={placedPlants.length} label="Total Plants" color={theme.tint} theme={theme} />
        <StatCard value={healthy.length} label="Healthy" color={theme.tint} theme={theme} />
        <StatCard value={needsWater.length} label="Need Water" color="#185FA5" theme={theme} />
      </View>
      <View style={styles.statsRow}>
        <StatCard value={placedPlants.filter(p => p.plant.indoor).length} label="Indoor" color="#854F0B" theme={theme} />
        <StatCard value={placedPlants.filter(p => !p.plant.indoor).length} label="Outdoor" color="#854F0B" theme={theme} />
        <StatCard value={uniqueFamilies.length} label="Families" color={theme.textMuted} theme={theme} />
      </View>

      {/* My Code */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>🔗 My Friend Code</Text>
        <View style={[styles.codeCard, { backgroundColor: theme.cardBg }]}>
          <Text style={[styles.codeText, { color: theme.text }]}>{myCode}</Text>
          <View style={styles.codeButtons}>
            <TouchableOpacity style={[styles.codeBtn, { backgroundColor: theme.backgroundSecondary }]} onPress={copyCode}>
              <Text style={[styles.codeBtnText, { color: theme.text }]}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.codeBtn, { backgroundColor: theme.tint }]} onPress={shareCode}>
              <Text style={[styles.codeBtnText, { color: '#fff' }]}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={[styles.codeHint, { color: theme.textMuted }]}>Share this code with friends so they can add you</Text>
      </View>

      {/* Friends */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>🌱 Friends ({friends.length})</Text>
          <TouchableOpacity onPress={() => setShowAddFriend(true)}>
            <Text style={[styles.addFriendBtn, { color: theme.tint }]}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {friends.length === 0 ? (
          <View style={[styles.emptyFriends, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.emptyFriendsText, { color: theme.textMuted }]}>No friends yet — share your code to get started!</Text>
          </View>
        ) : (
          friends.map((friend, i) => (
            <TouchableOpacity key={i} style={[styles.friendRow, { backgroundColor: theme.cardBg }]} onLongPress={() => removeFriend(friend.id)}>
              <View style={[styles.friendAvatar, { backgroundColor: theme.tint }]}>
                <Text style={styles.friendAvatarText}>{friend.name[0].toUpperCase()}</Text>
              </View>
              <View style={styles.friendInfo}>
                <Text style={[styles.friendName, { color: theme.text }]}>{friend.name}</Text>
                <Text style={[styles.friendSub, { color: theme.textMuted }]}>Code: {friend.code} · {friend.plantCount} plants</Text>
              </View>
              <View style={[styles.friendBadge, { backgroundColor: theme.greenLight }]}>
                <Text style={[styles.friendBadgeText, { color: theme.greenDark }]}>Friend</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Needs water */}
      {needsWater.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>💧 Needs Water Now</Text>
          {needsWater.map((pp, i) => (
            <View key={i} style={[styles.plantRow, { backgroundColor: theme.cardBg, borderLeftColor: '#185FA5' }]}>
              <Image source={pp.plant.image} style={styles.plantRowImage} />
              <View style={styles.plantRowInfo}>
                <Text style={[styles.plantRowName, { color: theme.text }]}>{pp.plant.name}</Text>
                <Text style={[styles.plantRowSub, { color: theme.textMuted }]}>Waters {pp.plant.water} · {pp.soil} soil</Text>
              </View>
              <View style={styles.urgentBadge}><Text style={styles.urgentText}>Now</Text></View>
            </View>
          ))}
        </View>
      )}

      {/* Healthy plants */}
      {healthy.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>✅ Healthy Plants</Text>
          {healthy.map((pp, i) => {
            const daysLeft = getDaysUntilWater(pp.plant, pp.lastWatered);
            return (
              <View key={i} style={[styles.plantRow, { backgroundColor: theme.cardBg, borderLeftColor: theme.tint }]}>
                <Image source={pp.plant.image} style={styles.plantRowImage} />
                <View style={styles.plantRowInfo}>
                  <Text style={[styles.plantRowName, { color: theme.text }]}>{pp.plant.name}</Text>
                  <Text style={[styles.plantRowSub, { color: theme.textMuted }]}>Water in {daysLeft} day{daysLeft !== 1 ? 's' : ''} · {pp.soil} soil</Text>
                </View>
                <View style={[styles.healthyBadge, { backgroundColor: theme.greenLight }]}>
                  <Text style={[styles.healthyText, { color: theme.greenDark }]}>{daysLeft}d</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Soil breakdown */}
      {placedPlants.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>🪱 Soil Types in Use</Text>
          {[...new Set(placedPlants.map(pp => pp.soil))].map((soil, i) => {
            const count = placedPlants.filter(pp => pp.soil === soil).length;
            const pct = Math.round((count / placedPlants.length) * 100);
            return (
              <View key={i} style={styles.soilBar}>
                <View style={styles.soilBarHeader}>
                  <Text style={[styles.soilBarLabel, { color: theme.text }]}>{soil}</Text>
                  <Text style={[styles.soilBarCount, { color: theme.textMuted }]}>{count} plant{count !== 1 ? 's' : ''}</Text>
                </View>
                <View style={[styles.soilBarTrack, { backgroundColor: theme.cardBg }]}>
                  <View style={[styles.soilBarFill, { width: `${pct}%` as any, backgroundColor: theme.tint }]} />
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Theme switcher */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>🎨 Theme</Text>
        {([
          { name: 'light', label: '☀️ Light', desc: 'Clean and bright' },
          { name: 'dark', label: '🌙 Dark', desc: 'Easy on the eyes' },
          { name: 'forest', label: '🌲 Forest', desc: 'Deep greens' },
          { name: 'sunset', label: '🌅 Sunset', desc: 'Warm oranges' },
        ] as { name: ThemeName; label: string; desc: string }[]).map((t, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.themeRow, { backgroundColor: theme.cardBg }, themeName === t.name && { backgroundColor: theme.greenLight, borderWidth: 1.5, borderColor: theme.tint }]}
            onPress={() => setTheme(t.name)}
          >
            <View style={styles.themeInfo}>
              <Text style={[styles.themeLabel, { color: theme.text }]}>{t.label}</Text>
              <Text style={[styles.themeDesc, { color: theme.textMuted }]}>{t.desc}</Text>
            </View>
            {themeName === t.name && <Text style={[styles.themeCheck, { color: theme.tint }]}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>

      {placedPlants.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🌱</Text>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No plants yet</Text>
          <Text style={[styles.emptySub, { color: theme.textMuted }]}>Head to the Garden tab to start planting!</Text>
        </View>
      )}

      <View style={{ height: 40 }} />

      {/* Add friend modal */}
      <Modal visible={showAddFriend} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.background }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add a Friend 🌿</Text>
            <Text style={[styles.modalSub, { color: theme.textMuted }]}>Enter your friend's code to add them</Text>
            <View style={styles.modalField}>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Their name</Text>
              <TextInput style={[styles.fieldInput, { backgroundColor: theme.cardBg, color: theme.text }]} placeholder="e.g. Maria" value={friendName} onChangeText={setFriendName} placeholderTextColor={theme.textMuted} />
            </View>
            <View style={styles.modalField}>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Friend code</Text>
              <TextInput style={[styles.fieldInput, { backgroundColor: theme.cardBg, color: theme.text }]} placeholder="e.g. MAR-AB12C" value={friendCode} onChangeText={setFriendCode} autoCapitalize="characters" placeholderTextColor={theme.textMuted} />
            </View>
            <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: theme.tint }]} onPress={addFriend}>
              <Text style={styles.confirmText}>Add Friend</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddFriend(false)}>
              <Text style={[styles.cancelText, { color: theme.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function StatCard({ value, label, color, theme }: { value: number; label: string; color: string; theme: any }) {
  return (
    <View style={[styles.statCard, { backgroundColor: theme.cardBg }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBg: { paddingTop: 70, paddingBottom: 28, alignItems: 'center' },
  avatarWrapper: { position: 'relative', marginBottom: 12 },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  avatarEmoji: { fontSize: 36 },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#fff', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
  avatarEditText: { fontSize: 12 },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  nameInput: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, fontSize: 16, fontWeight: '600', minWidth: 140 },
  nameSaveBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  nameSaveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  username: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  userSub: { fontSize: 13 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginTop: 12 },
  statCard: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 2, textAlign: 'center' },
  section: { marginHorizontal: 16, marginTop: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  addFriendBtn: { fontSize: 14, fontWeight: '700' },
  codeCard: { borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeText: { fontSize: 22, fontWeight: '700', letterSpacing: 2 },
  codeButtons: { flexDirection: 'row', gap: 8 },
  codeBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  codeBtnText: { fontSize: 13, fontWeight: '600' },
  codeHint: { fontSize: 11, marginTop: 8 },
  emptyFriends: { borderRadius: 12, padding: 16, alignItems: 'center' },
  emptyFriendsText: { fontSize: 13, textAlign: 'center' },
  friendRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginBottom: 8 },
  friendAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  friendAvatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 14, fontWeight: '600' },
  friendSub: { fontSize: 11, marginTop: 2 },
  friendBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  friendBadgeText: { fontSize: 11, fontWeight: '600' },
  plantRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 10, marginBottom: 8, borderLeftWidth: 3 },
  plantRowImage: { width: 44, height: 44, borderRadius: 8, marginRight: 10 },
  plantRowInfo: { flex: 1 },
  plantRowName: { fontSize: 14, fontWeight: '600' },
  plantRowSub: { fontSize: 11, marginTop: 2 },
  urgentBadge: { backgroundColor: '#185FA5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  urgentText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  healthyBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  healthyText: { fontSize: 11, fontWeight: '700' },
  soilBar: { marginBottom: 12 },
  soilBarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  soilBarLabel: { fontSize: 13, fontWeight: '500' },
  soilBarCount: { fontSize: 12 },
  soilBarTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  soilBarFill: { height: 8, borderRadius: 4 },
  themeRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, marginBottom: 8 },
  themeInfo: { flex: 1 },
  themeLabel: { fontSize: 15, fontWeight: '600' },
  themeDesc: { fontSize: 12, marginTop: 2 },
  themeCheck: { fontSize: 18, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub: { fontSize: 14, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  modalSub: { fontSize: 13, marginBottom: 16 },
  modalField: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, marginBottom: 6, fontWeight: '500' },
  fieldInput: { borderRadius: 10, padding: 12, fontSize: 15 },
  confirmBtn: { borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  confirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn: { padding: 14, alignItems: 'center' },
  cancelText: { fontSize: 14 },
});