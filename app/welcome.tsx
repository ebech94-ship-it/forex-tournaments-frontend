import { AntDesign } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Google from "expo-auth-session/providers/google";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  ImageBackground,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import Constants from "expo-constants";
import CountryPhoneInput from "../components/CountryPhoneInput"; // ⬅️ simple working picker
import { auth, db } from "../firebaseConfig";

WebBrowser.maybeCompleteAuthSession();

export default function Welcome() {
  const router = useRouter();

  const slideAnim = useState(new Animated.Value(400))[0];
  const fadeAnim = useState(new Animated.Value(0))[0];

  // 👤 form states
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(""); // <-- fixed duplicate
  const [phonePassword, setPhonePassword] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // 🔐 Google login
  // 🔐 Google login (clean, correct, single setup)
const webClientId = Constants.expoConfig?.extra?.webClientId;

const [request, response, promptAsync] = Google.useAuthRequest({
  clientId: webClientId,    // main one
  webClientId: webClientId, // required for web
});

  const [showSignupEmail, setShowSignupEmail] = useState(false);
  const [showSignupPhone, setShowSignupPhone] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const [loading, setLoading] = useState(false);

  // 📘 Create Firestore profile
  const createUserAccounts = async (uid: string, name: string, email: string) => {
    const userRef = doc(db, "users", uid);
    const docSnap = await getDoc(userRef);
    if (!docSnap.exists()) {
      await setDoc(userRef, {
        name,
        email,
        createdAt: new Date().toISOString(),
        accounts: {
          demo: { balance: 1000, type: "practice" },
          real: { balance: 0, type: "real" },
          tournament: { balance: 0, type: "tournament" },
        },
      });
    }
  };

  // 🔁 Auto login if already authenticated
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await AsyncStorage.setItem("isLoggedIn", "true");
        router.replace("./Tradinglayout");
      }
    });
    return unsub;
  }, []);

  // 🎯 Google login handler
  useEffect(() => {
    const run = async () => {
      if (response?.type === "success") {
        try {
          setLoading(true);
          const credential = GoogleAuthProvider.credential(response.params.id_token);
          const userCred = await signInWithCredential(auth, credential);
          await createUserAccounts(
            userCred.user.uid,
            userCred.user.displayName || "Google User",
            userCred.user.email || ""
          );
          await AsyncStorage.setItem("isLoggedIn", "true");
          router.replace("./Tradinglayout");
        } catch (e) {
          alert((e as Error).message);
        } finally {
          setLoading(false);
        }
      }
    };
    run();
  }, [response]);

  // Animations
  const openForm = (setter: any) => {
    setShowSignupEmail(false);
    setShowSignupPhone(false);
    setShowLogin(false);
    setter(true);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const closeForm = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 400, duration: 400, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      setShowSignupEmail(false);
      setShowSignupPhone(false);
      setShowLogin(false);
    });
  };

  // 📧 Email Signup
  const handleSignupEmail = async () => {
    try {
      if (password !== confirmPassword) return alert("Passwords do not match");

      setLoading(true);
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      await createUserAccounts(userCred.user.uid, name, email);
      await AsyncStorage.setItem("isLoggedIn", "true");
      router.replace("./Tradinglayout");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 🔑 Email Login
  const handleLogin = async () => {
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
      await AsyncStorage.setItem("isLoggedIn", "true");
      router.replace("./Tradinglayout");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 📱 Phone Signup
  const handleSignupPhone = async () => {
    if (phone.length < 8) return alert("Enter valid phone number");

    const fullNumber = "+237" + phone;

    try {
      setLoading(true);
      const uid = fullNumber;
      await createUserAccounts(uid, name, `${uid}@phoneuser.fx`);
      await AsyncStorage.setItem("isLoggedIn", "true");
      router.replace("./Tradinglayout");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
      <ImageBackground
        source={require("../assets/images/background.png")}
        style={styles.bg}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          <Text style={styles.title}>Welcome to Forex Tournaments Arena</Text>
          <Text style={styles.desc}>
            Join live Forex competitions and win real prizes!
          </Text>

          {/* MAIN BUTTONS */}
          {!showSignupEmail && !showSignupPhone && !showLogin && (
            <>
              <TouchableOpacity
                style={styles.button}
                onPress={() => openForm(setShowSignupEmail)}
              >
                <Text style={styles.buttonText}>📧 Sign Up with Email</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.button}
                onPress={() => openForm(setShowSignupPhone)}
              >
                <Text style={styles.buttonText}>📱 Sign Up with Phone</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: "#DB4437" }]}
                onPress={() => promptAsync()}
              >
                <AntDesign name="google" size={16} color="white" />
                <Text style={[styles.buttonText, { marginLeft: 8 }]}>
                  Continue with Google
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.button}
                onPress={() => openForm(setShowLogin)}
              >
                <Text style={styles.buttonText}>Log In</Text>
              </TouchableOpacity>
            </>
          )}

          {/* POPUP FORMS */}
          {(showSignupEmail || showSignupPhone || showLogin) && (
            <Animated.View
              style={[styles.popup, { transform: [{ translateX: slideAnim }], opacity: fadeAnim }]}
            >
              {/* EMAIL SIGNUP */}
              {showSignupEmail && (
                <>
                  <Text style={styles.subtitle}>Sign Up with Email</Text>

                  <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    placeholderTextColor="#aaa"
                    value={name}
                    onChangeText={setName}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="#aaa"
                    value={email}
                    onChangeText={setEmail}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#aaa"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm Password"
                    placeholderTextColor="#aaa"
                    secureTextEntry={!showPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />

                  <TouchableOpacity style={styles.button} onPress={handleSignupEmail}>
                    <Text style={styles.buttonText}>Submit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.link} onPress={closeForm}>
                    <Text style={styles.linkText}>Back</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* PHONE SIGNUP */}
              {showSignupPhone && (
                <>
                  <Text style={styles.subtitle}>Sign Up with Phone</Text>

                  <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    placeholderTextColor="#aaa"
                    value={name}
                    onChangeText={setName}
                  />

                  <CountryPhoneInput
                    countryCode="+237"
                    phone={phone}
                    onChangePhone={setPhone}
                  />

                  <TextInput
                    style={styles.input}
                    placeholder="Enter 5-digit Password"
                    placeholderTextColor="#aaa"
                    secureTextEntry={!showPassword}
                    value={phonePassword}
                    onChangeText={setPhonePassword}
                  />

                  <TouchableOpacity style={styles.button} onPress={handleSignupPhone}>
                    <Text style={styles.buttonText}>Submit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.link} onPress={closeForm}>
                    <Text style={styles.linkText}>Back</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* LOGIN */}
              {showLogin && (
                <>
                  <Text style={styles.subtitle}>Log In</Text>

                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="#aaa"
                    value={email}
                    onChangeText={setEmail}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#aaa"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />

                  <TouchableOpacity style={styles.button} onPress={handleLogin}>
                    <Text style={styles.buttonText}>Submit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.link} onPress={closeForm}>
                    <Text style={styles.linkText}>Back</Text>
                  </TouchableOpacity>
                </>
              )}
            </Animated.View>
          )}

          {/* 🔄 loading overlay */}
          {loading && (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
        </View>
      </ImageBackground>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, width: "100%", height: "100%" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginTop: 60,
    marginBottom: 15,
  },
  desc: {
    color: "white",
    textAlign: "center",
    width: "85%",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#5A4BE7",
    padding: 12,
    borderRadius: 10,
    marginVertical: 8,
    width: "90%",
    flexDirection: "row",
    justifyContent: "center",
  },
  buttonText: { color: "white", fontWeight: "bold" },
  popup: {
    position: "absolute",
    top: "22%",
    width: "85%",
    backgroundColor: "rgba(20,20,20,0.95)",
    padding: 20,
    borderRadius: 18,
  },
  subtitle: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
    marginBottom: 10,
    fontSize: 18,
  },
  input: {
    backgroundColor: "#1e1e1e",
    color: "white",
    padding: 12,
    borderRadius: 8,
    borderColor: "#5A4BE7",
    borderWidth: 1,
    marginVertical: 6,
  },
  link: { marginTop: 10, alignItems: "center" },
  linkText: { color: "#5A4BE7" },
  loading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
});
