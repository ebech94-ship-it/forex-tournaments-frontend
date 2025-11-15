import { collection, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../firebaseConfig";

export default function AlertScreen() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "alerts"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setAlerts(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleMarkAsRead = async (alertId: string) => {
    try {
      const alertRef = doc(db, "alerts", alertId);
      await updateDoc(alertRef, { read: true });
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, read: true } : a))
      );
    } catch (e) {
      console.error("Error marking alert as read:", e);
    }
  };

  if (loading) return <ActivityIndicator size="large" color="#7cf" />;

  return (
    <View style={styles.container}>
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AlertCard item={item} onRead={handleMarkAsRead} />}
      />
    </View>
  );
}

const AlertCard = ({ item, onRead }: any) => {
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!item.read) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 1,
            duration: 1000,
            easing: Easing.ease,
            useNativeDriver: false,
          }),
          Animated.timing(glow, {
            toValue: 0,
            duration: 1000,
            easing: Easing.ease,
            useNativeDriver: false,
          }),
        ])
      ).start();
    }
  }, [item.read, glow]);

  const glowColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: ["#333", "#7cf"],
  });

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => !item.read && onRead(item.id)}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{item.title}</Text>
        {!item.read && <Animated.View style={[styles.dot, { backgroundColor: glowColor }]} />}
      </View>
      <Text style={styles.msg}>{item.message}</Text>
      <Text style={styles.date}>
        {item.createdAt?.toDate?.().toLocaleString?.() || "—"}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111", padding: 10 },
  card: {
    backgroundColor: "#1c1c1c",
    padding: 12,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#333",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { color: "#7cf", fontSize: 18, fontWeight: "bold" },
  msg: { color: "#fff", marginTop: 5, fontSize: 15 },
  date: { color: "#aaa", marginTop: 5, fontSize: 12 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    shadowColor: "#7cf",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
});
