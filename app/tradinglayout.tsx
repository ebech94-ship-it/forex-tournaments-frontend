import { router } from "expo-router";
import { Button, Text, View } from "react-native";

export default function TradingLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: "#000C26", justifyContent: "center", alignItems: "center" }}>
      <Text style={{ fontSize: 32, color: "white", marginBottom: 20 }}>
        FX ARENA MARKET
      </Text>

      <Text style={{ fontSize: 18, color: "#E2C13E", marginBottom: 40 }}>
        This is the Trading Dashboard
      </Text>

      <Button
        title="Logout"
        color="red"
        onPress={() => {
          // simple demo logout
          router.replace("/welcome");
        }}
      />
    </View>
  );
}
