import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Animated,
  Easing,
  Dimensions,
  StatusBar,
  Platform,
  ActivityIndicator,
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";

import * as ImagePicker from "expo-image-picker";

import * as Speech from "expo-speech";

import Svg, {
  Circle,
} from "react-native-svg";

import { scanImage } from "../../services/api";

const { width: SW } =
  Dimensions.get("window");

// ─────────────────────────────
// Theme
// ─────────────────────────────

const T = {

  bg: "#07111F",

  card: "#0E1B2E",

  cardAlt: "#0A1628",

  blue: "#38BDF8",

  blueDim:
    "rgba(56,189,248,0.10)",

  blueBorder:
    "rgba(56,189,248,0.20)",

  green: "#22C55E",

  greenDim:
    "rgba(34,197,94,0.10)",

  greenBorder:
    "rgba(34,197,94,0.20)",

  amber: "#F59E0B",

  amberDim:
    "rgba(245,158,11,0.10)",

  red: "#EF4444",

  redDim:
    "rgba(239,68,68,0.10)",

  text: "#F8FAFC",

  textSec: "#CBD5E1",

  textMuted:
    "rgba(203,213,225,0.45)",

  border:
    "rgba(255,255,255,0.06)",
};

// ─────────────────────────────
// Severity
// ─────────────────────────────

const SEVERITY = {

  high: {
    color: T.red,
    label: "High Risk",
    icon: "⚠",
  },

  medium: {
    color: T.amber,
    label: "Medium Risk",
    icon: "⚡",
  },

  low: {
    color: T.green,
    label: "Low Risk",
    icon: "✓",
  },
};

const getSeverity = (
  s?: string
) => {

  return (
    SEVERITY[
      (
        s || "medium"
      ).toLowerCase() as keyof typeof SEVERITY
    ] || SEVERITY.medium
  );
};

// ─────────────────────────────
// SVG Risk Gauge
// ─────────────────────────────

function RiskGauge({

  score,
  color,

}: {

  score: number;
  color: string;

}) {

  const animated =
    useRef(
      new Animated.Value(0)
    ).current;

  useEffect(() => {

    Animated.timing(
      animated,
      {
        toValue: score,
        duration: 1000,
        easing: Easing.out(
          Easing.cubic
        ),
        useNativeDriver: false,
      }
    ).start();

  }, [score]);

  const size = 120;

  const strokeWidth = 10;

  const radius =
    (size - strokeWidth) / 2;

  const circumference =
    2 * Math.PI * radius;

  const animatedStroke =
    animated.interpolate({

      inputRange: [0, 100],

      outputRange: [
        circumference,
        0,
      ],
    });

  return (

    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >

      <Svg
        width={size}
        height={size}
      >

        <Circle
          stroke="rgba(255,255,255,0.06)"
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />

        <AnimatedCircle
          stroke={color}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={
            animatedStroke
          }
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />

      </Svg>

      <View
        style={{
          position: "absolute",
          alignItems: "center",
        }}
      >

        <Text
          allowFontScaling
          style={{
            color,
            fontSize: 28,
            fontWeight: "800",
          }}
        >
          {score}
        </Text>

        <Text
          style={{
            color: T.textMuted,
            fontSize: 11,
            marginTop: -2,
          }}
        >
          /100
        </Text>

      </View>

    </View>
  );
}

const AnimatedCircle =
  Animated.createAnimatedComponent(
    Circle
  );

// ─────────────────────────────
// Eye Logo
// ─────────────────────────────

function EyeLogo() {

  const glow =
    useRef(
      new Animated.Value(0)
    ).current;

  const blink =
    useRef(
      new Animated.Value(1)
    ).current;

  useEffect(() => {

    Animated.loop(

      Animated.sequence([

        Animated.timing(
          glow,
          {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }
        ),

        Animated.timing(
          glow,
          {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }
        ),
      ])
    ).start();

    let mounted = true;

    const blinkLoop = () => {

      if (!mounted) return;

      setTimeout(() => {

        if (!mounted) return;

        Animated.sequence([

          Animated.timing(
            blink,
            {
              toValue: 0.08,
              duration: 80,
              useNativeDriver: true,
            }
          ),

          Animated.timing(
            blink,
            {
              toValue: 1,
              duration: 80,
              useNativeDriver: true,
            }
          ),

        ]).start(() => {
          blinkLoop();
        });

      }, 3000);

    };

    blinkLoop();

    return () => {
      mounted = false;
    };

  }, []);

  return (

    <View style={styles.logoWrap}>

      <Animated.View
        style={[
          styles.glowRing,
          {
            opacity: glow.interpolate({

              inputRange: [0, 1],

              outputRange: [
                0.2,
                0.6,
              ],
            }),
          },
        ]}
      />

      <View style={styles.outerRing}>

        <View style={styles.innerEye}>

          <Animated.View
            style={[
              styles.pupil,
              {
                transform: [
                  {
                    scaleY: blink,
                  },
                ],
              },
            ]}
          />

        </View>

      </View>

    </View>
  );
}

// ─────────────────────────────
// Main Screen
// ─────────────────────────────

export default function HomeScreen() {

  const [image, setImage] =
    useState<string | null>(
      null
    );

  const [result, setResult] =
    useState<any>(null);

  const [loading, setLoading] =
    useState(false);

  const [voice, setVoice] =
    useState(true);

  const [error, setError] =
    useState("");

  // ─────────────────────────────
  // Speech
  // ─────────────────────────────

  const speakResult =
    useCallback(

      (analysis: any) => {

        if (!voice) return;

        try {

          Speech.stop();

          let msg =
            analysis?.summary || "";

          if (
            analysis?.reasons?.length
          ) {

            msg +=
              ". Key findings. ";

            analysis.reasons
              .slice(0, 2)
              .forEach(
                (
                  r: string
                ) => {
                  msg += `${r}. `;
                }
              );
          }

          Speech.speak(msg, {
            rate: 0.9,
            pitch: 1,
          });

        } catch (err) {

          console.log(err);
        }
      },

      [voice]
    );

  // ─────────────────────────────
  // Pick Image
  // ─────────────────────────────

  const pickImage =
    async () => {

      if (loading) return;

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (
        !permission.granted
      ) {

        setError(
          "Permission required to access photos."
        );

        return;
      }

      const pickerResult =
        await ImagePicker.launchImageLibraryAsync({

          mediaTypes:
            ImagePicker.MediaTypeOptions.Images,

          quality: 0.85,
        });

      if (
        pickerResult.canceled
      ) return;

      const imageUri =
        pickerResult.assets[0].uri;

      setImage(imageUri);

      setResult(null);

      setError("");

      setLoading(true);

      if (voice) {

        Speech.stop();

        Speech.speak(
          "Scanning screenshot for cyber threats."
        );
      }

      try {

        const analysis =
          await scanImage(
            imageUri
          );

        setResult(analysis);

        speakResult(
          analysis.analysis
        );

      } catch (err) {

        console.error(err);

        setError(
          "Failed to analyze screenshot."
        );

        if (voice) {

          Speech.speak(
            "Failed to analyze screenshot."
          );
        }

      } finally {

        setLoading(false);
      }
    };

  const analysis =
    result?.analysis;

  const severity =
    getSeverity(
      analysis?.severity
    );

  return (

    <View style={styles.root}>

      <StatusBar
        barStyle="light-content"
      />

      <LinearGradient
        colors={[
          "#07111F",
          "#0C1A2E",
          "#07111F",
        ]}
        style={
          StyleSheet.absoluteFill
        }
      />

      <ScrollView
        contentContainerStyle={
          styles.container
        }
        showsVerticalScrollIndicator={
          false
        }
      >

        {/* HEADER */}

        <View
          style={styles.header}
        >

          <EyeLogo />

          <Text
            allowFontScaling
            style={styles.title}
          >
            BlindSight
          </Text>

          <Text
            allowFontScaling
            style={styles.subtitle}
          >
            Accessibility-first
            Cybersecurity Assistant
          </Text>

        </View>

        {/* UPLOAD */}

        <TouchableOpacity
          style={styles.uploadBox}
          activeOpacity={0.85}
          onPress={pickImage}
        >

          {image ? (

            <Image
              source={{
                uri: image,
              }}
              style={styles.image}
            />

          ) : (

            <>

              <Text
                style={
                  styles.uploadIcon
                }
              >
                ⬆
              </Text>

              <Text
                style={
                  styles.uploadText
                }
              >
                Upload Screenshot
              </Text>

              <Text
                style={
                  styles.uploadSub
                }
              >
                JPG • PNG • WEBP
              </Text>

            </>
          )}

        </TouchableOpacity>

        {/* SCAN BUTTON */}

        <TouchableOpacity
          style={styles.scanButton}
          onPress={pickImage}
          disabled={loading}
        >

          <LinearGradient
            colors={[
              "#0EA5E9",
              "#38BDF8",
            ]}
            style={
              styles.scanGradient
            }
          >

            {loading ? (

              <View
                style={{
                  flexDirection:
                    "row",
                  alignItems:
                    "center",
                  gap: 10,
                }}
              >

                <ActivityIndicator
                  color="#fff"
                />

                <Text
                  style={
                    styles.scanText
                  }
                >
                  Scanning...
                </Text>

              </View>

            ) : (

              <Text
                style={
                  styles.scanText
                }
              >
                Scan Screenshot
              </Text>

            )}

          </LinearGradient>

        </TouchableOpacity>

        {/* VOICE */}

        <TouchableOpacity
          style={[
            styles.voiceButton,

            voice && {
              borderColor:
                T.blueBorder,

              backgroundColor:
                T.blueDim,
            },
          ]}
          onPress={() =>
            setVoice(!voice)
          }
        >

          <Text
            style={{
              color: voice
                ? T.blue
                : T.textMuted,

              fontWeight: "700",
            }}
          >

            {voice
              ? "🔊 Voice Guidance"
              : "🔇 Voice Disabled"}

          </Text>

        </TouchableOpacity>

        {/* ERROR */}

        {!!error && (

          <View
            style={
              styles.errorCard
            }
          >

            <Text
              style={
                styles.errorText
              }
            >
              {error}
            </Text>

          </View>
        )}

        {/* RESULT */}

        {analysis && (

          <View
            style={
              styles.resultCard
            }
          >

            <View
              style={
                styles.resultTop
              }
            >

              <View
                style={{
                  flex: 1,
                }}
              >

                <Text
                  style={
                    styles.analysisLabel
                  }
                >
                  THREAT ANALYSIS
                </Text>

                <View
                  style={[
                    styles.badge,

                    {
                      backgroundColor:
                        severity.color +
                        "20",
                    },
                  ]}
                >

                  <Text
                    style={{
                      color:
                        severity.color,

                      fontWeight:
                        "700",
                    }}
                  >
                    {
                      severity.icon
                    }{" "}
                    {
                      severity.label
                    }
                  </Text>

                </View>

              </View>

              <RiskGauge
                score={
                  analysis.risk_score
                }
                color={
                  severity.color
                }
              />

            </View>

            {/* SUMMARY */}

            <View
              style={
                styles.section
              }
            >

              <Text
                style={
                  styles.sectionTitle
                }
              >
                SUMMARY
              </Text>

              <Text
                allowFontScaling
                style={
                  styles.bodyText
                }
              >
                {analysis.summary}
              </Text>

            </View>

            {/* REASONS */}

            {!!analysis.reasons
              ?.length && (

              <View
                style={
                  styles.section
                }
              >

                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  WHY THIS WAS FLAGGED
                </Text>

                {analysis.reasons.map(
                  (
                    reason: string,
                    index: number
                  ) => (

                    <View
                      key={index}
                      style={
                        styles.reasonRow
                      }
                    >

                      <View
                        style={
                          styles.reasonDot
                        }
                      />

                      <Text
                        allowFontScaling
                        style={
                          styles.reasonText
                        }
                      >
                        {reason}
                      </Text>

                    </View>
                  )
                )}

              </View>
            )}

            {/* ADVICE */}

            {!!analysis.advice
              ?.length && (

              <View
                style={
                  styles.section
                }
              >

                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  SAFE ACTIONS
                </Text>

                {analysis.advice.map(
                  (
                    item: string,
                    index: number
                  ) => (

                    <View
                      key={index}
                      style={
                        styles.adviceRow
                      }
                    >

                      <Text
                        style={
                          styles.check
                        }
                      >
                        ✓
                      </Text>

                      <Text
                        allowFontScaling
                        style={
                          styles.reasonText
                        }
                      >
                        {item}
                      </Text>

                    </View>
                  )
                )}

              </View>
            )}

            {/* URLS */}

            {!!analysis
              .detected_urls
              ?.length && (

              <View
                style={
                  styles.section
                }
              >

                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  DETECTED LINKS
                </Text>

                {analysis.detected_urls.map(
                  (
                    url: string,
                    index: number
                  ) => (

                    <View
                      key={index}
                      style={
                        styles.urlCard
                      }
                    >

                      <Text
                        allowFontScaling
                        style={
                          styles.urlText
                        }
                      >
                        {url}
                      </Text>

                    </View>
                  )
                )}

              </View>
            )}

          </View>
        )}

      </ScrollView>

    </View>
  );
}

// ─────────────────────────────
// Styles
// ─────────────────────────────

const styles =
  StyleSheet.create({

    root: {
      flex: 1,
      backgroundColor:
        T.bg,
    },

    container: {
      padding: 20,
      paddingTop: 70,
      paddingBottom: 40,
    },

    header: {
      alignItems: "center",
      marginBottom: 24,
    },

    logoWrap: {
      width: 72,
      height: 72,
      alignItems: "center",
      justifyContent:
        "center",
      marginBottom: 18,
    },

    glowRing: {
      position: "absolute",
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor:
        T.blue,
    },

    outerRing: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor:
        T.blueDim,
      borderWidth: 1,
      borderColor:
        T.blueBorder,
      alignItems: "center",
      justifyContent:
        "center",
    },

    innerEye: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor:
        "rgba(56,189,248,0.18)",
      alignItems: "center",
      justifyContent:
        "center",
    },

    pupil: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor:
        T.blue,
    },

    title: {
      fontSize: 38,
      fontWeight: "800",
      color: T.text,
      marginBottom: 6,
    },

    subtitle: {
      color: T.textSec,
      textAlign: "center",
      lineHeight: 22,
    },

    uploadBox: {
      minHeight: 210,
      borderRadius: 24,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor:
        T.blueBorder,
      backgroundColor:
        T.blueDim,
      alignItems: "center",
      justifyContent:
        "center",
      marginBottom: 16,
      overflow: "hidden",
    },

    uploadIcon: {
      fontSize: 36,
      color: T.blue,
      marginBottom: 14,
    },

    uploadText: {
      fontSize: 18,
      fontWeight: "700",
      color: T.text,
    },

    uploadSub: {
      color: T.textMuted,
      marginTop: 6,
      fontSize: 11,
      letterSpacing: 2,
    },

    image: {
      width: SW - 60,
      height: 210,
      borderRadius: 18,
    },

    scanButton: {
      borderRadius: 18,
      overflow: "hidden",
      marginBottom: 14,
    },

    scanGradient: {
      paddingVertical: 18,
      alignItems: "center",
      justifyContent:
        "center",
    },

    scanText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: 1,
    },

    voiceButton: {
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: "center",
      borderWidth: 1,
      borderColor:
        T.border,
      backgroundColor:
        T.cardAlt,
      marginBottom: 20,
    },

    errorCard: {
      backgroundColor:
        T.redDim,
      borderRadius: 18,
      padding: 18,
      marginBottom: 18,
      borderWidth: 1,
      borderColor:
        T.red,
    },

    errorText: {
      color: T.red,
      textAlign: "center",
      fontWeight: "600",
    },

    resultCard: {
      backgroundColor:
        T.card,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor:
        T.border,
    },

    resultTop: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
      marginBottom: 24,
    },

    analysisLabel: {
      color: T.textMuted,
      fontSize: 11,
      letterSpacing: 2,
      marginBottom: 10,
    },

    badge: {
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
    },

    section: {
      marginTop: 20,
    },

    sectionTitle: {
      color: T.textSec,
      fontSize: 11,
      letterSpacing: 2,
      marginBottom: 12,
      fontWeight: "700",
    },

    bodyText: {
      color: T.textSec,
      lineHeight: 26,
      fontSize: 15,
    },

    reasonRow: {
      flexDirection: "row",
      gap: 12,
      paddingVertical: 10,
    },

    adviceRow: {
      flexDirection: "row",
      gap: 12,
      paddingVertical: 10,
      alignItems: "center",
    },

    reasonDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor:
        T.amber,
      marginTop: 8,
    },

    reasonText: {
      flex: 1,
      color: T.textSec,
      lineHeight: 22,
      fontSize: 14,
    },

    check: {
      color: T.green,
      fontWeight: "800",
      fontSize: 16,
    },

    urlCard: {
      backgroundColor:
        T.blueDim,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor:
        T.blueBorder,
    },

    urlText: {
      color: T.blue,
      lineHeight: 22,
    },
  });