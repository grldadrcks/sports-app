import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  RefreshControl,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { getTodayScores, getUpcomingGames } from "./api";

const C = {
  bg: "#0D0D1A",
  card: "#1A1A2E",
  nav: "#14142B",
  green: "#00E676",
  blue: "#40C4FF",
  gray: "#888888",
  white: "#FFFFFF",
  dim: "#CCCCCC",
};

const SPORTS = [
  { label: "All", key: "all" },
  { label: "Soccer", key: "soccer" },
  { label: "Basketball", key: "basketball" },
];

function localTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function safeInt(s) {
  const n = parseInt(s, 10);
  return isNaN(n) ? -1 : n;
}

function FilterBar({ active, onSelect }) {
  return (
    <View style={styles.filterBar}>
      {SPORTS.map(({ label, key }) => (
        <TouchableOpacity
          key={key}
          onPress={() => onSelect(key)}
          style={[styles.filterBtn, active === key && styles.filterBtnActive]}
        >
          <Text style={[styles.filterText, active === key && styles.filterTextActive]}>
            {label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function GameCard({ game }) {
  const isLive = game.statusType === "STATUS_IN_PROGRESS";
  const isFinal = game.statusType === "STATUS_FINAL";
  const showScore = isLive || isFinal;
  const homeWin = isFinal && safeInt(game.homeScore) > safeInt(game.awayScore);
  const awayWin = isFinal && safeInt(game.awayScore) > safeInt(game.homeScore);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.leagueText}>{game.league}</Text>
        {isLive ? (
          <Text style={[styles.statusText, { color: C.green }]}>
            ● LIVE  {game.periodInfo}
          </Text>
        ) : isFinal ? (
          <Text style={[styles.statusText, { color: C.gray }]}>FINAL</Text>
        ) : (
          <Text style={[styles.statusText, { color: C.blue }]}>
            {localTime(game.date)}
          </Text>
        )}
      </View>

      <TeamRow
        name={game.awayTeam}
        score={game.awayScore}
        showScore={showScore}
        bold={awayWin}
      />
      <TeamRow
        name={game.homeTeam}
        score={game.homeScore}
        showScore={showScore}
        bold={homeWin}
      />
    </View>
  );
}

function TeamRow({ name, score, showScore, bold }) {
  return (
    <View style={styles.teamRow}>
      <Text style={[styles.teamName, bold && styles.teamNameBold]}>{name}</Text>
      {showScore && (
        <Text style={[styles.scoreText, bold && styles.scoreTextBold]}>{score}</Text>
      )}
    </View>
  );
}

function ScoresScreen({ mode }) {
  const [games, setGames] = useState([]);
  const [sport, setSport] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const sportRef = useRef(sport);
  sportRef.current = sport;

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(false);
    try {
      const data =
        mode === "live"
          ? await getTodayScores(sportRef.current)
          : await getUpcomingGames(sportRef.current);
      setGames(data);
    } catch {
      setError(true);
      setGames([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mode]);

  useEffect(() => {
    load();
  }, [sport, load]);

  useEffect(() => {
    if (mode !== "live") return;
    const id = setInterval(() => load(true), 60000);
    return () => clearInterval(id);
  }, [mode, load]);

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  let body;
  if (loading) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.green} />
      </View>
    );
  } else if (error || games.length === 0) {
    const msg = error
      ? "Could not load scores — check your connection."
      : mode === "live"
      ? "No live games right now — check back soon!"
      : "No upcoming games found.";
    body = (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{msg}</Text>
      </View>
    );
  } else {
    body = (
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.green} />
        }
      >
        {games.map((g) => (
          <GameCard key={`${g.id}-${g.league}`} game={g} />
        ))}
      </ScrollView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <FilterBar active={sport} onSelect={setSport} />
      {body}
    </SafeAreaView>
  );
}

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ color, size }) => {
            const icon = route.name === "Live" ? "flash" : "calendar";
            return <Ionicons name={icon} size={size} color={color} />;
          },
          tabBarActiveTintColor: C.green,
          tabBarInactiveTintColor: C.gray,
          tabBarStyle: { backgroundColor: C.nav, borderTopColor: "#222244" },
          headerStyle: { backgroundColor: C.bg },
          headerTintColor: C.white,
          headerTitleStyle: { fontWeight: "bold" },
        })}
      >
        <Tab.Screen name="Live" options={{ title: "Live Scores" }}>
          {() => <ScoresScreen mode="live" />}
        </Tab.Screen>
        <Tab.Screen name="Upcoming" options={{ title: "Upcoming Games" }}>
          {() => <ScoresScreen mode="upcoming" />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  filterBar: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: C.bg,
    gap: 4,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#333355",
  },
  filterBtnActive: {
    borderColor: C.green,
    backgroundColor: "#003322",
  },
  filterText: {
    color: C.gray,
    fontSize: 13,
    fontWeight: "600",
  },
  filterTextActive: {
    color: C.green,
  },
  list: {
    padding: 8,
    paddingBottom: 20,
    gap: 8,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  leagueText: {
    color: C.gray,
    fontSize: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  teamRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  teamName: {
    color: C.dim,
    fontSize: 15,
    flex: 1,
  },
  teamNameBold: {
    color: C.white,
    fontWeight: "bold",
  },
  scoreText: {
    color: C.dim,
    fontSize: 18,
    fontWeight: "600",
    minWidth: 30,
    textAlign: "right",
  },
  scoreTextBold: {
    color: C.white,
    fontWeight: "bold",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyText: {
    color: C.gray,
    fontSize: 15,
    textAlign: "center",
  },
});
