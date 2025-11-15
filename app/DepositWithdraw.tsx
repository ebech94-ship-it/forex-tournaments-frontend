import { Picker } from "@react-native-picker/picker";
import { LinearGradient } from "expo-linear-gradient";
import { addDoc, collection, doc, getDoc, updateDoc } from "firebase/firestore";
import { FlutterwaveInit } from "flutterwave-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../firebaseConfig";

// ✅ Flutterwave public key
const FLW_PUBLIC_KEY = process.env.EXPO_PUBLIC_FLUTTERWAVE_PUBLIC_KEY!;

// 🔹 Conversion API (dummy)
const fakeConversionRateAPI = async (currency: string) => {
  const rates: Record<string, number> = {
    USD: 1,
    XAF: 595,
    EUR: 0.92,
    NGN: 775,
    BTC: 0.000038,
    USDT: 1,
  };
  return rates[currency] || 1;
};

// 🔹 Payment method icons
const paymentMethods = [
  { name: "MTN", color: "#FFCD00", icon: require("../assets/images/mtn.png") },
  { name: "Orange", color: "#FF7900", icon: require("../assets/images/orange.png") },
  { name: "Visa", color: "#1A1F71", icon: require("../assets/images/visa.png") },
  { name: "MasterCard", color: "#EB001B", icon: require("../assets/images/mastercard.png") },
  { name: "BTC", color: "#F7931A", icon: require("../assets/images/btc.png") },
  { name: "USDT", color: "#26A17B", icon: require("../assets/images/usdt.png") },
];

export default function PaymentsPage() {
  const [isDeposit, setIsDeposit] = useState(true);
  const [amount, setAmount] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [convertedAmount, setConvertedAmount] = useState("0");
  const [activeMethod, setActiveMethod] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const [platformFee, setPlatformFee] = useState(0);
  const [netAmount, setNetAmount] = useState(0);

  // 🔹 Convert currency automatically
  useEffect(() => {
    let mounted = true;
    const convert = async () => {
      const rate = await fakeConversionRateAPI(selectedCurrency);
      const amt = parseFloat(amount) || 0;
      const fee = amt * 0.04;
      const net = amt - fee;
      if (mounted) {
        setPlatformFee(fee);
        setNetAmount(net);
        setConvertedAmount((net * rate).toFixed(2));
      }
    };
    convert();
    return () => {
      mounted = false;
    };
  }, [amount, selectedCurrency]);

  // 🔹 Open form
  const openForm = async (method: string) => {
    setActiveMethod(method);
    setModalVisible(true);
  };

  // ✅ Deposit handler
  const handleFlutterwavePayment = async () => {
    if (!amount || isNaN(Number(amount))) {
      alert("Please enter a valid amount");
      return;
    }

    setLoading(true);
    const fee = Number(amount) * 0.04;
    const net = Number(amount) - fee;

    alert(
      `Amount entered: ${Number(amount).toFixed(2)} ${selectedCurrency}\n` +
        `Platform fee (4%): ${fee.toFixed(2)} ${selectedCurrency}\n` +
        `Net amount to be deposited: ${net.toFixed(2)} ${selectedCurrency}\n` +
        `Equivalent in FCFA: ≈ ${(net * 595).toFixed(0)} XAF`
    );

    try {
      const paymentConfig = {
        tx_ref: `tx-${Date.now()}`,
        amount: net,
        currency: selectedCurrency as any,
        payment_options: "card, mobilemoney, ussd",
        customer: {
          email: auth.currentUser?.email || "user@example.com",
          name: auth.currentUser?.displayName || "User",
        },
        customizations: {
          title: "Forex Tournaments Deposit",
          description: "Deposit into your trading wallet",
          logo: "https://your-logo-url.com/logo.png",
        },
        redirect_url: "N/A", // 👈 required field but unused
      };

      const response: any = await FlutterwaveInit({
        authorization: FLW_PUBLIC_KEY,
        ...paymentConfig,
      });

      if (response?.status === "successful") {
        alert("Deposit successful!");
        if (auth.currentUser) {
          const uid = auth.currentUser.uid;
          const userRef = doc(db, "users", uid);
          const userSnap = await getDoc(userRef);
          const oldBalance = userSnap.exists()
            ? userSnap.data().walletBalance || 0
            : 0;
          await updateDoc(userRef, { walletBalance: oldBalance + net });
        }
      } else {
        alert("Payment cancelled or failed.");
      }
    } catch (error) {
      console.error("Flutterwave error:", error);
      alert("Payment failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // 💸 Withdrawal handler
  const handleWithdrawal = async () => {
    if (!amount || isNaN(Number(amount))) {
      alert("Enter a valid amount to withdraw");
      return;
    }

    setLoading(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        alert("Please log in to withdraw.");
        return;
      }

      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        alert("User not found");
        return;
      }

      const walletBalance = userSnap.data().walletBalance || 0;
      const numericAmount = Number(amount);
      const fee = numericAmount * 0.04;
      const net = numericAmount - fee;

      if (numericAmount > walletBalance) {
        alert("Insufficient balance.");
        return;
      }

      await updateDoc(userRef, { walletBalance: walletBalance - numericAmount });
      await addDoc(collection(db, "withdrawals"), {
        userId: uid,
        amount: numericAmount,
        fee,
        netAmount: net,
        currency: selectedCurrency,
        status: "pending",
        createdAt: new Date(),
      });

      alert(
        `Withdrawal Request Sent ✅\n\n` +
          `Amount entered: ${numericAmount.toFixed(2)} ${selectedCurrency}\n` +
          `Platform fee (4%): ${fee.toFixed(2)} ${selectedCurrency}\n` +
          `Net amount to be received: ${net.toFixed(2)} ${selectedCurrency}\n\n` +
          `Your request is under processing.`
      );
    } catch (error) {
      console.error("Withdrawal error:", error);
      alert("Withdrawal failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <LinearGradient colors={["#6a5acd", "#00ffff"]} style={styles.headerContainer}>
        <Text style={styles.headerText}>{isDeposit ? "Deposit" : "Withdraw"}</Text>
      </LinearGradient>

      {/* Toggle */}
      <View style={styles.switchContainer}>
        <Text style={{ color: "#fff" }}>Deposit</Text>
        <Switch
          value={isDeposit}
          onValueChange={() => setIsDeposit(!isDeposit)}
          trackColor={{ false: "#FF6B6B", true: "#4ACFAC" }}
          thumbColor={"#fff"}
        />
        <Text style={{ color: "#fff" }}>Withdraw</Text>
      </View>

      {/* Amount Input */}
      <Text style={styles.inputLabel}>Enter Amount</Text>
      <TextInput
        style={styles.input}
        placeholder="0.00"
        placeholderTextColor="#aaa"
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
      />

      {/* Currency Picker */}
      <Text style={styles.inputLabel}>Select Currency</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={selectedCurrency}
          onValueChange={(itemValue) => setSelectedCurrency(itemValue)}
          style={styles.picker}
        >
          <Picker.Item label="USD" value="USD" />
          <Picker.Item label="XAF" value="XAF" />
          <Picker.Item label="EUR" value="EUR" />
          <Picker.Item label="NGN" value="NGN" />
          <Picker.Item label="BTC" value="BTC" />
          <Picker.Item label="USDT" value="USDT" />
        </Picker>
      </View>

      {/* 💰 Transparency breakdown */}
      {amount ? (
        <View style={styles.breakdownBox}>
          <Text style={styles.breakText}>
            Amount entered: {Number(amount).toFixed(2)} {selectedCurrency}
          </Text>
          <Text style={styles.breakText}>
            Platform fee (4%): {platformFee.toFixed(2)} {selectedCurrency}
          </Text>
          <Text style={styles.breakText}>
            Net amount to be {isDeposit ? "deposited" : "received"}:{" "}
            {netAmount.toFixed(2)} {selectedCurrency}
          </Text>
          <Text style={styles.breakText}>
            Equivalent in FCFA: ≈ {convertedAmount} XAF
          </Text>
        </View>
      ) : null}

      {/* Payment Methods */}
      <Text style={styles.methodHeader}>Select Payment Method</Text>
      <View style={styles.methodsContainer}>
        {paymentMethods.map((method, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.methodButton, { backgroundColor: method.color }]}
            onPress={() => openForm(method.name)}
          >
            <Image source={method.icon} style={styles.methodIcon} />
            <Text style={styles.methodText}>{method.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Confirm */}
      <TouchableOpacity
        style={styles.confirmButton}
        onPress={() => (isDeposit ? handleFlutterwavePayment() : handleWithdrawal())}
      >
        <Text style={styles.confirmButtonText}>
          {isDeposit ? "Deposit Now" : "Withdraw Now"}
        </Text>
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <ScrollView contentContainerStyle={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{activeMethod} Payment Form</Text>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.confirmButton}
            >
              <Text style={styles.confirmButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Modal>

      {/* ⏳ Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#00ffff" />
          <Text style={{ color: "#fff", marginTop: 10 }}>Processing...</Text>
        </View>
      )}
    </ScrollView>
  );
}

// 🔹 Styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1e1e2f", padding: 20 },
  headerContainer: { borderRadius: 12, padding: 15, marginBottom: 20, bottom: 9 },
  headerText: { fontSize: 28, fontWeight: "bold", color: "#fff", textAlign: "center" },
  switchContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  inputLabel: { color: "#00ffff", fontSize: 16, marginBottom: 5 },
  input: { backgroundColor: "#2e2e3e", color: "#fff", padding: 12, borderRadius: 8, marginBottom: 20 },
  pickerContainer: { backgroundColor: "#2e2e3e", borderRadius: 8, marginBottom: 20 },
  picker: { color: "#fff" },
  breakdownBox: { backgroundColor: "#2C2C44", padding: 12, borderRadius: 10, marginBottom: 20 },
  breakText: { color: "#fff", marginBottom: 4, fontSize: 15 },
  methodHeader: { color: "#fff", fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  methodsContainer: { flexDirection: "row", flexWrap: "wrap", marginBottom: 20, justifyContent: "space-between" },
  methodButton: { flexDirection: "row", alignItems: "center", borderRadius: 10, padding: 10, marginBottom: 10, minWidth: "48%" },
  methodIcon: { width: 24, height: 24, marginRight: 10 },
  methodText: { color: "#fff", fontWeight: "bold" },
  confirmButton: { backgroundColor: "#6a5acd", padding: 20, borderRadius: 12, alignItems: "center", elevation: 5 },
  confirmButtonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
  modalContainer: { width: "85%", backgroundColor: "#2C2C44", padding: 20, borderRadius: 15 },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#fff", marginBottom: 15, textAlign: "center" },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
});
