// AdminDashboard.tsx
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,

  updateDoc
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../firebaseConfig";

/**
 * ALL-IN-ONE ADMIN DASHBOARD (TSX)
 * - Real-time tournaments & users
 * - Create / Edit tournament modal (startingBalance editable)
 * - Participant panel with balances and rebuys
 * - Admin actions (credit, message, ban, payout) placeholders
 *
 * Notes:
 * - Firestore collections used: "tournaments", "users", participants are under tournaments/{id}/participants
 * - Keep UI & styles unchanged from your requested design
 */

/* -------------------------
   Types
   ------------------------- */
type Tournament = {
  id: string;
  name?: string;
  prizePool?: number;
  startingBalance?: number;
  maxRebuys?: number;
  durationMinutes?: number;
  description?: string;
  status?: "Upcoming" | "Ongoing" | "Ended" | string;
  createdAt?: any;
  updatedAt?: any;
  endedAt?: any;
};

type User = {
  id: string;
  name?: string;
  email?: string;
  displayName?: string;
};

type Participant = {
  id: string;
  userId?: string;
  displayName?: string;
  name?: string;
  email?: string;
  balance?: number;
  rebuys?: number;
  rebuyCount?: number; // alias you mentioned
  joinedAt?: any;
  rank?: number;
  // any other fields may exist
};

/* -------------------------
   Component
   ------------------------- */
const AdminDashboard: React.FC = () => {
  // Data states
  const [users, setUsers] = useState<User[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState<boolean>(false);
const [supportMessages, setSupportMessages] = useState([]);
const [replyingTo, setReplyingTo] = useState<string | null>(null);
const [replyText, setReplyText] = useState("");

  // UI states
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [fadeAnim] = useState<Animated.Value>(new Animated.Value(0) as Animated.Value);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "ongoing" | "upcoming" | "ended" | string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Tournament form fields
  const [formId, setFormId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [startingBalance, setStartingBalance] = useState("1000");
  const [prizePool, setPrizePool] = useState("500");
  const [maxRebuys, setMaxRebuys] = useState("0");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [description, setDescription] = useState("Compete now. Grow your balance; win prizes!");
  const [statusSelect, setStatusSelect] = useState<"Upcoming" | "Ongoing" | "Ended" | string>("Upcoming");

  const [globalLoading, setGlobalLoading] = useState(true);

  // participant listener unsubscribe
  const [participantUnsub, setParticipantUnsub] = useState<(() => void) | null>(null);

  /* -------------------------
     Real-time listeners
     ------------------------- */
  useEffect(() => {
    // Users realtime
    const usersRef = collection(db, "users");
    const unsubUsers = onSnapshot(usersRef, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as User[];
      setUsers(list);
    });

    // Tournaments realtime (ordered by createdAt desc)
    const tournamentsRef = query(collection(db, "tournaments"), orderBy("createdAt", "desc"));
    const unsubTournaments = onSnapshot(tournamentsRef, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Tournament[];
      setTournaments(list);
      setGlobalLoading(false);
    });

    return () => {
      unsubUsers();
      unsubTournaments();
      // cleanup participant listener if still set
      if (participantUnsub) participantUnsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------------
     Derived stats
     ------------------------- */
  const stats = useMemo(() => {
    const totalUsers = users.length;
    const activePlayers = participants.length;
    const ongoing = tournaments.filter((t) => t.status === "Ongoing").length;
    const totalPrize = tournaments.reduce((s, t) => s + (t.prizePool || 0), 0);
    return { totalUsers, activePlayers, ongoing, totalPrize };
  }, [users, tournaments, participants]);

  /* -------------------------
     Load participants for a tournament (realtime)
     - participants stored in tournaments/{id}/participants
     - enrich participant with user email/name when possible
     ------------------------- */
  const loadParticipants = async (tournamentId: string) => {
    setLoadingParticipants(true);
    setParticipants([]);
    try {
      // Use modular collection path: tournaments/{tournamentId}/participants
      const pQuery = collection(db, "tournaments", tournamentId, "participants");
      const unsub = onSnapshot(pQuery, async (snap) => {
        const pListRaw = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Participant[];

        // Enrich with user data if available. Note: participant doc id might be user's id OR a custom id.
        const enriched = await Promise.all(
          pListRaw.map(async (p) => {
            try {
              // if participant has a userId property prefer that; otherwise try participant.id as user id
              const uid = (p.userId as string) || (p.id as string);
              let userData: any = null;
              if (uid) {
                const userRef = doc(db, "users", uid);
                const uSnap = await getDoc(userRef);
                userData = uSnap.exists() ? (uSnap.data() as any) : null;
              }

              // choose display name preference: participant.displayName -> participant.name -> userData.name -> "Unknown"
              const resolvedName = p.displayName ?? p.name ?? userData?.displayName ?? userData?.name ?? "Unknown";

              // normalize rebuy count field naming (some docs may have rebuys or rebuyCount)
              const rebuyCount = (p.rebuys ?? (p.rebuyCount as any) ?? 0) as number;

              return {
                ...p,
                email: p.email ?? userData?.email ?? null,
                name: resolvedName,
                rebuyCount,
                rebuys: rebuyCount,
                balance: typeof p.balance === "number" ? p.balance : Number(p.balance ?? 0),
              } as Participant;
            } catch (err) {
              // if enrichment fails just return original participant object
              return {
                ...p,
                name: p.displayName ?? p.name ?? "Unknown",
                balance: typeof p.balance === "number" ? p.balance : Number(p.balance ?? 0),
              } as Participant;
            }
          })
        );

        // sort by balance desc
        const sorted = enriched.sort((a, b) => (b.balance || 0) - (a.balance || 0));
        setParticipants(sorted);
        setLoadingParticipants(false);
      });

      return () => unsub();
    } catch (err) {
      console.error("Load participants error", err);
      setLoadingParticipants(false);
      return null;
    }
  };

const handleSendReply = async (messageId: string) => {
  if (!replyText.trim()) {
    Alert.alert("Empty Reply", "Please type a reply message first.");
    return;
  }

  try {
    const msgRef = doc(db, "supportMessages", messageId);
await updateDoc(msgRef, { reply: replyText, repliedAt: serverTimestamp() });
    Alert.alert("Success", "Reply sent successfully!");
    setReplyingTo(null);
    setReplyText("");
  } catch (err) {
    console.error("Reply Error:", err);
    Alert.alert("Error", "Failed to send reply.");
  }
};

const handleDeleteMessage = async (messageId: string) => {
  Alert.alert(
    "Confirm Delete",
    "Are you sure you want to delete this message?",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "supportMessages", messageId));
            Alert.alert("Deleted", "Message removed successfully!");
          } catch (err) {
            console.error("Delete Error:", err);
            Alert.alert("Error", "Could not delete message.");
          }
        },
      },
    ]
  );
};

  /* -------------------------
     Select tournament
     ------------------------- */
  const handleSelectTournament = async (t: Tournament) => {
    // cleanup existing participant listener
    if (participantUnsub) {
      participantUnsub();
      setParticipantUnsub(null);
    }
    setSelectedTournament(t);

    const unsubscribeFn = await loadParticipants(t.id);
    if (typeof unsubscribeFn === "function") {
      setParticipantUnsub(() => unsubscribeFn);
    } else {
      // OnSnapshot returns a function; loadParticipants returns () => unsub, but in case of null do nothing
    }
  };

  useEffect(() => {
  const q = query(collection(db, "supportMessages"), orderBy("createdAt", "desc"));
  const unsub = onSnapshot(q, (snapshot) => {
    const msgs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setSupportMessages(msgs);
  });
  return () => unsub();
}, []);

  /* -------------------------
     Modal open/close
     ------------------------- */
  const openCreateModal = (t: Tournament | null = null) => {
    if (t) {
      setIsEditing(true);
      setFormId(t.id ?? null);
      setName(t.name ?? "");
      setStartingBalance(String(t.startingBalance ?? 1000));
      setPrizePool(String(t.prizePool ?? 500));
      setMaxRebuys(String(t.maxRebuys ?? 0));
      setDurationMinutes(String(t.durationMinutes ?? 60));
      setDescription(t.description ?? "");
      setStatusSelect(t.status ?? "Upcoming");
    } else {
      setIsEditing(false);
      setFormId(null);
      setName("");
      setStartingBalance("1000");
      setPrizePool("500");
      setMaxRebuys("0");
      setDurationMinutes("60");
      setDescription("Compete now. Grow your balance; win prizes!");
      setStatusSelect("Upcoming");
    }
    setModalVisible(true);
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  const closeCreateModal = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setModalVisible(false));
  };

  /* -------------------------
     Save tournament
     ------------------------- */
  const saveTournament = async () => {
    if (!name.trim()) return Alert.alert("Validation", "Tournament name required");
    setSaving(true);
    try {
      const payload: any = {
        name: name.trim(),
        prizePool: parseFloat(prizePool) || 0,
        startingBalance: parseFloat(startingBalance) || 0,
        maxRebuys: parseInt(maxRebuys) || 0,
        durationMinutes: parseInt(durationMinutes) || 60,
        description,
        status: statusSelect,
        updatedAt: serverTimestamp(),
      };

      if (isEditing && formId) {
        const ref = doc(db, "tournaments", formId);
        await updateDoc(ref, payload);
        Alert.alert("Saved", "Tournament updated");
      } else {
        await addDoc(collection(db, "tournaments"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        Alert.alert("Created", "Tournament created successfully");
      }
      closeCreateModal();
    } catch (err: any) {
      console.error("saveTournament", err);
      Alert.alert("Error", err?.message ?? "Could not save tournament");
    } finally {
      setSaving(false);
    }
  };

  /* -------------------------
     Tournament controls
     ------------------------- */
  const closeTournament = async (t: Tournament) => {
    try {
      const ref = doc(db, "tournaments", t.id);
      await updateDoc(ref, { status: "Ended", endedAt: serverTimestamp() });
      Alert.alert("Closed", `${t.name} marked as Ended`);
    } catch (err) {
      console.error("closeTournament", err);
    }
  };

  const removeTournament = async (t: Tournament) => {
    Alert.alert("Confirm delete", `Delete tournament "${t.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "tournaments", t.id));
            Alert.alert("Deleted", "Tournament removed");
            if (selectedTournament?.id === t.id) {
              setSelectedTournament(null);
              setParticipants([]);
            }
          } catch (err) {
            console.error("removeTournament", err);
          }
        },
      },
    ]);
  };

  const payoutWinners = async (t: Tournament | null) => {
    if (!t) return;
    Alert.alert("Payout Winners", `Pay winners for "${t.name}"? This will call your secure payout endpoint.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Proceed",
        onPress: async () => {
          try {
            setGlobalLoading(true);
            const res = await fetch("https://YOUR_CLOUD_FUNCTION_URL/payout-winners", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tournamentId: t.id }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.message || "Payout failed");
            Alert.alert("Payout", "Payments initiated. Check server logs for details.");
          } catch (err: any) {
            console.error("payoutWinners", err);
            Alert.alert("Error", err?.message || "Payout failed");
          } finally {
            setGlobalLoading(false);
          }
        },
      },
    ]);
  };

  /* -------------------------
     Alerts + messaging (placeholders)
     ------------------------- */
  const sendAlert = async (payload: { title: string; message: string; tournamentId?: string; userId?: string }) => {
    try {
      setGlobalLoading(true);
      const res = await fetch("https://YOUR_CLOUD_FUNCTION_URL/send-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Alert failed");
      Alert.alert("Alert Sent", "Notifications emailed/pushed to recipients.");
    } catch (err: any) {
      console.error("sendAlert", err);
      Alert.alert("Error", err?.message || "Send alert failed");
    } finally {
      setGlobalLoading(false);
    }
  };

  const onSendBroadcast = () => {
    // Alert.prompt is iOS-only in some RN versions; still preserving your behaviour
    // If your RN target/platform doesn't support Alert.prompt, replace with custom modal
    // Using any cast to quiet TS for Alert.prompt typing differences
    (Alert as any).prompt?.(
      "Broadcast message",
      "Type announcement to broadcast to all users (email + push)",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: (txt: string) => {
            if (!txt) return;
            sendAlert({ title: "Announcement", message: txt });
          },
        },
      ],
      "plain-text"
    );
  };

  const onSendToTournament = (t: Tournament) => {
    (Alert as any).prompt?.(
      "Message to tournament participants",
      `Send message to participants of ${t.name}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: (txt: string) => {
            if (!txt) return;
            sendAlert({ title: `Update: ${t.name}`, message: txt, tournamentId: t.id });
          },
        },
      ],
      "plain-text"
    );
  };

  /* -------------------------
     Participant actions (credit, message, ban)
     ------------------------- */
  const creditParticipant = async (tournamentId: string, participant: Participant) => {
    (Alert as any).prompt?.(
      `Credit ${participant.name}`,
      "Amount to credit (USD)",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Credit",
          onPress: async (amt: string) => {
            const amount = parseFloat(amt || "0");
            if (!amount || amount <= 0) return;
            try {
              setGlobalLoading(true);
              const pRef = doc(db, "tournaments", tournamentId, "participants", participant.id);
              await updateDoc(pRef, { balance: (participant.balance || 0) + amount, lastCreditedAt: serverTimestamp() });
              Alert.alert("Success", `Credited $${amount} to ${participant.name}`);
            } catch (err) {
              console.error("creditParticipant", err);
              Alert.alert("Error", "Could not credit");
            } finally {
              setGlobalLoading(false);
            }
          },
        },
      ],
      "plain-text"
    );
  };

  const messageParticipant = (participant: Participant) => {
    (Alert as any).prompt?.(
      `Message ${participant.name}`,
      "Write message to this participant (email/push)",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: async (txt: string) => {
            if (!txt) return;
            await sendAlert({ title: `Message for ${participant.name}`, message: txt, userId: participant.userId || participant.id });
            Alert.alert("Sent", "Message queued to participant");
          },
        },
      ],
      "plain-text"
    );
  };

  const banParticipant = async (tId: string, participant: Participant) => {
    Alert.alert("Confirm", `Ban ${participant.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Ban",
        onPress: async () => {
          try {
            const pRef = doc(db, "tournaments", tId, "participants", participant.id);
            await updateDoc(pRef, { banned: true, bannedAt: serverTimestamp() });
            Alert.alert("Banned", `${participant.name} banned from tournament`);
          } catch (err) {
            console.error("banParticipant", err);
          }
        },
      },
    ]);
  };

  /* -------------------------
     Filtering + rendering helpers
     ------------------------- */
  const filteredTournaments = tournaments
    .filter((t) => {
      if (filter === "all") return true;
      if (filter === "ongoing") return t.status === "Ongoing";
      if (filter === "upcoming") return t.status === "Upcoming";
      if (filter === "ended") return t.status === "Ended";
      return true;
    })
    .filter((t) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (t.name || "").toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q);
    });

  const renderTournamentItem = ({ item }: { item: Tournament }) => {
    const isSelected = selectedTournament?.id === item.id;
    return (
      <TouchableOpacity
        style={[styles.tournamentCard, isSelected && styles.tournamentCardSelected]}
        onPress={() => handleSelectTournament(item)}
        activeOpacity={0.9}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={styles.tournamentName}>{item.name}</Text>
          <View style={[styles.statusBadge, item.status === "Ongoing" ? styles.statusOngoing : item.status === "Upcoming" ? styles.statusUpcoming : styles.statusEnded]}>
            <Text style={styles.statusText}>{item.status || "Unknown"}</Text>
          </View>
        </View>

        <Text style={styles.smallText}>Prize: ${item.prizePool || 0} • Start Bal: ${item.startingBalance || 0}</Text>
        <Text numberOfLines={1} style={styles.smallText}>{item.description || ""}</Text>

        <View style={{ flexDirection: "row", marginTop: 8 }}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openCreateModal(item)}>
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => closeTournament(item)}>
            <Text style={styles.actionText}>Close</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtnDanger} onPress={() => removeTournament(item)}>
            <Text style={styles.actionText}>Delete</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, { marginLeft: 6 }]} onPress={() => onSendToTournament(item)}>
            <Text style={styles.actionText}>Message</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, { marginLeft: 6 }]} onPress={() => payoutWinners(item)}>
            <Text style={styles.actionText}>Payout</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
      
    );
  };

  /* -------------------------
     UI
     ------------------------- */
  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 120 }}>
    {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Command Center</Text>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity style={styles.headerButton} onPress={onSendBroadcast}>
            <Text style={styles.headerButtonText}>Broadcast</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerButton, { marginLeft: 10 }]} onPress={() => openCreateModal()}>
            <Text style={styles.headerButtonText}>+ Tournament</Text>
          </TouchableOpacity>
          <TouchableOpacity
  style={styles.headerButton}
  onPress={async () => {
    try {
      await addDoc(collection(db, "alerts"), {
        title: "⚡ System Alert",
        message: "A new update has been released. Please refresh your session.",
        createdAt: serverTimestamp(),
        read: false, // new field for glow indicator
      });
      Alert.alert("✅ Alert Sent", "Users will see it instantly.");
    } catch (err) {
      console.error("Send Alert Error:", err);
      Alert.alert("❌ Failed", "Could not send alert.");
    }
  }}
>
  <Text style={styles.headerButtonText}>Send Alert</Text>
</TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalUsers}</Text>
          <Text style={styles.statLabel}>Total Users</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.activePlayers}</Text>
          <Text style={styles.statLabel}>Active Players</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.ongoing}</Text>
          <Text style={styles.statLabel}>Ongoing Tournaments</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>${stats.totalPrize || 0}</Text>
          <Text style={styles.statLabel}>Total Prize Pool</Text>
        </View>
      </View>

      <View style={styles.main}>
        <View style={styles.left}>
          <View style={styles.controlsRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity style={[styles.filterBtn, filter === "all" && styles.filterBtnActive]} onPress={() => setFilter("all")}>
                <Text style={styles.filterText}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.filterBtn, filter === "ongoing" && styles.filterBtnActive]} onPress={() => setFilter("ongoing")}>
                <Text style={styles.filterText}>Ongoing</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.filterBtn, filter === "upcoming" && styles.filterBtnActive]} onPress={() => setFilter("upcoming")}>
                <Text style={styles.filterText}>Upcoming</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.filterBtn, filter === "ended" && styles.filterBtnActive]} onPress={() => setFilter("ended")}>
                <Text style={styles.filterText}>Ended</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          <TextInput placeholder="Search tournaments..." placeholderTextColor="#999" style={styles.searchInput} value={searchQuery} onChangeText={setSearchQuery} />

          {globalLoading ? (
            <View style={{ padding: 20 }}>
              <ActivityIndicator size="large" color="#7cf" />
            </View>
          ) : (
            <FlatList data={filteredTournaments} keyExtractor={(i) => i.id} renderItem={renderTournamentItem} contentContainerStyle={{ paddingBottom: 120 }} />
          )}
        </View>

        <View style={styles.right}>
          <Text style={styles.sideTitle}>Selected Tournament</Text>
          {!selectedTournament ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No tournament selected. Tap a tournament to view participants and controls.</Text>
            </View>
          ) : (
            <>
              <View style={styles.selectedCard}>
                <Text style={styles.selectedName}>{selectedTournament.name}</Text>
                <Text style={styles.smallText}>Prize Pool: ${selectedTournament.prizePool}</Text>
                <Text style={styles.smallText}>Start Bal: ${selectedTournament.startingBalance}</Text>
                <Text style={styles.smallText}>Status: {selectedTournament.status}</Text>
                <Text style={styles.smallText}>Duration: {selectedTournament.durationMinutes || "—"} mins</Text>
                <Text style={[styles.smallText, { marginTop: 6 }]} numberOfLines={2}>
                  {selectedTournament.description}
                </Text>

                <View style={{ flexDirection: "row", marginTop: 10 }}>
                  <TouchableOpacity style={styles.sideAction} onPress={() => onSendToTournament(selectedTournament)}>
                    <Text style={styles.actionText}>Message</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.sideAction, { marginLeft: 8 }]} onPress={() => payoutWinners(selectedTournament)}>
                    <Text style={styles.actionText}>Payout Winners</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Participants</Text>

              {loadingParticipants ? (
                <ActivityIndicator color="#7cf" />
              ) : (
                <FlatList
                  data={participants}
                  keyExtractor={(p) => p.id}
                  renderItem={({ item, index }) => (
                    <View style={styles.participantRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.participantName}>
                          {index + 1}. {item.name}
                        </Text>
                        <Text style={styles.smallText}>{item.email || "—"}</Text>
                        <Text style={styles.smallText}>
                          Balance: ${item.balance ?? 0} • Rebuys: {item.rebuys ?? item.rebuyCount ?? 0}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <TouchableOpacity style={styles.smallBtn} onPress={() => creditParticipant(selectedTournament.id, item)}>
                          <Text style={styles.smallBtnText}>Credit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.smallBtn, { marginTop: 6 }]} onPress={() => messageParticipant(item)}>
                          <Text style={styles.smallBtnText}>Msg</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.smallBtnDanger, { marginTop: 6 }]} onPress={() => banParticipant(selectedTournament.id, item)}>
                          <Text style={styles.smallBtnText}>Ban</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                />
              )}
            </>
          )}
        </View>
      </View>

{/* Support Inbox Section */}
<View style={{ marginTop: 20 }}>
  <Text style={styles.sectionTitle}>
    Support Inbox ({supportMessages.length})
  </Text>

  {supportMessages.length === 0 ? (
    <Text style={styles.emptyText}>No support messages yet.</Text>
  ) : (
    <FlatList
      data={supportMessages}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.supportCard}>
          <Text style={styles.supportUser}>{item.name || "Anonymous"}</Text>
          <Text style={styles.supportEmail}>{item.email || "No email"}</Text>
          <Text style={styles.supportMessage}>{item.message}</Text>
          {item.reply && (
            <Text style={styles.replyText}>Admin Reply: {item.reply}</Text>
          )}
          <Text style={styles.supportDate}>
            {item.createdAt?.toDate?.().toLocaleString?.() || "Unknown date"}
          </Text>

          {/* Reply input (toggles when replying) */}
          {replyingTo === item.id ? (
            <>
              <TextInput
                value={replyText}
                onChangeText={setReplyText}
                placeholder="Type your reply..."
                placeholderTextColor="#ccc"
                style={styles.replyInput}
              />
              <TouchableOpacity
                style={styles.sendReplyButton}
                onPress={() => handleSendReply(item.id)}
              >
                <Text style={styles.sendText}>Send Reply</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.replyButton}
                onPress={() => setReplyingTo(item.id)}
              >
                <Text style={styles.replyButtonText}>Reply</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteMessage(item.id)}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
              
            </>
          )}
        </View>
      )}
    />
  )}
</View>

      {/* Create/Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="none">
        <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitleBox}>{isEditing ? "Edit Tournament" : "Create Tournament"}</Text>

            <TextInput style={styles.modalInput} placeholder="Tournament name" placeholderTextColor="#aaa" value={name} onChangeText={setName} />
            <TextInput style={styles.modalInput} placeholder="Prize pool (USD)" keyboardType="numeric" value={prizePool} onChangeText={setPrizePool} />
            <TextInput style={styles.modalInput} placeholder="Starting balance (USD)" keyboardType="numeric" value={startingBalance} onChangeText={setStartingBalance} />
            <TextInput style={styles.modalInput} placeholder="Max rebuys" keyboardType="numeric" value={maxRebuys} onChangeText={setMaxRebuys} />
            <TextInput style={styles.modalInput} placeholder="Duration (minutes)" keyboardType="numeric" value={durationMinutes} onChangeText={setDurationMinutes} />
            <TextInput style={[styles.modalInput, { height: 80 }]} placeholder="Description" multiline value={description} onChangeText={setDescription} />

            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#3a86ff" }]} onPress={saveTournament}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>{isEditing ? "Save" : "Create"}</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#ff007f" }]} onPress={closeCreateModal}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </Modal>
   </ScrollView>
  );
};

/* -------------------------
   Styles (kept unchanged visually)
   ------------------------- */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#07070a" },
  header: { padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomColor: "#101018", borderBottomWidth: 1 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  headerButton: { backgroundColor: "#2a2f6b", padding: 8, borderRadius: 8, paddingHorizontal: 12 },
  headerButtonText: { color: "#fff", fontWeight: "700" },

  statsRow: { flexDirection: "row", justifyContent: "space-between", padding: 12 },
  statCard: { flex: 1, marginHorizontal: 6, backgroundColor: "#0f1220", borderRadius: 12, padding: 12, alignItems: "center", shadowColor: "#3a86ff", shadowOpacity: 0.08, elevation: 2 },
  statValue: { color: "#7cf", fontSize: 20, fontWeight: "800" },
  statLabel: { color: "#aaa", fontSize: 12 },

  main: { flex: 1, flexDirection: "row", padding: 12 },
  left: { flex: 0.6, marginRight: 8 },
  right: { flex: 0.4, marginLeft: 8, backgroundColor: "#070712", borderRadius: 12, padding: 10 },

  controlsRow: { marginBottom: 8 },
  filterBtn: { padding: 8, paddingHorizontal: 12, backgroundColor: "#111218", borderRadius: 8, marginRight: 8, borderWidth: 1, borderColor: "#181824" },
  filterBtnActive: { backgroundColor: "#1b233f", borderColor: "#3a86ff" },
  filterText: { color: "#fff", fontWeight: "700" },

  searchInput: { backgroundColor: "#0f1116", color: "#fff", borderRadius: 8, padding: 10, marginBottom: 8 },

  tournamentCard: { backgroundColor: "#0f1116", padding: 12, marginBottom: 10, borderRadius: 12 },
  tournamentCardSelected: { borderLeftWidth: 4, borderLeftColor: "#7cf" },
  tournamentName: { color: "#fff", fontWeight: "800", fontSize: 16 },
  smallText: { color: "#bfc7d6", fontSize: 12, marginTop: 4 },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusOngoing: { backgroundColor: "#1b7f3a" },
  statusUpcoming: { backgroundColor: "#1b3a7f" },
  statusEnded: { backgroundColor: "#5c2a2a" },
  statusText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  actionBtn: { backgroundColor: "#202431", padding: 8, borderRadius: 8, marginRight: 6 },
  actionBtnDanger: { backgroundColor: "#4a1b2b", padding: 8, borderRadius: 8, marginRight: 6 },
  actionText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  sideTitle: { color: "#ffcc00", fontSize: 14, fontWeight: "700", marginBottom: 8 },
  emptyBox: { backgroundColor: "#0f1116", borderRadius: 10, padding: 12 },
  emptyText: { color: "#9aa1b2" },

  selectedCard: { backgroundColor: "#0f1116", padding: 12, borderRadius: 10 },
  selectedName: { color: "#fff", fontWeight: "800", fontSize: 16 },

  participantRow: { backgroundColor: "#0b0c10", padding: 10, borderRadius: 8, marginBottom: 8, flexDirection: "row" },
  participantName: { color: "#fff", fontWeight: "700" },
  smallBtn: { backgroundColor: "#1b3a7f", padding: 6, borderRadius: 6, marginBottom: 6 },
  smallBtnDanger: { backgroundColor: "#7f1b3a", padding: 6, borderRadius: 6 },

  smallBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center" },
  modalBox: { width: "92%", backgroundColor: "#0f1318", borderRadius: 14, padding: 16, borderColor: "#2b2f45", borderWidth: 1 },
  modalTitleBox: { color: "#7cf", fontWeight: "800", fontSize: 18, marginBottom: 8 },
  modalInput: { backgroundColor: "#0b0d12", color: "#fff", padding: 10, borderRadius: 8, marginVertical: 6 },
  modalBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: "center", marginHorizontal: 6 },
  modalBtnText: { color: "#fff", fontWeight: "800" },

  tournamentCardSmall: { padding: 8, borderRadius: 8, backgroundColor: "#12131a" },
  sideAction: {
    padding: 10,
    backgroundColor: "#333",
    borderRadius: 10,
  },

  replyButton: {
  backgroundColor: "#007bff",
  padding: 8,
  borderRadius: 6,
  alignItems: "center",
  marginTop: 6,
},
replyButtonText: {
  color: "#fff",
  fontWeight: "bold",
},
deleteButton: {
  backgroundColor: "#b00020",
  padding: 8,
  borderRadius: 6,
  alignItems: "center",
  marginTop: 6,
},
deleteButtonText: {
  color: "#fff",
  fontWeight: "bold",
},
replyInput: {
  borderWidth: 1,
  borderColor: "#666",
  borderRadius: 8,
  padding: 8,
  marginTop: 8,
  color: "#fff",
},
sendReplyButton: {
  backgroundColor: "#28a745",
  padding: 10,
  borderRadius: 8,
  alignItems: "center",
  marginTop: 8,
},
replyText: {
  color: "#00e676",
  marginTop: 6,
  fontStyle: "italic",
},
supportCard: {
  backgroundColor: "#1e1e1e",
  padding: 12,
  borderRadius: 10,
  marginVertical: 8,
  borderWidth: 1,
  borderColor: "#333",
},

supportUser: {
  color: "#fff",
  fontWeight: "bold",
  fontSize: 16,
},

supportEmail: {
  color: "#bbb",
  fontSize: 13,
  marginBottom: 4,
},

supportMessage: {
  color: "#ddd",
  marginBottom: 6,
  fontSize: 14,
},

supportDate: {
  color: "#888",
  fontSize: 12,
  marginTop: 4,
  alignSelf: "flex-end",
},

sendText: {
  color: "#fff",
  fontWeight: "bold",
  textAlign: "center",
},



  // spacing
  sectionTitle: { color: "#ffcc00", fontWeight: "800", marginTop: 6, marginBottom: 6 },
});

export default AdminDashboard;
