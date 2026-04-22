import HelpModal from '@/components/HelpModal';
import { PLANTS } from '@/constants/plants';
import { useTheme } from '@/context/ThemeContext';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function EncyclopediaScreen() {
  const { theme } = useTheme();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<null | typeof PLANTS[0]>(null);

  const filtered = PLANTS.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.family.toLowerCase().includes(search.toLowerCase()) ||
    p.origin.toLowerCase().includes(search.toLowerCase())
  );

  if (selected) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
        <PlantImage image={selected.image} style={styles.detailImage} />
        <TouchableOpacity style={styles.backBtn} onPress={() => setSelected(null)}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.detailBody}>
          <Text style={[styles.detailName, { color: theme.text }]}>{selected.name}</Text>
          <Text style={[styles.detailFamily, { color: theme.textMuted }]}>{selected.family} · {selected.origin}</Text>
          <Text style={[styles.detailSpec, { color: theme.textMuted }]}>{selected.spec}</Text>
          <View style={styles.statsGrid}>
            <StatBox icon="💧" label="Water" value={selected.water} theme={theme} />
            <StatBox icon="☀️" label="Sun" value={selected.sun} theme={theme} />
            <StatBox icon="🌡️" label="Temp" value={selected.temp} theme={theme} />
            <StatBox icon="💨" label="Humidity" value={selected.humidity} theme={theme} />
            <StatBox icon="🪱" label="Soil" value={selected.soil} theme={theme} />
            <StatBox icon="⚡" label="Growth" value={selected.growth} theme={theme} />
            <StatBox icon="☠️" label="Toxicity" value={selected.toxicity} theme={theme} />
            <StatBox icon="🧪" label="Fertilizer" value={selected.fertilizer} theme={theme} />
            <StatBox icon="✂️" label="Pruning" value={selected.pruning} theme={theme} />
            <StatBox icon="🌸" label="Bloom" value={selected.bloom} theme={theme} />
            <StatBox icon="📍" label="Indoor" value={selected.indoor ? 'Yes' : 'Outdoor'} theme={theme} />
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 60, marginBottom: 12 }}>
  <Text style={[styles.title, { color: theme.text, marginTop: 0, marginBottom: 0 }]}>Encyclopedia</Text>
  <HelpModal
    title="How to use the Encyclopedia 📖"
    items={[
      { icon: '🔍', title: 'Search plants', desc: 'Type in the search bar to filter by plant name, family, or origin.' },
      { icon: '🌿', title: 'Browse plants', desc: 'Scroll through all 20 plants. Each card shows watering frequency, sunlight needs, and whether it\'s indoor or outdoor.' },
      { icon: '📋', title: 'Plant details', desc: 'Tap any plant to see full stats including temperature range, humidity, soil type, toxicity, growth speed, and more.' },
      { icon: '← ', title: 'Go back', desc: 'Tap the Back button on the detail page to return to the full plant list.' },
    ]}
  />
</View>
      <TextInput
        style={[styles.search, { backgroundColor: theme.cardBg, color: theme.text, borderColor: theme.border }]}
        placeholder="Search plants..."
        value={search}
        onChangeText={setSearch}
        placeholderTextColor={theme.textMuted}
      />
      <ScrollView>
        {filtered.map((plant, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}
            onPress={() => setSelected(plant)}
          >
            <PlantImage image={plant.image} style={styles.cardImage} />
            <View style={styles.cardInfo}>
              <Text style={[styles.cardName, { color: theme.text }]}>{plant.name}</Text>
              <Text style={[styles.cardFamily, { color: theme.textMuted }]}>{plant.family} · {plant.origin}</Text>
              <View style={styles.tags}>
                <Tag text={`💧 ${plant.water}`} color={theme.greenLight} textColor={theme.greenDark} />
                <Tag text={`☀️ ${plant.sun}`} color="#FAEEDA" textColor="#854F0B" />
                <Tag text={`📍 ${plant.indoor ? 'Indoor' : 'Outdoor'}`} color="#E6F1FB" textColor="#185FA5" />
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function PlantImage({ image, style }: { image: any; style: any }) {
  return image
    ? <Image source={image} style={style} />
    : <View style={[style, { backgroundColor: '#E1F5EE', alignItems: 'center', justifyContent: 'center' }]}><Text style={{ fontSize: 28 }}>🌿</Text></View>;
}

function StatBox({ icon, label, value, theme }: { icon: string; label: string; value: string; theme: any }) {
  return (
    <View style={[styles.statBox, { backgroundColor: theme.cardBg }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function Tag({ text, color, textColor }: { text: string; color: string; textColor: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: color }]}>
      <Text style={[styles.tagText, { color: textColor }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  title: { fontSize: 28, fontWeight: '700', marginTop: 60, marginBottom: 12 },
  search: { borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 12, borderWidth: 0.5 },
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, marginBottom: 10, borderWidth: 0.5, overflow: 'hidden' },
  cardImage: { width: 80, height: 80 },
  cardInfo: { flex: 1, padding: 10 },
  cardName: { fontSize: 16, fontWeight: '600' },
  cardFamily: { fontSize: 12, marginBottom: 6 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: '500' },
  detailImage: { width: '100%', height: 260 },
  backBtn: { position: 'absolute', top: 52, left: 16, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  backText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  detailBody: { padding: 16 },
  detailName: { fontSize: 28, fontWeight: '700' },
  detailFamily: { fontSize: 14, marginBottom: 8 },
  detailSpec: { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statBox: { borderRadius: 12, padding: 12, width: '47%', alignItems: 'center' },
  statIcon: { fontSize: 22, marginBottom: 4 },
  statLabel: { fontSize: 11, marginBottom: 2 },
  statValue: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
});