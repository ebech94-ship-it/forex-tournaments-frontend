import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function TradeHistoryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>📊 Trade History Section</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
});
