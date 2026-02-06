// App.tsx — Heart Tap Frenzy (Expo / React Native)
// Paste this entire file into App.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

let Haptics: any = null;
try {
  // Optional: expo install expo-haptics
  // If not installed, it will silently fall back with no vibration.

  Haptics = require("expo-haptics");
} catch {}

type Phase = "intro" | "playing" | "reward" | "proposal";

type Heart = {
  id: string;
  x: number;
  size: number;
  y: Animated.Value;
  anim?: Animated.CompositeAnimation;
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function Index() {
  // Game tuning (easy to tweak)
  const LEVELS = useMemo(
    () => [
      {
        level: 1,
        durationMs: 20000,
        target: 18,
        spawnEveryMs: 700,
        fallMs: 2800,
      },
      {
        level: 2,
        durationMs: 20000,
        target: 22,
        spawnEveryMs: 600,
        fallMs: 2400,
      },
      {
        level: 3,
        durationMs: 22000,
        target: 26,
        spawnEveryMs: 520,
        fallMs: 2100,
      },
    ],
    [],
  );

  const [phase, setPhase] = useState<Phase>("intro");
  const [levelIndex, setLevelIndex] = useState(0);

  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);

  const heartsRef = useRef<Heart[]>([]);
  const [, forceRender] = useState(0); // lightweight rerender trigger

  const spawnTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const current = LEVELS[levelIndex];

  const clearTimers = () => {
    if (spawnTimer.current) clearInterval(spawnTimer.current);
    if (tickTimer.current) clearInterval(tickTimer.current);
    spawnTimer.current = null;
    tickTimer.current = null;
  };

  const clearHearts = () => {
    // Stop animations & clear list
    heartsRef.current.forEach((h) => h.anim?.stop());
    heartsRef.current = [];
    forceRender((n) => n + 1);
  };

  const softHaptic = async () => {
    try {
      await Haptics?.selectionAsync?.();
    } catch {}
  };

  const successHaptic = async () => {
    try {
      await Haptics?.notificationAsync?.(
        Haptics.NotificationFeedbackType.Success,
      );
    } catch {}
  };

  const startLevel = (idx: number) => {
    clearTimers();
    clearHearts();

    setLevelIndex(idx);
    setScore(0);
    setTimeLeft(Math.ceil(LEVELS[idx].durationMs / 1000));
    setPhase("playing");

    // Countdown tick
    const startAt = Date.now();
    tickTimer.current = setInterval(() => {
      const elapsed = Date.now() - startAt;
      const left = Math.max(
        0,
        Math.ceil((LEVELS[idx].durationMs - elapsed) / 1000),
      );
      setTimeLeft(left);

      if (left <= 0) {
        endLevel(idx);
      }
    }, 250);

    // Heart spawner
    spawnTimer.current = setInterval(() => {
      spawnHeart(idx);
    }, LEVELS[idx].spawnEveryMs);
  };

  const endLevel = async (idx: number) => {
    clearTimers();

    const passed = score >= LEVELS[idx].target;
    if (passed) await successHaptic();

    // Stop new hearts; let existing hearts continue briefly then clear
    setTimeout(() => clearHearts(), 250);

    if (!passed) {
      // Retry same level
      setPhase("reward");
      return;
    }

    // Passed:
    if (idx < LEVELS.length - 1) {
      setPhase("reward");
    } else {
      // Final pass -> proposal
      setPhase("proposal");
    }
  };

  const spawnHeart = (idx: number) => {
    const padding = 24;
    const size = 28 + Math.floor(Math.random() * 22); // 28..49
    const x = padding + Math.random() * (SCREEN_W - padding * 2 - size);

    const y = new Animated.Value(-60);

    const heart: Heart = {
      id: uid(),
      x,
      size,
      y,
    };

    const duration = LEVELS[idx].fallMs + Math.floor(Math.random() * 600);
    const anim = Animated.timing(y, {
      toValue: SCREEN_H + 80,
      duration,
      useNativeDriver: true,
    });

    heart.anim = anim;

    heartsRef.current.push(heart);
    forceRender((n) => n + 1);

    anim.start(({ finished }) => {
      if (!finished) return;

      // Remove when off-screen
      heartsRef.current = heartsRef.current.filter((h) => h.id !== heart.id);
      forceRender((n) => n + 1);
    });
  };

  const onTapHeart = async (id: string) => {
    await softHaptic();

    const h = heartsRef.current.find((x) => x.id === id);
    if (!h) return;

    // Stop animation, remove from list
    h.anim?.stop();
    heartsRef.current = heartsRef.current.filter((x) => x.id !== id);

    setScore((s) => s + 1);
    forceRender((n) => n + 1);
  };

  // If we enter reward phase due to fail, show guidance
  const passed = phase !== "playing" && score >= (current?.target ?? 0);

  useEffect(() => {
    return () => {
      clearTimers();
      clearHearts();
    };
  }, []);

  // ---------------- UI ----------------

  if (phase === "intro") {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.title}>Heart Tap Frenzy 💘</Text>
          <Text style={styles.sub}>
            Collect hearts to unlock something special.
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>How to play</Text>
            <Text style={styles.cardText}>
              • Tap hearts before they float away
            </Text>
            <Text style={styles.cardText}>
              • Beat the target score to unlock the next level
            </Text>
            <Text style={styles.cardText}>
              • Three levels… then a surprise 👀
            </Text>
          </View>

          <Pressable style={styles.primaryBtn} onPress={() => startLevel(0)}>
            <Text style={styles.primaryBtnText}>Start 💖</Text>
          </Pressable>

          <Text style={styles.footnote}>
            Tip: If you want haptics, run:{" "}
            <Text style={{ fontWeight: "700" }}>
              npx expo install expo-haptics
            </Text>
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === "reward") {
    const target = current.target;
    const success = score >= target;

    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.title}>
            Level {current.level} {success ? "Unlocked 💝" : "Almost 😭"}
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Score</Text>
            <Text style={styles.bigScore}>
              {score} / {target}
            </Text>

            <Text style={styles.cardText}>
              {success
                ? current.level === 1
                  ? "Reward unlocked: A little memory 💌"
                  : "Reward unlocked: Another piece of our story 💞"
                : "Try again — you’ve got this."}
            </Text>
          </View>

          {success && levelIndex < LEVELS.length - 1 ? (
            <>
              <View style={styles.rewardBox}>
                <Text style={styles.rewardTitle}>Unlocked Note</Text>
                <Text style={styles.rewardText}>
                  Replace this text with a sweet line about you two ✨
                </Text>
              </View>

              <Pressable
                style={styles.primaryBtn}
                onPress={() => startLevel(levelIndex + 1)}
              >
                <Text style={styles.primaryBtnText}>Next Level 💗</Text>
              </Pressable>
            </>
          ) : success && levelIndex >= LEVELS.length - 1 ? (
            <Pressable
              style={styles.primaryBtn}
              onPress={() => setPhase("proposal")}
            >
              <Text style={styles.primaryBtnText}>Open Surprise 💍</Text>
            </Pressable>
          ) : (
            <Pressable
              style={styles.primaryBtn}
              onPress={() => startLevel(levelIndex)}
            >
              <Text style={styles.primaryBtnText}>Retry 🔁</Text>
            </Pressable>
          )}

          <Pressable
            style={styles.secondaryBtn}
            onPress={() => {
              clearTimers();
              clearHearts();
              setPhase("intro");
            }}
          >
            <Text style={styles.secondaryBtnText}>Back to Start</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === "proposal") {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.title}>You unlocked my question… 💍</Text>

          <View style={styles.proposalCard}>
            <Text style={styles.proposalText}>Will you be my Valentine?</Text>
            <Text style={styles.proposalSub}>
              (and my forever, every year) ❤️
            </Text>
          </View>

          <Pressable style={styles.primaryBtn} onPress={successHaptic}>
            <Text style={styles.primaryBtnText}>YES 😭❤️</Text>
          </Pressable>

          <Pressable style={styles.primaryBtn} onPress={successHaptic}>
            <Text style={styles.primaryBtnText}>YESSS 😭😭❤️</Text>
          </Pressable>

          <Text style={styles.confettiText}>✨💖✨💖✨💖✨💖✨</Text>
        </View>
      </SafeAreaView>
    );
  }

  // PLAYING
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.playContainer}>
        <View style={styles.hud}>
          <Text style={styles.hudText}>Level {current.level}</Text>
          <Text style={styles.hudText}>Time: {timeLeft}s</Text>
          <Text style={styles.hudText}>
            Score: {score}/{current.target}
          </Text>
        </View>

        {/* Hearts layer */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {heartsRef.current.map((h) => (
            <Animated.View
              key={h.id}
              style={[
                styles.heartWrap,
                {
                  left: h.x,
                  transform: [{ translateY: h.y }],
                },
              ]}
              pointerEvents="box-none"
            >
              <Pressable
                onPress={() => onTapHeart(h.id)}
                style={({ pressed }) => [
                  styles.heartBtn,
                  { width: h.size, height: h.size, opacity: pressed ? 0.6 : 1 },
                ]}
                hitSlop={16}
              >
                <Text style={{ fontSize: h.size * 0.9 }}>💗</Text>
              </Pressable>
            </Animated.View>
          ))}
        </View>

        <View style={styles.bottomBar}>
          <Pressable
            style={styles.secondaryBtnSmall}
            onPress={() => {
              clearTimers();
              clearHearts();
              setPhase("intro");
            }}
          >
            <Text style={styles.secondaryBtnText}>Quit</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryBtnSmall}
            onPress={() => endLevel(levelIndex)}
          >
            <Text style={styles.secondaryBtnText}>Finish</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFE4EC" },
  container: {
    flex: 1,
    padding: 18,
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
  },
  playContainer: {
    flex: 1,
    backgroundColor: "#FFE4EC",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#2B2B2B",
    textAlign: "center",
  },
  sub: {
    fontSize: 16,
    color: "#444",
    textAlign: "center",
    paddingHorizontal: 18,
  },
  card: {
    width: "92%",
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
    color: "#222",
  },
  cardText: { fontSize: 14, color: "#333", marginBottom: 6 },
  bigScore: { fontSize: 36, fontWeight: "900", color: "#111" },

  primaryBtn: {
    width: "92%",
    backgroundColor: "#FF4D88",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 2,
  },
  primaryBtnText: { color: "white", fontSize: 18, fontWeight: "900" },

  secondaryBtn: {
    width: "92%",
    backgroundColor: "rgba(255,255,255,0.75)",
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  secondaryBtnSmall: {
    backgroundColor: "rgba(255,255,255,0.75)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  secondaryBtnText: { color: "#222", fontSize: 14, fontWeight: "800" },

  footnote: {
    marginTop: 8,
    fontSize: 12,
    color: "#555",
    textAlign: "center",
    paddingHorizontal: 10,
  },

  hud: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  hudText: { fontSize: 14, fontWeight: "900", color: "#222" },

  heartWrap: {
    position: "absolute",
    top: 0,
  },
  heartBtn: {
    justifyContent: "center",
    alignItems: "center",
  },

  bottomBar: {
    position: "absolute",
    bottom: 22,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  rewardBox: {
    width: "92%",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  rewardTitle: {
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 8,
    color: "#222",
  },
  rewardText: { fontSize: 14, color: "#333" },

  proposalCard: {
    width: "92%",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
  },
  proposalText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111",
    textAlign: "center",
  },
  proposalSub: {
    marginTop: 8,
    fontSize: 14,
    color: "#444",
    textAlign: "center",
  },

  confettiText: { marginTop: 10, fontSize: 22 },
});
