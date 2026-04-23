import HelpModal from '@/components/HelpModal';
import { PLANTS } from '@/constants/plants';
import { useTheme } from '@/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Modal, PanResponder, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Line, Polygon } from 'react-native-svg';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type Point = { x: number; y: number };
type PlacedPlant = {
  id: number;
  plant: typeof PLANTS[0];
  x: number;
  y: number;
  soil: string;
  lastWatered: string;
  wateringHistory: string[];
  streak: number;
  notifId?: string;
};

const SOIL_TYPES = ['Sandy', 'Loamy', 'Clay', 'Silty', 'Peaty', 'Moist', 'Well-drained', 'Bark mix'];
const PLANT_DOT_SIZE = 32;

function getSoilWarning(plant: typeof PLANTS[0], soil: string): { message: string; level: 'ok' | 'warn' | 'danger' } {
  if (soil === plant.soil) return { message: '', level: 'ok' };
  const badCombos: Record<string, string[]> = {
    'Orchid': ['Sandy', 'Clay', 'Loamy'],
    'Cactus': ['Peaty', 'Moist', 'Clay'],
    'Aloe': ['Peaty', 'Moist', 'Clay'],
    'Fern': ['Sandy', 'Bark mix'],
    'Lavender': ['Peaty', 'Moist', 'Clay'],
  };
  if (badCombos[plant.name]?.includes(soil)) {
    return { message: `🚨 ${plant.name} will struggle in ${soil} soil — use ${plant.soil}`, level: 'danger' };
  }
  return { message: `⚠️ ${plant.name} prefers ${plant.soil} soil`, level: 'warn' };
}

function getDaysUntilWater(plant: typeof PLANTS[0], lastWatered: string): number {
  const now = new Date();
  const diffMs = now.getTime() - new Date(lastWatered).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return plant.waterDays - diffDays;
}

function getHealthScore(pp: PlacedPlant): number {
  if (pp.wateringHistory.length === 0) return 100;
  const total = pp.wateringHistory.length;
  const onTime = pp.wateringHistory.filter((date, i) => {
    if (i === 0) return true;
    const prev = new Date(pp.wateringHistory[i - 1]);
    const curr = new Date(date);
    const diff = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    return diff <= pp.plant.waterDays + 1;
  }).length;
  return Math.round((onTime / total) * 100);
}

function getHealthLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Thriving 🌟', color: '#1D9E75' };
  if (score >= 60) return { label: 'Good 👍', color: '#854F0B' };
  if (score >= 40) return { label: 'Struggling 😟', color: '#e65100' };
  return { label: 'Critical 🚨', color: '#B00020' };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return true;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function DraggablePoint({ point, index, onMove, onMoveEnd, isFirst }: {
  point: Point;
  index: number;
  onMove: (index: number, x: number, y: number) => void;
  onMoveEnd: () => void;
  isFirst: boolean;
}) {
  const startPos = useRef({ x: 0, y: 0 });
  const startPoint = useRef({ x: 0, y: 0 });

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      startPos.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
      startPoint.current = { x: point.x, y: point.y };
    },
    onPanResponderMove: (e) => {
      const dx = e.nativeEvent.pageX - startPos.current.x;
      const dy = e.nativeEvent.pageY - startPos.current.y;
      onMove(index, startPoint.current.x + dx, startPoint.current.y + dy);
    },
    onPanResponderRelease: () => { onMoveEnd(); },
  })).current;

  return (
    <View
      {...panResponder.panHandlers}
      style={{
        position: 'absolute',
        left: point.x - 14,
        top: point.y - 14,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: isFirst ? '#0F6E56' : '#1D9E75',
        borderWidth: 2.5,
        borderColor: '#fff',
        zIndex: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      }}
    />
  );
}

export default function GardenScreen() {
  const { theme } = useTheme();
  const [mode, setMode] = useState<'draw' | 'plant'>('draw');
  const [gardenShape, setGardenShape] = useState<Point[]>([]);
  const [placedPlants, setPlacedPlants] = useState<PlacedPlant[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<PlacedPlant | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showSoilPicker, setShowSoilPicker] = useState(false);
  const [showHealthLog, setShowHealthLog] = useState(false);
  const [pendingPlant, setPendingPlant] = useState<typeof PLANTS[0] | null>(null);
  const [tapPosition, setTapPosition] = useState<Point>({ x: 0, y: 0 });
  const [selectedSoil, setSelectedSoil] = useState('Loamy');
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const canvasOffset = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<any>(null);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const pinchGesture = Gesture.Pinch()
    .onUpdate(e => {
      scale.value = Math.max(0.5, Math.min(savedScale.value * e.scale, 3));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const composed = pinchGesture;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    loadData();
    requestNotifPermission();
  }, []);

  async function loadData() {
    try {
      const shape = await AsyncStorage.getItem('gardenShape');
      const plants = await AsyncStorage.getItem('placedPlants');
      if (shape) setGardenShape(JSON.parse(shape));
      if (plants) {
        const parsed = JSON.parse(plants);
        const migrated = parsed.map((p: any) => ({
          ...p,
          wateringHistory: p.wateringHistory || [p.lastWatered],
          streak: p.streak || 0,
        }));
        setPlacedPlants(migrated);
      }
      if (shape && JSON.parse(shape).length >= 3) setMode('plant');
    } catch (e) {}
  }

  async function saveShape(shape: Point[]) {
    await AsyncStorage.setItem('gardenShape', JSON.stringify(shape));
  }

  async function savePlants(plants: PlacedPlant[]) {
    await AsyncStorage.setItem('placedPlants', JSON.stringify(plants));
  }

  async function requestNotifPermission() {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Notifications disabled', 'Enable notifications to get watering reminders.');
    }
  }

  async function scheduleWaterNotif(plant: typeof PLANTS[0]): Promise<string> {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `💧 Water your ${plant.name}!`,
        body: `Your ${plant.name} needs watering today.`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: plant.waterDays * 24 * 60 * 60,
        repeats: true,
      },
    });
    return id;
  }

  async function cancelNotif(id?: string) {
    if (id) await Notifications.cancelScheduledNotificationAsync(id);
  }

  function handleCanvasTap(e: any) {
  if (isDragging) return;
  if (scale.value !== savedScale.value) return;

  let x: number;
  let y: number;

  if (e.nativeEvent.clientX !== undefined && canvasRef.current) {
    const rect = canvasRef.current.getBoundingClientRect();
    console.log('clientX:', e.nativeEvent.clientX, 'clientY:', e.nativeEvent.clientY);
    console.log('rect left:', rect.left, 'rect top:', rect.top);
    x = (e.nativeEvent.clientX - rect.left) / scale.value;
    y = (e.nativeEvent.clientY - rect.top) / scale.value;
  } else {
    x = e.nativeEvent.locationX / scale.value;
    y = e.nativeEvent.locationY / scale.value;
  }

  const point = { x, y };

  if (mode === 'draw') {
    const newShape = [...gardenShape, point];
    setGardenShape(newShape);
    saveShape(newShape);
  } else {
    if (gardenShape.length >= 3 && !pointInPolygon(point, gardenShape)) {
      Alert.alert('Outside garden', 'Tap inside your garden area to place a plant.');
      return;
    }
    setTapPosition(point);
    setShowPicker(true);
  }
}

  function handlePointMove(index: number, x: number, y: number) {
    setIsDragging(true);
    const clamped = {
      x: Math.max(0, Math.min(x - canvasOffset.current.x, canvasSize.width)),
      y: Math.max(0, Math.min(y - canvasOffset.current.y, canvasSize.height)),
    };
    setGardenShape(prev => {
      const updated = [...prev];
      updated[index] = clamped;
      return updated;
    });
  }

  function handlePointMoveEnd() {
    setIsDragging(false);
    saveShape(gardenShape);
  }

  function selectPlantFromPicker(plant: typeof PLANTS[0]) {
    setPendingPlant(plant);
    setSelectedSoil(plant.soil);
    setShowPicker(false);
    setShowSoilPicker(true);
  }

  async function confirmPlacement() {
    if (!pendingPlant) return;
    const notifId = await scheduleWaterNotif(pendingPlant);
    const now = new Date().toISOString();
    const newPlants = [...placedPlants, {
      id: Date.now(),
      plant: pendingPlant,
      x: tapPosition.x,
      y: tapPosition.y,
      soil: selectedSoil,
      lastWatered: now,
      wateringHistory: [now],
      streak: 1,
      notifId,
    }];
    setPlacedPlants(newPlants);
    savePlants(newPlants);
    setShowSoilPicker(false);
    setPendingPlant(null);
  }

  async function markWatered(pp: PlacedPlant) {
    await cancelNotif(pp.notifId);
    const newNotifId = await scheduleWaterNotif(pp.plant);
    const now = new Date().toISOString();
    const daysLate = getDaysUntilWater(pp.plant, pp.lastWatered);
    const onTime = daysLate >= -1;
    const newStreak = onTime ? pp.streak + 1 : 1;
    const newHistory = [...pp.wateringHistory, now].slice(-20);
    const newPlants = placedPlants.map(p =>
      p.id === pp.id ? { ...p, lastWatered: now, wateringHistory: newHistory, streak: newStreak, notifId: newNotifId } : p
    );
    setPlacedPlants(newPlants);
    savePlants(newPlants);
    const updated = { ...pp, lastWatered: now, wateringHistory: newHistory, streak: newStreak, notifId: newNotifId };
    setSelectedPlant(updated);
    Alert.alert(
      onTime ? `✅ Watered! 🔥 Streak: ${newStreak}` : '✅ Watered!',
      onTime
        ? `Great job keeping up with ${pp.plant.name}! Next reminder in ${pp.plant.waterDays} day${pp.plant.waterDays > 1 ? 's' : ''}.`
        : `${pp.plant.name} was overdue. Streak reset — keep it up from here!`
    );
  }

  async function removePlant(pp: PlacedPlant) {
    await cancelNotif(pp.notifId);
    const newPlants = placedPlants.filter(p => p.id !== pp.id);
    setPlacedPlants(newPlants);
    savePlants(newPlants);
    setSelectedPlant(null);
  }

  function resetGarden() {
    Alert.alert('Reset garden?', 'This will clear your garden shape and all plants.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset', style: 'destructive', onPress: async () => {
          setGardenShape([]);
          setPlacedPlants([]);
          setMode('draw');
          scale.value = 1;
          savedScale.value = 1;
          await AsyncStorage.removeItem('gardenShape');
          await AsyncStorage.removeItem('placedPlants');
        }
      }
    ]);
  }

  function undoLastPoint() {
    const newShape = gardenShape.slice(0, -1);
    setGardenShape(newShape);
    saveShape(newShape);
  }

  function resetZoom() {
    scale.value = withSpring(1);
    savedScale.value = 1;
  }

  const warnings = placedPlants.map(pp => getSoilWarning(pp.plant, pp.soil)).filter(w => w.level !== 'ok');
  const needsWater = placedPlants.filter(pp => getDaysUntilWater(pp.plant, pp.lastWatered) <= 0);
  const polygonPoints = gardenShape.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.title, { color: theme.text }]}>My Garden</Text>
            <HelpModal
              title="How to use the Garden 🌿"
              items={[
                { icon: '✏️', title: 'Draw your garden', desc: 'Tap Draw Shape, then tap points on the canvas to outline your garden area. The shape closes automatically.' },
                { icon: '↩️', title: 'Undo points', desc: 'Made a mistake? Tap Undo to remove the last point you placed.' },
                { icon: '👆', title: 'Drag points', desc: 'In Draw mode, drag any green dot to adjust your garden shape.' },
                { icon: '🌱', title: 'Place plants', desc: 'Switch to Plant mode, then tap anywhere inside your garden to add a plant.' },
                { icon: '🪱', title: 'Choose your soil', desc: 'After picking a plant, select your soil type. Warnings will show if the soil is not ideal.' },
                { icon: '💧', title: 'Water tracking', desc: 'Tap a plant to see when it needs watering. Press "I watered this plant" to log it and reset the reminder.' },
                { icon: '🔥', title: 'Streaks', desc: 'Water your plants on time to build a streak. Plants with a 3+ streak show a 🔥 badge.' },
                { icon: '🔍', title: 'Zoom', desc: 'Pinch with two fingers to zoom in or out. Tap ⊙ Zoom to reset.' },
              ]}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={resetZoom}>
              <Text style={[styles.resetBtn, { color: theme.tint }]}>⊙ Zoom</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={resetGarden}>
              <Text style={[styles.resetBtn, { color: '#B00020' }]}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, { backgroundColor: theme.cardBg }, mode === 'draw' && { backgroundColor: theme.tint }]}
            onPress={() => setMode('draw')}
          >
            <Text style={[styles.modeBtnText, { color: theme.textMuted }, mode === 'draw' && { color: '#fff' }]}>✏️ Draw Shape</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, { backgroundColor: theme.cardBg }, mode === 'plant' && { backgroundColor: theme.tint }]}
            onPress={() => {
              if (gardenShape.length < 3) { Alert.alert('Draw first', 'Tap at least 3 points to define your garden shape.'); return; }
              setMode('plant');
            }}
          >
            <Text style={[styles.modeBtnText, { color: theme.textMuted }, mode === 'plant' && { color: '#fff' }]}>🌱 Place Plants</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.hint, { color: theme.textMuted }]}>
          {mode === 'draw'
            ? gardenShape.length === 0 ? 'Tap to draw your garden boundary' : `${gardenShape.length} point${gardenShape.length > 1 ? 's' : ''} — drag to adjust · pinch to zoom`
            : 'Tap inside your garden to place plants · pinch to zoom'}
        </Text>

        {needsWater.length > 0 && (
          <View style={[styles.strip, { backgroundColor: '#E6F1FB' }]}>
            <Text style={[styles.stripText, { color: '#185FA5' }]}>💧 {needsWater.length} plant{needsWater.length > 1 ? 's' : ''} need watering now</Text>
          </View>
        )}
        {warnings.slice(0, 2).map((w, i) => (
          <View key={i} style={[styles.strip, { backgroundColor: w.level === 'danger' ? '#FFE5E5' : theme.strip }]}>
            <Text style={[styles.stripText, { color: w.level === 'danger' ? '#B00020' : '#854F0B' }]}>{w.message}</Text>
          </View>
        ))}

        <GestureDetector gesture={composed}>
          <TouchableOpacity
            ref={canvasRef}
            style={[styles.plotCanvas, { backgroundColor: theme.backgroundCanvas, borderColor: theme.border }]}
            onPress={handleCanvasTap}
            activeOpacity={1}
            onLayout={e => {
              const { width, height } = e.nativeEvent.layout;
              setCanvasSize({ width, height });
            }}
          >
            <Animated.View style={[{ width: '100%', height: '100%' }, animatedStyle]}>
              {canvasSize.width > 0 && (
                <Svg width={canvasSize.width} height={canvasSize.height} style={StyleSheet.absoluteFill} pointerEvents="none">
                  {gardenShape.length >= 3 && (
                    <Polygon points={polygonPoints} fill="rgba(29,158,117,0.15)" stroke="#1D9E75" strokeWidth={2} />
                  )}
                  {gardenShape.map((pt, i) => {
                    if (i === 0) return null;
                    return <Line key={i} x1={gardenShape[i - 1].x} y1={gardenShape[i - 1].y} x2={pt.x} y2={pt.y} stroke="#1D9E75" strokeWidth={2} />;
                  })}
                  {gardenShape.length >= 3 && mode === 'draw' && (
                    <Line x1={gardenShape[gardenShape.length - 1].x} y1={gardenShape[gardenShape.length - 1].y} x2={gardenShape[0].x} y2={gardenShape[0].y} stroke="#1D9E75" strokeWidth={1.5} strokeDasharray="4,4" />
                  )}
                </Svg>
              )}

              {mode === 'draw' && gardenShape.map((pt, i) => (
                <DraggablePoint key={i} point={pt} index={i} onMove={handlePointMove} onMoveEnd={handlePointMoveEnd} isFirst={i === 0} />
              ))}

              {placedPlants.length === 0 && gardenShape.length === 0 && (
                <Text style={styles.plotHint}>Tap to draw your garden shape 🌿</Text>
              )}

              {placedPlants.map(pp => {
                const daysLeft = getDaysUntilWater(pp.plant, pp.lastWatered);
                const needsW = daysLeft <= 0;
                return (
                  <TouchableOpacity
                    key={pp.id}
                    style={[styles.plantDot, { left: pp.x - PLANT_DOT_SIZE / 2, top: pp.y - PLANT_DOT_SIZE / 2 }, needsW && styles.plantDotThirsty]}
                    onPress={e => { e.stopPropagation(); setSelectedPlant(pp); }}
                  >
                    <Image source={pp.plant.image} style={styles.plantDotImage} />
                    {needsW && <View style={styles.waterBadge}><Text style={styles.waterBadgeText}>💧</Text></View>}
                    {pp.streak >= 3 && !needsW && <View style={[styles.waterBadge, { backgroundColor: '#e65100' }]}><Text style={styles.waterBadgeText}>🔥</Text></View>}
                  </TouchableOpacity>
                );
              })}
            </Animated.View>
          </TouchableOpacity>
        </GestureDetector>

        <View style={styles.bottomRow}>
          {mode === 'draw' && gardenShape.length > 0 && (
            <TouchableOpacity style={[styles.undoBtn, { backgroundColor: theme.cardBg }]} onPress={undoLastPoint}>
              <Text style={[styles.undoBtnText, { color: theme.text }]}>↩ Undo</Text>
            </TouchableOpacity>
          )}
          <View style={styles.legend}>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#1D9E75' }]} /><Text style={[styles.legendText, { color: theme.textMuted }]}>Healthy</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#185FA5' }]} /><Text style={[styles.legendText, { color: theme.textMuted }]}>Needs water</Text></View>
            <View style={styles.legendItem}><Text style={styles.legendText}>🔥</Text><Text style={[styles.legendText, { color: theme.textMuted }]}>Streak</Text></View>
          </View>
        </View>

        <Modal visible={showPicker} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: theme.background }]}>
              <View style={styles.modalHandle} />
              <Text style={[styles.modalTitle, { color: theme.text }]}>Choose a plant 🌿</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {PLANTS.map((plant, i) => (
                  <TouchableOpacity key={i} style={[styles.pickerRow, { borderBottomColor: theme.border }]} onPress={() => selectPlantFromPicker(plant)}>
                    <Image source={plant.image} style={styles.pickerImage} />
                    <View style={styles.pickerInfo}>
                      <Text style={[styles.pickerName, { color: theme.text }]}>{plant.name}</Text>
                      <Text style={[styles.pickerDetail, { color: theme.textMuted }]}>💧 {plant.water} · ☀️ {plant.sun}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPicker(false)}>
                <Text style={[styles.cancelText, { color: theme.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={showSoilPicker} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: theme.background }]}>
              <View style={styles.modalHandle} />
              <Text style={[styles.modalTitle, { color: theme.text }]}>Select soil type 🪱</Text>
              {pendingPlant && (
                <Text style={[styles.soilHint, { color: theme.textMuted }]}>Recommended for {pendingPlant.name}: <Text style={{ fontWeight: '700' }}>{pendingPlant.soil}</Text></Text>
              )}
              <ScrollView showsVerticalScrollIndicator={false}>
                {SOIL_TYPES.map((soil, i) => {
                  const warning = pendingPlant ? getSoilWarning(pendingPlant, soil) : { level: 'ok', message: '' };
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.soilRow, { backgroundColor: theme.cardBg }, selectedSoil === soil && styles.soilRowSelected]}
                      onPress={() => setSelectedSoil(soil)}
                    >
                      <Text style={[styles.soilName, { color: theme.text }]}>{soil}</Text>
                      {warning.level === 'danger' && <Text style={styles.soilDanger}>🚨 Bad match</Text>}
                      {warning.level === 'warn' && <Text style={styles.soilWarn}>⚠️ Not ideal</Text>}
                      {warning.level === 'ok' && <Text style={styles.soilOk}>✓ Recommended</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: theme.tint }]} onPress={confirmPlacement}>
                <Text style={styles.confirmText}>Place in garden ↗</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowSoilPicker(false)}>
                <Text style={[styles.cancelText, { color: theme.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={!!selectedPlant && !showHealthLog} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.detailSheet, { backgroundColor: theme.background }]}>
              {selectedPlant && (() => {
                const daysLeft = getDaysUntilWater(selectedPlant.plant, selectedPlant.lastWatered);
                const soilWarning = getSoilWarning(selectedPlant.plant, selectedPlant.soil);
                const health = getHealthScore(selectedPlant);
                const { label: healthLabel, color: healthColor } = getHealthLabel(health);
                return (
                  <>
                    <Image source={selectedPlant.plant.image} style={styles.detailImage} />
                    <ScrollView style={styles.detailBody}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={[styles.detailName, { color: theme.text }]}>{selectedPlant.plant.name}</Text>
                        {selectedPlant.streak >= 1 && (
                          <View style={styles.streakBadge}>
                            <Text style={styles.streakText}>🔥 {selectedPlant.streak} streak</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.detailSub, { color: theme.textMuted }]}>Soil: {selectedPlant.soil}</Text>
                      <View style={[styles.healthCard, { backgroundColor: theme.cardBg }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                          <Text style={[styles.healthLabel, { color: theme.text }]}>Health Score</Text>
                          <Text style={[styles.healthScore, { color: healthColor }]}>{healthLabel}</Text>
                        </View>
                        <View style={styles.healthBarTrack}>
                          <View style={[styles.healthBarFill, { width: `${health}%` as any, backgroundColor: healthColor }]} />
                        </View>
                        <Text style={[styles.healthPct, { color: theme.textMuted }]}>{health}% consistency</Text>
                      </View>
                      {soilWarning.level !== 'ok' && (
                        <View style={[styles.warnBox, { backgroundColor: soilWarning.level === 'danger' ? '#FFE5E5' : '#FAEEDA' }]}>
                          <Text style={{ color: soilWarning.level === 'danger' ? '#B00020' : '#854F0B', fontSize: 12 }}>{soilWarning.message}</Text>
                        </View>
                      )}
                      <View style={styles.waterStatus}>
                        <Text style={styles.waterStatusText}>
                          {daysLeft <= 0 ? '💧 Needs water now!' : `💧 Water in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
                        </Text>
                      </View>
                      <View style={styles.detailStats}>
                        <Text style={[styles.statItem, { backgroundColor: theme.cardBg, color: theme.text }]}>☀️ {selectedPlant.plant.sun}</Text>
                        <Text style={[styles.statItem, { backgroundColor: theme.cardBg, color: theme.text }]}>🌡️ {selectedPlant.plant.temp}</Text>
                        <Text style={[styles.statItem, { backgroundColor: theme.cardBg, color: theme.text }]}>⚡ {selectedPlant.plant.growth}</Text>
                        <Text style={[styles.statItem, { backgroundColor: theme.cardBg, color: theme.text }]}>☠️ {selectedPlant.plant.toxicity}</Text>
                      </View>
                      <TouchableOpacity style={[styles.logBtn, { borderColor: theme.tint }]} onPress={() => setShowHealthLog(true)}>
                        <Text style={[styles.logBtnText, { color: theme.tint }]}>📋 View Watering History ({selectedPlant.wateringHistory.length})</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.wateredBtn, { backgroundColor: theme.tint }]} onPress={() => markWatered(selectedPlant)}>
                        <Text style={styles.wateredBtnText}>💧 I watered this plant</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.removeBtn} onPress={() => removePlant(selectedPlant)}>
                        <Text style={styles.removeBtnText}>🗑 Remove from garden</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelectedPlant(null)}>
                        <Text style={[styles.cancelText, { color: theme.textMuted }]}>Close</Text>
                      </TouchableOpacity>
                    </ScrollView>
                  </>
                );
              })()}
            </View>
          </View>
        </Modal>

        <Modal visible={showHealthLog} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: theme.background }]}>
              <View style={styles.modalHandle} />
              <Text style={[styles.modalTitle, { color: theme.text }]}>💧 Watering History</Text>
              {selectedPlant && (
                <>
                  <Text style={[styles.soilHint, { color: theme.textMuted }]}>{selectedPlant.plant.name} · Last {selectedPlant.wateringHistory.length} waterings</Text>
                  <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 340 }}>
                    {[...selectedPlant.wateringHistory].reverse().map((date, i) => (
                      <View key={i} style={[styles.historyRow, { borderBottomColor: theme.border }]}>
                        <View style={[styles.historyDot, { backgroundColor: i === 0 ? theme.tint : theme.cardBg }]} />
                        <View style={styles.historyInfo}>
                          <Text style={[styles.historyDate, { color: theme.text }]}>{formatDate(date)}</Text>
                          <Text style={[styles.historyLabel, { color: theme.textMuted }]}>{i === 0 ? 'Most recent' : `${i} watering${i > 1 ? 's' : ''} ago`}</Text>
                        </View>
                        <Text style={styles.historyEmoji}>💧</Text>
                      </View>
                    ))}
                  </ScrollView>
                </>
              )}
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowHealthLog(false)}>
                <Text style={[styles.cancelText, { color: theme.textMuted }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 28, fontWeight: '700' },
  resetBtn: { fontSize: 13, fontWeight: '600' },
  modeRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, gap: 8 },
  modeBtn: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  modeBtnText: { fontSize: 13, fontWeight: '600' },
  hint: { fontSize: 12, textAlign: 'center', marginBottom: 6 },
  strip: { marginHorizontal: 16, marginBottom: 6, borderRadius: 10, padding: 10 },
  stripText: { fontSize: 12, fontWeight: '500' },
  plotCanvas: { flex: 1, margin: 16, borderRadius: 16, borderWidth: 0.5, overflow: 'hidden', position: 'relative' },
  plotHint: { position: 'absolute', bottom: 16, left: 0, right: 0, textAlign: 'center', fontSize: 12, color: '#3B6D11', opacity: 0.7 },
  plantDot: { position: 'absolute', width: PLANT_DOT_SIZE, height: PLANT_DOT_SIZE, borderRadius: PLANT_DOT_SIZE / 2, backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1.5, borderColor: '#1D9E75', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  plantDotThirsty: { borderColor: '#185FA5', borderWidth: 2 },
  plantDotImage: { width: PLANT_DOT_SIZE - 4, height: PLANT_DOT_SIZE - 4, borderRadius: (PLANT_DOT_SIZE - 4) / 2 },
  waterBadge: { position: 'absolute', top: -3, right: -3, backgroundColor: '#185FA5', borderRadius: 8, width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  waterBadgeText: { fontSize: 7 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12, justifyContent: 'space-between' },
  undoBtn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  undoBtnText: { fontSize: 13, fontWeight: '600' },
  legend: { flexDirection: 'row', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalHandle: { width: 40, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  soilHint: { fontSize: 13, marginBottom: 12 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5 },
  pickerImage: { width: 44, height: 44, borderRadius: 8, marginRight: 12 },
  pickerInfo: { flex: 1 },
  pickerName: { fontSize: 15, fontWeight: '600' },
  pickerDetail: { fontSize: 12, marginTop: 2 },
  soilRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, marginBottom: 6 },
  soilRowSelected: { backgroundColor: '#E1F5EE', borderWidth: 1.5, borderColor: '#1D9E75' },
  soilName: { fontSize: 15, fontWeight: '500' },
  soilOk: { fontSize: 11, color: '#0F6E56', fontWeight: '600' },
  soilWarn: { fontSize: 11, color: '#854F0B', fontWeight: '600' },
  soilDanger: { fontSize: 11, color: '#B00020', fontWeight: '600' },
  confirmBtn: { borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
  confirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn: { padding: 14, alignItems: 'center', marginTop: 4 },
  cancelText: { fontSize: 14 },
  detailSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%', overflow: 'hidden' },
  detailImage: { width: '100%', height: 160 },
  detailBody: { padding: 16 },
  detailName: { fontSize: 22, fontWeight: '700' },
  detailSub: { fontSize: 13, marginBottom: 8 },
  streakBadge: { backgroundColor: '#fff3e0', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  streakText: { fontSize: 12, fontWeight: '700', color: '#e65100' },
  healthCard: { borderRadius: 12, padding: 12, marginBottom: 10 },
  healthLabel: { fontSize: 13, fontWeight: '600' },
  healthScore: { fontSize: 13, fontWeight: '700' },
  healthBarTrack: { height: 8, backgroundColor: '#e0e0e0', borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  healthBarFill: { height: 8, borderRadius: 4 },
  healthPct: { fontSize: 11 },
  warnBox: { borderRadius: 8, padding: 10, marginBottom: 10 },
  waterStatus: { backgroundColor: '#E6F1FB', borderRadius: 10, padding: 10, marginBottom: 10 },
  waterStatusText: { color: '#185FA5', fontWeight: '600', fontSize: 13 },
  detailStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  statItem: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12 },
  logBtn: { borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 8, borderWidth: 1.5 },
  logBtnText: { fontSize: 13, fontWeight: '600' },
  wateredBtn: { borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 8 },
  wateredBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  removeBtn: { backgroundColor: '#FFE5E5', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 4 },
  removeBtnText: { color: '#B00020', fontWeight: '600', fontSize: 14 },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5 },
  historyDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  historyInfo: { flex: 1 },
  historyDate: { fontSize: 14, fontWeight: '600' },
  historyLabel: { fontSize: 11, marginTop: 2 },
  historyEmoji: { fontSize: 16 },
});