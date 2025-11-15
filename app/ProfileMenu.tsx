import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import React, { useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { db, storage } from "../firebaseConfig";
import DepositWithdrawScreen from "./DepositWithdraw";
import { ProfileContext } from "./ProfileContext";



export default function ProfileMenu() {
  const auth = getAuth();
  const user = auth.currentUser;

  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showDepositWithdraw, setShowDepositWithdraw] = useState(false);
const { profileImage, setProfileImage } = useContext(ProfileContext);

const [supportName, setSupportName] = useState("");
const [supportEmail, setSupportEmail] = useState("");
const [supportMessage, setSupportMessage] = useState("");
const router = useRouter();


  // Profile data
  const [profile, setProfile] = useState<any>({
    displayName: "",
    username: "",
    email: "",
    phone: "",
    country: "",
    dateOfBirth: "",
    loginCode: "",
    avatarUrl: "",
  });

const [message, setMessage] = useState<string>("");
const [sendingMessage, setSendingMessage] = useState<boolean>(false);

const currentUser = getAuth().currentUser;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load user profile from Firestore
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      try {
        const docRef = doc(db, "users", user.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setProfile((prev: any) => ({ ...prev, ...snap.data() }));
           if (data.avatarUrl) setProfileImage(data.avatarUrl); // ✅ Add this line
        } else {
          await setDoc(docRef, {
            userId: user.uid,
            email: user.email || "",
            createdAt: serverTimestamp(),
          });
          setProfile((prev: any) => ({
            ...prev,
            email: user.email || "",
          }));
        }
      } catch (err) {
        console.error("Error loading profile:", err);
        Alert.alert("Error", "Unable to load profile.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user, setProfileImage]);

  // Pick image and upload to Firebase Storage
  const pickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled) return;
      const uri = result.assets[0].uri;
      setProfile((p: any) => ({ ...p, avatarUrl: uri }));
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Could not open gallery.");
    }
  };

  // Upload image to Firebase Storage
  const uploadAvatarAsync = async (localUri: string, userId: string) => {
    const response = await fetch(localUri);
    const blob = await response.blob();
    const fileRef = ref(storage, `avatars/${userId}_${Date.now()}.jpg`);
    await uploadBytes(fileRef, blob);
    return await getDownloadURL(fileRef);
  };

  // Save profile to Firestore
  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      let avatarUrl = profile.avatarUrl;

      // Upload new avatar if local
      if (avatarUrl && avatarUrl.startsWith("file://")) {
        avatarUrl = await uploadAvatarAsync(avatarUrl, user.uid);
      }
setProfileImage(avatarUrl); // <--- Add this line

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        displayName: profile.displayName || "",
        username: profile.username || "",
        email: profile.email || user.email || "",
        phone: profile.phone || "",
        country: profile.country || "",
        dateOfBirth: profile.dateOfBirth || "",
        loginCode: profile.loginCode || "",
        avatarUrl: avatarUrl || "",
        updatedAt: serverTimestamp(),
      });
      
setProfileImage(avatarUrl); // ✅ Sync global avatar context


      setProfile((p: any) => ({ ...p, avatarUrl }));
      Alert.alert("Success", "Profile updated successfully!");
    } catch (err) {
      console.error("Save error:", err);
      Alert.alert("Error", "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };
  // Add below your existing hooks, before return()
const handleLogout = async () => {
  try {
    const auth = getAuth();
    await auth.signOut();

    Alert.alert("Logged Out", "You have been signed out successfully.");

    // Redirect to Welcome screen
    router.replace("./Welcome"); // or "/Login" depending on your file name
  } catch (err) {
    console.error("Logout error:", err);
    Alert.alert("Error", "Failed to log out.");
  }
};


// handleSupportSend
const handleSupportSend = async () => {
  if (!supportName || !supportEmail || !supportMessage) {
    Alert.alert("Incomplete", "Please fill in all fields before sending.");
    return;
  }

  try {
    await addDoc(collection(db, "supportMessages"), {
      name: supportName,
      email: supportEmail,
      message: supportMessage,
      timestamp: serverTimestamp(),
    });

    Alert.alert("Sent!", "Your message has been delivered successfully.");
    setSupportName("");
    setSupportEmail("");
    setSupportMessage("");
  } catch (error) {
    console.error("Error sending message:", error);
    Alert.alert("Error", "Failed to send message. Please try again.");
  }
};


  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#21e6c1" />
      </View>
    );

  return (
    <View style={styles.modalContainer}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerText}>User Menu</Text>
        </View>

        {/* Menu Options */}
        {!activeSection && (
          <View style={styles.menuList}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setActiveSection("profile")}
            >
              <Ionicons name="person-outline" size={20} color="white" />
              <Text style={styles.menuText}>Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setActiveSection("balance")}
            >
              <Ionicons name="wallet-outline" size={20} color="white" />
              <Text style={styles.menuText}>Account Balance</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setActiveSection("support")}
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={20}
                color="white"
              />
              <Text style={styles.menuText}>Support</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setActiveSection("settings")}
            >
              <Ionicons name="settings-outline" size={20} color="white" />
              <Text style={styles.menuText}>Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
      <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>

          </View>
        )}

        {/* Profile Section */}
        {activeSection === "profile" && (
          <ScrollView style={styles.section}>
            <Text style={styles.sectionTitle}>Profile</Text>

            <View style={{ alignItems: "center", marginBottom: 16 }}>
              {profile.avatarUrl ? (
                <Image
                  source={{ uri: profile.avatarUrl }}
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 50,
                    marginBottom: 8,
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 50,
                    backgroundColor: "#0f3460",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 8,
                  }}
                >
                  <Ionicons name="person" size={40} color="white" />
                </View>
              )}
              <TouchableOpacity onPress={pickAvatar}>
                <Text style={{ color: "#21e6c1" }}>Change Avatar</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#ccc"
              value={profile.displayName}
              onChangeText={(t) =>
                setProfile((p: any) => ({ ...p, displayName: t }))
              }
            />
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#ccc"
              value={profile.username}
              onChangeText={(t) =>
                setProfile((p: any) => ({ ...p, username: t }))
              }
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#ccc"
              editable={false}
              value={profile.email}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone"
              placeholderTextColor="#ccc"
              value={profile.phone}
              onChangeText={(t) =>
                setProfile((p: any) => ({ ...p, phone: t }))
              }
            />
            <TextInput
              style={styles.input}
              placeholder="Country"
              placeholderTextColor="#ccc"
              value={profile.country}
              onChangeText={(t) =>
                setProfile((p: any) => ({ ...p, country: t }))
              }
            />
            <TextInput
              style={styles.input}
              placeholder="Date of Birth (YYYY-MM-DD)"
              placeholderTextColor="#ccc"
              value={profile.dateOfBirth}
              onChangeText={(t) =>
                setProfile((p: any) => ({ ...p, dateOfBirth: t }))
              }
            />
            <TextInput
              style={styles.input}
              placeholder="Login Code"
              placeholderTextColor="#ccc"
              secureTextEntry
              value={profile.loginCode}
              onChangeText={(t) =>
                setProfile((p: any) => ({ ...p, loginCode: t }))
              }
            />

            <TouchableOpacity
              onPress={saveProfile}
              style={[styles.sendButton, { backgroundColor: "#21e6c1" }]}
            >
              {saving ? (
                <ActivityIndicator color="#16213e" />
              ) : (
                <Text style={styles.sendText}>Save Profile</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setActiveSection(null)}
            >
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Balance Section */}
        {activeSection === "balance" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Balance</Text>
            <Text style={styles.balance}>$ 0.00</Text>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setActiveSection(null)}
            >
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Support Section */}
       {activeSection === "support" && (
  <ScrollView style={styles.section}>
    <Text style={styles.sectionTitle}>Support</Text>

    <TextInput
      style={styles.input}
      placeholder="Your Name"
      placeholderTextColor="#ccc"
      value={supportName}
      onChangeText={setSupportName}
    />

    <TextInput
      style={styles.input}
      placeholder="Your Email"
      placeholderTextColor="#ccc"
      value={supportEmail}
      onChangeText={setSupportEmail}
    />

    <TextInput
      style={[styles.input, { height: 100 }]}
      placeholder="Message"
      placeholderTextColor="#ccc"
      value={supportMessage}
      onChangeText={setSupportMessage}
      multiline
    />

    <TouchableOpacity style={styles.sendButton} onPress={handleSupportSend}>
      <Text style={styles.sendText}>Send</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.backButton}
      onPress={() => setActiveSection(null)}
    >
      <Text style={styles.backText}>Back</Text>
    </TouchableOpacity>
  </ScrollView>
)}

        {/* Settings Section */}
        {activeSection === "settings" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Settings</Text>
            <View style={styles.settingRow}>
              <Text style={styles.settingText}>Dark Mode</Text>
              <Switch value={darkMode} onValueChange={setDarkMode} />
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingText}>Sound Effects</Text>
              <Switch value={soundEnabled} onValueChange={setSoundEnabled} />
            </View>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setActiveSection(null)}
            >
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Deposit / Withdraw modal */}
      <Modal
        visible={showDepositWithdraw}
        animationType="slide"
        transparent={false}
      >
        <View style={{ flex: 1, backgroundColor: "#16213e" }}>
          <TouchableOpacity
            style={{ alignSelf: "flex-end", padding: 15 }}
            onPress={() => setShowDepositWithdraw(false)}
          >
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>
          <DepositWithdrawScreen />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "#16213e",
    padding: 20,
  },
  header: {
    marginBottom: 15,
  },
  headerText: { fontSize: 22, fontWeight: "bold", color: "white" },
  menuList: { marginTop: 10 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#0f3460",
    marginBottom: 8,
    borderRadius: 10,
  },
  menuText: { marginLeft: 10, color: "white", fontSize: 16 },
  logoutButton: {
    marginTop: 20,
    backgroundColor: "crimson",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  logoutText: { color: "white", fontWeight: "bold" },
  section: { flex: 1, padding: 15 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#e94560",
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    color: "white",
    backgroundColor: "#0f3460",
  },
  balance: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#21e6c1",
    marginVertical: 20,
  },
  sendButton: {
    backgroundColor: "#21e6c1",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 15,
  },
  sendText: { color: "#16213e", fontWeight: "bold" },
  backButton: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#e94560",
    alignItems: "center",
  },
  backText: { color: "white", fontWeight: "bold" },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 10,
  },
  settingText: { color: "white", fontSize: 16 },
});
