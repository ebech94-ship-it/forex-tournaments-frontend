// TradeSummaryBar.tsx
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { auth, db } from "../firebaseConfig";

const { height } = Dimensions.get("window");
const COLLAPSED_HEIGHT = 50;
const EXPANDED_HEIGHT = height * 0.5;

interface TradeSummaryBarProps {
  openTrades?: any[];
  closedTrades?: any[];
}

export default function TradeSummaryBar({
  openTrades: parentOpenTrades = [],
  closedTrades: parentClosedTrades = [],
}: TradeSummaryBarProps) {
  const translateY = useRef(new Animated.Value(EXPANDED_HEIGHT - COLLAPSED_HEIGHT)).current;
  const [openTrades, setOpenTrades] = useState<any[]>(parentOpenTrades);
  const [closedTrades, setClosedTrades] = useState<any[]>(parentClosedTrades);
  const user = auth.currentUser;

  // 🔥 Realtime Firestore listener
  useEffect(() => {
    if (parentOpenTrades.length > 0 || parentClosedTrades.length > 0) return;

    if (!user) {
      console.log("⚠️ No logged-in user. Using dummy trades.");
      setOpenTrades([
        { type: "buy", amount: 100, entryPrice: 2375.5, expireTime: null },
        { type: "sell", amount: 50, entryPrice: 2381.2, expireTime: null },
      ]);
      setClosedTrades([
        {
          type: "buy",
          amount: 100,
          entryPrice: 2350.0,
          closePrice: 2380.4,
          result: "GAIN",
          payout: 30,
        },
      ]);
      return;
    }

    const tradesRef = collection(db, "userTrades");
    const q = query(tradesRef, where("userId", "==", user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const open: any[] = [];
        const closed: any[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.status === "open") open.push(data);
          else closed.push(data);
        });

        setOpenTrades(open);
        setClosedTrades(closed);
      },
      (error) => {
        console.error("❌ Realtime listener error:", error);
      }
    );

    return () => unsubscribe();
  }, [user, parentOpenTrades, parentClosedTrades]);

  // 🎯 Swipe logic (same as before)
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 10,
      onPanResponderMove: (_, gestureState) => {
        const currentY = (translateY as any)._value ?? 0;
        const newY = Math.max(
          0,
          Math.min(EXPANDED_HEIGHT - COLLAPSED_HEIGHT, currentY + gestureState.dy)
        );
        translateY.setValue(newY);
      },
      onPanResponderRelease: (_, gestureState) => {
        const shouldExpand = gestureState.dy < 0;
        Animated.spring(translateY, {
          toValue: shouldExpand ? 0 : EXPANDED_HEIGHT - COLLAPSED_HEIGHT,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      style={[styles.panel, { height: EXPANDED_HEIGHT, transform: [{ translateY }] }]}
      {...panResponder.panHandlers}
    >
      <View style={styles.handle}>
        <View style={styles.handleLine} />
        <Text style={styles.handleText}>Portfolio / Trade Summary</Text>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Open Trades</Text>
        {openTrades.length === 0 ? (
          <Text style={{ color: "#777" }}>No open trades</Text>
        ) : (
          openTrades.map((t, i) => (
            <View key={i} style={styles.tradeRow}>
              <Text style={styles.tradeText}>
                {t.type.toUpperCase()} ${t.amount} → Entry: {t.entryPrice?.toFixed(2)} | Exp:{" "}
                {t.expireTime ? new Date(t.expireTime).toLocaleTimeString() : "-"}
              </Text>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Closed Trades</Text>
        {closedTrades.length === 0 ? (
          <Text style={{ color: "#777" }}>No closed trades</Text>
        ) : (
          closedTrades.map((t, i) => (
            <View
              key={i}
              style={[
                styles.tradeRow,
                { backgroundColor: t.result === "GAIN" ? "#1e4620" : "#5a1d1d" },
              ]}
            >
              <Text style={styles.tradeText}>
                {t.type.toUpperCase()} ${t.amount} → {t.result} +$
                {t.payout?.toFixed(2) || 0}
              </Text>
              <Text style={{ color: "#ccc", fontSize: 12 }}>
                Open: {t.entryPrice?.toFixed(2)} | Close: {t.closePrice?.toFixed(2)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#1c1c1c",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: "hidden",
  },
  handle: {
    height: COLLAPSED_HEIGHT,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  handleLine: {
    width: 40,
    height: 2,
    borderRadius: 2,
    backgroundColor: "#888",
    marginBottom: 3,
  },
  handleText: {
    color: "white",
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: 10,
  },
  sectionTitle: {
    color: "#ccc",
    fontSize: 14,
    marginVertical: 6,
  },
  tradeRow: {
    marginVertical: 6,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#2a2a2a",
  },
  tradeText: {
    color: "white",
    fontSize: 13,
  },
});
