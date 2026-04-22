import { useTheme } from '@/context/ThemeContext';
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type HelpItem = {
  icon: string;
  title: string;
  desc: string;
};

type Props = {
  title: string;
  items: HelpItem[];
};

export default function HelpModal({ title, items }: Props) {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={[styles.helpBtn, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
        onPress={() => setVisible(true)}
      >
        <Text style={[styles.helpBtnText, { color: theme.textMuted }]}>?</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: theme.background }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {items.map((item, i) => (
                <View key={i} style={[styles.item, { borderBottomColor: theme.border }]}>
                  <Text style={styles.itemIcon}>{item.icon}</Text>
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemTitle, { color: theme.text }]}>{item.title}</Text>
                    <Text style={[styles.itemDesc, { color: theme.textMuted }]}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.closeBtn, { backgroundColor: theme.tint }]} onPress={() => setVisible(false)}>
              <Text style={styles.closeBtnText}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  helpBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  helpBtnText: { fontSize: 14, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet: { borderRadius: 20, padding: 20, width: '100%', maxHeight: '80%' },
  modalHandle: { width: 40, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  item: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 0.5, gap: 12 },
  itemIcon: { fontSize: 24, width: 32, textAlign: 'center' },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  itemDesc: { fontSize: 12, lineHeight: 18 },
  closeBtn: { borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
  closeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});