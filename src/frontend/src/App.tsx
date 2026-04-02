import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

// ──────────────────────────────────────
// Types
// ──────────────────────────────────────
type GameScreen = "game" | "win" | "transition" | "next" | "reveal" | "letter";

interface FallingHeart {
  id: number;
  x: number;
  size: number;
  duration: number;
  startTime: number;
  popping: boolean;
}

interface ScorePopup {
  id: number;
  x: number;
  y: number;
}

interface ConfettiParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  isHeart: boolean;
}

interface StarParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
}

// ──────────────────────────────────────
// Constants
// ──────────────────────────────────────
const WIN_SCORE = 15;
const SPAWN_INTERVAL_MIN = 600;
const SPAWN_INTERVAL_MAX = 800;
const CONFETTI_COLORS = [
  "#F7A3B7",
  "#EA6D90",
  "#9A93BF",
  "#FFD6E0",
  "#F6C3B5",
  "#B8E0FF",
  "#FFDAB9",
];

const BG_HEARTS = [
  { x: 5, y: 10, size: 90, opacity: 0.12, blur: 3, delay: 0, dur: 7 },
  { x: 88, y: 6, size: 130, opacity: 0.09, blur: 5, delay: 1.5, dur: 9 },
  { x: 50, y: 20, size: 60, opacity: 0.16, blur: 1, delay: 2, dur: 6 },
  { x: 20, y: 60, size: 110, opacity: 0.08, blur: 4, delay: 0.5, dur: 11 },
  { x: 75, y: 55, size: 75, opacity: 0.13, blur: 2, delay: 3, dur: 8 },
  { x: 92, y: 75, size: 55, opacity: 0.18, blur: 0, delay: 1, dur: 7 },
  { x: 35, y: 85, size: 95, opacity: 0.1, blur: 3, delay: 4, dur: 10 },
  { x: 62, y: 40, size: 45, opacity: 0.2, blur: 0, delay: 2.5, dur: 5 },
  { x: 10, y: 40, size: 70, opacity: 0.11, blur: 2, delay: 3.5, dur: 8.5 },
  { x: 80, y: 30, size: 50, opacity: 0.15, blur: 1, delay: 0.8, dur: 6.5 },
];

const _DARK_HEART_COLORS = ["#6B5A8A", "#8A5A7A", "#5A6A8A"] as const;

const VIDEO_SRC =
  "/assets/6af749b6e0804fc9b1fae154ffbd5f65-019d4e6d-eb20-77ae-a3cb-cdf94571b3a9.mov";

// ──────────────────────────────────────
// Heart SVG Component
// ──────────────────────────────────────
function HeartSVG({
  size,
  color = "#F06B8A",
  glow = false,
}: { size: number; color?: string; glow?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="heart"
      style={glow ? { filter: `drop-shadow(0 0 8px ${color}99)` } : undefined}
    >
      <path
        d="M50 85 C50 85 5 52 5 27 C5 12 15 3 28 3 C37 3 44 8 50 16 C56 8 63 3 72 3 C85 3 95 12 95 27 C95 52 50 85 50 85Z"
        fill={color}
      />
    </svg>
  );
}

// ──────────────────────────────────────
// Web Audio Music
// ──────────────────────────────────────
function useGameMusic() {
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const oscRefs = useRef<OscillatorNode[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);

  const playNote = useCallback(
    (freq: number, startTime: number, duration: number) => {
      const ctx = ctxRef.current;
      const masterGain = gainRef.current;
      if (!ctx || !masterGain) return;

      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      osc.connect(noteGain);
      noteGain.connect(masterGain);

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);

      noteGain.gain.setValueAtTime(0, startTime);
      noteGain.gain.linearRampToValueAtTime(0.7, startTime + 0.08);
      noteGain.gain.setValueAtTime(0.7, startTime + duration - 0.1);
      noteGain.gain.linearRampToValueAtTime(0, startTime + duration);

      osc.start(startTime);
      osc.stop(startTime + duration);
      oscRefs.current.push(osc);
    },
    [],
  );

  const loopSequence = useCallback(() => {
    if (!activeRef.current) return;
    const ctx = ctxRef.current;
    if (!ctx) return;

    const notes = [
      { freq: 261.63, dur: 0.55 }, // C4
      { freq: 329.63, dur: 0.45 }, // E4
      { freq: 392.0, dur: 0.45 }, // G4
      { freq: 440.0, dur: 0.55 }, // A4
      { freq: 329.63, dur: 0.45 }, // E4
      { freq: 523.25, dur: 0.75 }, // C5
      { freq: 392.0, dur: 0.45 }, // G4
      { freq: 329.63, dur: 0.55 }, // E4
    ];

    let t = ctx.currentTime;
    const gap = 0.12;
    for (const note of notes) {
      playNote(note.freq, t, note.dur);
      t += note.dur + gap;
    }

    const loopDur = notes.reduce((acc, n) => acc + n.dur + gap, 0) * 1000;
    timeoutRef.current = setTimeout(loopSequence, loopDur - 100);
  }, [playNote]);

  const start = useCallback(() => {
    if (activeRef.current) return;
    try {
      const ctx = new AudioContext();
      ctxRef.current = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.06, ctx.currentTime);
      masterGain.connect(ctx.destination);
      gainRef.current = masterGain;

      const delay = ctx.createDelay(0.4);
      delay.delayTime.value = 0.3;
      const delayGain = ctx.createGain();
      delayGain.gain.value = 0.15;
      masterGain.connect(delay);
      delay.connect(delayGain);
      delayGain.connect(masterGain);

      activeRef.current = true;
      loopSequence();
    } catch {
      // AudioContext may fail silently
    }
  }, [loopSequence]);

  const stop = useCallback(() => {
    activeRef.current = false;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    for (const o of oscRefs.current) {
      try {
        o.stop();
      } catch {
        /* ignore */
      }
    }
    oscRefs.current = [];
    if (gainRef.current) {
      try {
        gainRef.current.gain.linearRampToValueAtTime(
          0,
          (ctxRef.current?.currentTime ?? 0) + 0.5,
        );
      } catch {
        /* ignore */
      }
    }
    setTimeout(() => {
      try {
        ctxRef.current?.close();
      } catch {
        /* ignore */
      }
      ctxRef.current = null;
      gainRef.current = null;
    }, 600);
  }, []);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { start, stop };
}

// ──────────────────────────────────────
// Confetti Generator
// ──────────────────────────────────────
function generateConfetti(): ConfettiParticle[] {
  return Array.from({ length: 24 }, (_, i) => ({
    id: i,
    x: 10 + Math.random() * 80,
    y: 5 + Math.random() * 30,
    size: 6 + Math.random() * 12,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    delay: Math.random() * 1.2,
    duration: 1.5 + Math.random() * 1.5,
    isHeart: Math.random() > 0.55,
  }));
}

// ──────────────────────────────────────
// Star Particles
// ──────────────────────────────────────
function generateStars(count = 35): StarParticle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 2 + Math.random() * 5,
    delay: Math.random() * 4,
    duration: 1.5 + Math.random() * 3,
  }));
}

// ──────────────────────────────────────
// Background Hearts Layer
// ──────────────────────────────────────
function BgHeartsLayer() {
  const heartColors = ["#F06B8A", "#FF9FB5", "#FFFFFF", "#E8A0B4", "#C9B8E8"];
  return (
    <>
      {BG_HEARTS.map((h, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: static config array, order never changes
          key={i}
          className="bg-heart"
          style={{
            left: `${h.x}%`,
            top: `${h.y}%`,
            opacity: h.opacity,
            filter: h.blur > 0 ? `blur(${h.blur}px)` : undefined,
            animationDuration: `${h.dur}s`,
            animationDelay: `${h.delay}s`,
          }}
        >
          <HeartSVG size={h.size} color={heartColors[i % heartColors.length]} />
        </div>
      ))}
    </>
  );
}

// ──────────────────────────────────────
// Game Screen
// ──────────────────────────────────────
function GameScreen({ onWin }: { onWin: () => void }) {
  const [hearts, setHearts] = useState<FallingHeart[]>([]);
  const [score, setScore] = useState(0);
  const [scorePopups, setScorePopups] = useState<ScorePopup[]>([]);
  const counterRef = useRef(0);
  const popupCounterRef = useRef(0);
  const scoreRef = useRef(0);
  const wonRef = useRef(false);
  const { start: startMusic } = useGameMusic();
  const musicStartedRef = useRef(false);

  const spawnHeart = useCallback(() => {
    if (wonRef.current) return;
    const id = ++counterRef.current;
    const x = 5 + Math.random() * 88;
    const size = 40 + Math.floor(Math.random() * 40);
    const duration = 2 + Math.random() * 2;
    setHearts((prev) => [
      ...prev,
      { id, x, size, duration, startTime: Date.now(), popping: false },
    ]);
    setTimeout(
      () => setHearts((prev) => prev.filter((h) => h.id !== id)),
      duration * 1000 + 200,
    );
  }, []);

  useEffect(() => {
    const scheduleNext = () => {
      const delay =
        SPAWN_INTERVAL_MIN +
        Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
      return setTimeout(() => {
        if (!wonRef.current) {
          spawnHeart();
          spawnTimeoutRef.current = scheduleNext();
        }
      }, delay);
    };

    spawnHeart();
    const spawnTimeoutRef = { current: scheduleNext() };
    return () => clearTimeout(spawnTimeoutRef.current);
  }, [spawnHeart]);

  const handleHeartClick = useCallback(
    (
      e: React.MouseEvent | React.TouchEvent | React.KeyboardEvent,
      heartId: number,
      heartX: number,
      heartY: number,
    ) => {
      e.stopPropagation();

      if (!musicStartedRef.current) {
        startMusic();
        musicStartedRef.current = true;
      }

      setHearts((prev) =>
        prev.map((h) => (h.id === heartId ? { ...h, popping: true } : h)),
      );
      setTimeout(
        () => setHearts((prev) => prev.filter((h) => h.id !== heartId)),
        350,
      );

      const popupId = ++popupCounterRef.current;
      setScorePopups((prev) => [
        ...prev,
        { id: popupId, x: heartX, y: heartY },
      ]);
      setTimeout(
        () => setScorePopups((prev) => prev.filter((p) => p.id !== popupId)),
        900,
      );

      setScore((prev) => {
        const next = prev + 1;
        scoreRef.current = next;
        if (next >= WIN_SCORE && !wonRef.current) {
          wonRef.current = true;
          setTimeout(onWin, 300);
        }
        return next;
      });
    },
    [startMusic, onWin],
  );

  const handleScreenInteract = useCallback(() => {
    if (!musicStartedRef.current) {
      startMusic();
      musicStartedRef.current = true;
    }
  }, [startMusic]);

  return (
    <div
      className="game-screen"
      onClick={handleScreenInteract}
      onKeyDown={handleScreenInteract}
      role="application"
      aria-label="Catch My Heart game area"
    >
      <BgHeartsLayer />

      {/* HUD */}
      <div className="game-hud">
        <div className="flex items-center gap-2">
          <HeartSVG size={18} color="#EA6D90" />
          <span
            className="font-semibold tracking-wide"
            style={{
              fontFamily: "'Playfair Display', serif",
              color: "#5A3045",
              fontSize: "1.1rem",
              textShadow: "0 1px 4px rgba(255,255,255,0.6)",
            }}
          >
            Level 1: Catch My Heart
          </span>
        </div>
        <div
          className="flex items-center gap-2 px-4 py-1.5 rounded-full"
          style={{
            background: "rgba(255,255,255,0.55)",
            boxShadow: "0 2px 10px rgba(234, 109, 144, 0.2)",
            border: "1px solid rgba(234, 109, 144, 0.3)",
          }}
          data-ocid="game.score.panel"
        >
          <HeartSVG size={16} color="#EA6D90" />
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              color: "#5A3045",
              fontSize: "0.95rem",
            }}
          >
            {score} / {WIN_SCORE}
          </span>
        </div>
      </div>

      {/* Tap to start hint */}
      {score === 0 && (
        <div
          className="absolute bottom-12 left-0 right-0 flex justify-center"
          style={{ pointerEvents: "none" }}
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="px-5 py-2 rounded-full"
            style={{
              background: "rgba(255,255,255,0.5)",
              color: "#5A3045",
              fontFamily: "Inter, sans-serif",
              fontSize: "0.875rem",
              backdropFilter: "blur(4px)",
              border: "1px solid rgba(234, 109, 144, 0.3)",
            }}
          >
            💖 Tap the hearts to catch them!
          </motion.div>
        </div>
      )}

      {/* Falling Hearts */}
      {hearts.map((heart) => (
        <button
          type="button"
          key={heart.id}
          className={`game-heart ${heart.popping ? "popping" : ""}`}
          style={{
            left: `${heart.x}%`,
            animationDuration: heart.popping ? "0.35s" : `${heart.duration}s`,
            background: "none",
            border: "none",
            padding: 0,
          }}
          onClick={(e) => {
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            handleHeartClick(e, heart.id, rect.left + rect.width / 2, rect.top);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              handleHeartClick(e, heart.id, 0, 0);
            }
          }}
          onTouchStart={(e) => {
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            handleHeartClick(e, heart.id, rect.left + rect.width / 2, rect.top);
          }}
          aria-label="Catch this heart"
          data-ocid="game.heart.item"
        >
          <HeartSVG
            size={heart.size}
            color={`hsl(${340 + Math.sin(heart.id * 137.5) * 25}, ${65 + (heart.id % 3) * 8}%, ${58 + (heart.id % 4) * 5}%)`}
            glow
          />
        </button>
      ))}

      {/* Score Popups */}
      {scorePopups.map((popup) => (
        <div
          key={popup.id}
          className="score-popup"
          style={{ left: popup.x - 15, top: popup.y - 20 }}
        >
          +1 💖
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────
// Win Screen
// ──────────────────────────────────────
function WinScreen({ onContinue }: { onContinue: () => void }) {
  const [showSubtext, setShowSubtext] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [confetti] = useState<ConfettiParticle[]>(() => generateConfetti());

  useEffect(() => {
    const t1 = setTimeout(() => setShowSubtext(true), 1000);
    const t2 = setTimeout(() => setShowButton(true), 1700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="win-overlay" data-ocid="win.dialog">
      {/* Confetti / heart particles */}
      {confetti.map((p) => (
        <div
          key={p.id}
          className="confetti-particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: p.isHeart ? "transparent" : p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        >
          {p.isHeart && <HeartSVG size={p.size} color={p.color} />}
        </div>
      ))}

      {/* Win Card */}
      <div
        className="win-card relative mx-4"
        style={{
          background:
            "linear-gradient(160deg, #9A93BF 0%, #C4ABCF 30%, #F0C4C4 65%, #F6C3B5 100%)",
          borderRadius: "24px",
          padding: "40px 48px 48px",
          maxWidth: 500,
          width: "100%",
          boxShadow:
            "0 24px 80px rgba(90, 48, 69, 0.28), 0 8px 32px rgba(154, 147, 191, 0.3), inset 0 1px 0 rgba(255,255,255,0.6)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Inner glow overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "24px",
            background:
              "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.35) 0%, transparent 60%)",
            pointerEvents: "none",
          }}
        />

        {/* Score Badge */}
        <div
          className="absolute top-5 left-5 flex flex-col gap-0.5"
          style={{
            background: "rgba(255,255,255,0.7)",
            backdropFilter: "blur(8px)",
            borderRadius: "12px",
            padding: "8px 14px",
            border: "1px solid rgba(234, 109, 144, 0.3)",
            boxShadow: "0 2px 12px rgba(154, 147, 191, 0.25)",
          }}
          data-ocid="win.score.panel"
        >
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              color: "#5A3045",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Score
          </span>
          <span
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "1.1rem",
              fontWeight: 700,
              color: "#EA6D90",
            }}
          >
            {WIN_SCORE} / {WIN_SCORE} 💖
          </span>
        </div>

        {/* Illustration */}
        <div className="flex justify-center mb-4 mt-6">
          <div
            style={{
              width: 180,
              height: 160,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "5rem",
              boxShadow: "0 4px 24px rgba(234, 109, 144, 0.25)",
            }}
          >
            💑
          </div>
        </div>

        <div className="absolute top-6 right-8" style={{ fontSize: "1.2rem" }}>
          ✨
        </div>
        <div
          className="absolute top-14 right-5"
          style={{ fontSize: "0.85rem" }}
        >
          ⭐
        </div>
        <div
          className="absolute bottom-20 left-6"
          style={{ fontSize: "0.9rem" }}
        >
          ✨
        </div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(2.4rem, 6vw, 3.2rem)",
            fontWeight: 700,
            color: "#2B2B2B",
            textAlign: "center",
            lineHeight: 1.15,
            marginBottom: "12px",
            textShadow: "0 2px 8px rgba(255,255,255,0.5)",
          }}
          data-ocid="win.headline"
        >
          You win 💖
        </motion.h1>

        {/* Subtext */}
        <AnimatePresence>
          {showSubtext && (
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              style={{
                fontFamily: "'Playfair Display', serif",
                fontStyle: "italic",
                fontSize: "clamp(1rem, 2.5vw, 1.2rem)",
                color: "#5A3045",
                textAlign: "center",
                marginBottom: "28px",
                opacity: 0.88,
              }}
              data-ocid="win.subtext"
            >
              But this wasn't the real game…
            </motion.p>
          )}
        </AnimatePresence>

        {/* Continue button */}
        <AnimatePresence>
          {showButton && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="flex justify-center"
            >
              <button
                type="button"
                className="cta-glow"
                onClick={onContinue}
                style={{
                  background:
                    "linear-gradient(135deg, #F7A3B7 0%, #EA6D90 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "9999px",
                  padding: "14px 40px",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  fontFamily: "Inter, sans-serif",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase" as const,
                  cursor: "pointer",
                  transition: "transform 0.2s ease",
                  position: "relative" as const,
                }}
                data-ocid="win.continue_button"
              >
                Continue →
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ──────────────────────────────────────
// Transition (Fade to Black)
// ──────────────────────────────────────
function TransitionOverlay({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 900);
    return () => clearTimeout(t);
  }, [onDone]);

  return <div className="transition-to-black" data-ocid="transition.overlay" />;
}

// ──────────────────────────────────────
// Dark Scene Stars Layer
// ──────────────────────────────────────
function DarkStarsLayer() {
  const [stars] = useState<StarParticle[]>(() => generateStars(80));
  const [orbs] = useState<StarParticle[]>(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: 1000 + i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 30 + Math.random() * 60,
      delay: Math.random() * 6,
      duration: 4 + Math.random() * 5,
    })),
  );

  return (
    <>
      {stars.map((star) => (
        <div
          key={star.id}
          className="star-particle"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(200, 180, 255, 0.85) 0%, transparent 70%)",
            animationDelay: `${star.delay}s`,
            animationDuration: `${star.duration}s`,
          }}
        />
      ))}
      {orbs.map((orb) => (
        <div
          key={orb.id}
          className="glow-orb"
          style={{
            left: `${orb.x}%`,
            top: `${orb.y}%`,
            width: orb.size,
            height: orb.size,
            background:
              "radial-gradient(circle, rgba(160, 120, 255, 0.35) 0%, rgba(120, 80, 200, 0.12) 50%, transparent 75%)",
            animationDelay: `${orb.delay}s`,
            animationDuration: `${orb.duration}s`,
          }}
        />
      ))}
    </>
  );
}

// ──────────────────────────────────────
// Reveal Scene
// ──────────────────────────────────────
function RevealScene({ onContinue }: { onContinue: () => void }) {
  const [isGlitching, setIsGlitching] = useState(true);
  const [showLine1, setShowLine1] = useState(false);
  const [showLine2, setShowLine2] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Remove glitch after 700ms
    timers.push(setTimeout(() => setIsGlitching(false), 700));
    // First line at 900ms
    timers.push(setTimeout(() => setShowLine1(true), 900));
    // Second line at 3000ms
    timers.push(setTimeout(() => setShowLine2(true), 3000));
    // Video at 5500ms
    timers.push(setTimeout(() => setShowVideo(true), 5500));
    // Continue button at 7000ms
    timers.push(setTimeout(() => setShowButton(true), 7000));

    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, []);

  // Sync muted state with video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  return (
    <div
      className={`reveal-scene${isGlitching ? " glitch-active" : ""}`}
      data-ocid="reveal.panel"
    >
      {/* Central radial glow */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(120, 80, 200, 0.14) 0%, rgba(80, 40, 160, 0.06) 50%, transparent 75%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />

      <DarkStarsLayer />

      {/* Main content */}
      <div
        className="relative flex flex-col items-center gap-6 px-8 text-center"
        style={{ zIndex: 10, maxWidth: 720, width: "100%" }}
      >
        {/* Line 1 */}
        <AnimatePresence>
          {showLine1 && (
            <motion.p
              key="line1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(1.8rem, 5vw, 2.5rem)",
                fontWeight: 400,
                color: "rgba(230, 215, 255, 0.95)",
                letterSpacing: "0.03em",
                lineHeight: 1.3,
                textShadow:
                  "0 0 30px rgba(180, 140, 255, 0.4), 0 2px 8px rgba(0,0,0,0.5)",
                margin: 0,
              }}
              data-ocid="reveal.line1"
            >
              You already won.
            </motion.p>
          )}
        </AnimatePresence>

        {/* Line 2 */}
        <AnimatePresence>
          {showLine2 && (
            <motion.p
              key="line2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              style={{
                fontFamily: "'Playfair Display', serif",
                fontStyle: "italic",
                fontSize: "clamp(1.2rem, 3vw, 1.6rem)",
                fontWeight: 400,
                color: "rgba(200, 180, 240, 0.85)",
                letterSpacing: "0.04em",
                lineHeight: 1.4,
                textShadow:
                  "0 0 20px rgba(160, 120, 255, 0.35), 0 2px 6px rgba(0,0,0,0.4)",
                margin: 0,
              }}
              data-ocid="reveal.line2"
            >
              This was always meant for you.
            </motion.p>
          )}
        </AnimatePresence>

        {/* Video Player */}
        <AnimatePresence>
          {showVideo && (
            <motion.div
              key="video"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.0, ease: "easeOut" }}
              style={{ width: "100%", maxWidth: 640, position: "relative" }}
              data-ocid="reveal.panel"
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  borderRadius: 16,
                  overflow: "hidden",
                  boxShadow:
                    "0 8px 40px rgba(0,0,0,0.7), 0 0 60px rgba(180,140,255,0.15)",
                  background: "#000",
                }}
              >
                <video
                  ref={videoRef}
                  src={VIDEO_SRC}
                  autoPlay
                  muted
                  playsInline
                  controls={false}
                  style={{
                    width: "100%",
                    display: "block",
                    borderRadius: 16,
                    maxHeight: "60vh",
                    objectFit: "contain",
                  }}
                />

                {/* Mute/Unmute Toggle */}
                <button
                  type="button"
                  onClick={() => setIsMuted((m) => !m)}
                  style={{
                    position: "absolute",
                    bottom: 12,
                    right: 12,
                    background: "rgba(10, 8, 20, 0.75)",
                    backdropFilter: "blur(8px)",
                    border: "1px solid rgba(180, 140, 255, 0.35)",
                    color: "rgba(220, 200, 255, 0.9)",
                    borderRadius: 9999,
                    padding: "6px 14px",
                    fontSize: "0.8rem",
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 500,
                    cursor: "pointer",
                    zIndex: 20,
                    transition: "background 0.2s ease, border-color 0.2s ease",
                  }}
                  data-ocid="reveal.toggle"
                >
                  {isMuted ? "🔇 Unmute" : "🔊 Mute"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Continue Button */}
        <AnimatePresence>
          {showButton && (
            <motion.div
              key="btn"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <button
                type="button"
                className="cta-dark-glow"
                onClick={onContinue}
                style={{
                  background:
                    "linear-gradient(135deg, rgba(180,140,255,0.15), rgba(140,100,220,0.25))",
                  border: "1px solid rgba(180,140,255,0.4)",
                  color: "rgba(230, 215, 255, 0.95)",
                  borderRadius: 9999,
                  padding: "14px 48px",
                  fontSize: "0.95rem",
                  fontWeight: 500,
                  fontFamily: "'Playfair Display', serif",
                  letterSpacing: "0.1em",
                  cursor: "pointer",
                  transition: "transform 0.2s ease, background 0.2s ease",
                }}
                data-ocid="reveal.continue_button"
              >
                Continue
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer
        className="absolute bottom-6 left-0 right-0 flex justify-center"
        style={{ pointerEvents: "none", zIndex: 10 }}
      >
        <p
          style={{
            color: "rgba(150, 130, 180, 0.45)",
            fontSize: "0.75rem",
            fontFamily: "Inter, sans-serif",
          }}
        >
          © {new Date().getFullYear()}. Built with{" "}
          <span style={{ color: "rgba(200, 140, 180, 0.6)" }}>♥</span> using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "rgba(180, 140, 220, 0.65)",
              pointerEvents: "auto",
            }}
          >
            caffeine.ai
          </a>
        </p>
      </footer>
    </div>
  );
}

// ──────────────────────────────────────
// Final Letter Scene
// ──────────────────────────────────────

interface LetterLine {
  id?: string;
  text: string;
  type: "text" | "spacer" | "closing";
  delay: number;
}

const LETTER_LINES: LetterLine[] = [
  { text: "Hey…", type: "text", delay: 600 },
  { text: "", type: "spacer", delay: 1700 },
  { text: "One day, our eyes met.", type: "text", delay: 2000 },
  { text: "We exchanged our names…", type: "text", delay: 3100 },
  { text: "and something magical began.", type: "text", delay: 4200 },
  { text: "", type: "spacer", delay: 5200 },
  { text: "It’s been 5 months.", type: "text", delay: 5600 },
  { text: "", type: "spacer", delay: 6600 },
  { text: "150 days…", type: "text", delay: 7000 },
  {
    text: "and somehow, every single one mattered.",
    type: "text",
    delay: 8100,
  },
  { text: "", type: "spacer", delay: 9100 },
  { text: "You didn’t just come into my life…", type: "text", delay: 9500 },
  { text: "you changed it.", type: "text", delay: 10700 },
  { text: "", type: "spacer", delay: 11700 },
  { text: "And if I could do it all again…", type: "text", delay: 12100 },
  { text: "", type: "spacer", delay: 13100 },
  { text: "I’d choose you faster.", type: "text", delay: 13500 },
  { text: "", type: "spacer", delay: 14700 },
  {
    text: "5 months down… and this is just the beginning.",
    type: "closing",
    delay: 15100,
  },
];

const BUTTON_DELAY = 17000;

function FinalLetterScene({ onPlayAgain }: { onPlayAgain: () => void }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showButton, setShowButton] = useState(false);
  const [showStillChoose, setShowStillChoose] = useState(false);
  const [hideButton, setHideButton] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    LETTER_LINES.forEach((line, i) => {
      timers.push(
        setTimeout(() => {
          setVisibleCount((prev) => Math.max(prev, i + 1));
          if (containerRef.current) {
            containerRef.current.scrollTo({
              top: containerRef.current.scrollHeight,
              behavior: "smooth",
            });
          }
        }, line.delay),
      );
    });

    timers.push(setTimeout(() => setShowButton(true), BUTTON_DELAY));

    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, []);

  const handlePlayAgain = () => {
    setHideButton(true);
    setTimeout(() => setShowStillChoose(true), 400);
    setTimeout(() => onPlayAgain(), 2800);
  };

  return (
    <div className="letter-scene-cream" data-ocid="letter.panel">
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 60% at 50% 45%, rgba(220,160,140,0.13) 0%, rgba(230,190,180,0.07) 40%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div
        ref={containerRef}
        className="letter-scroll-area"
        style={{ zIndex: 1 }}
      >
        <div className="letter-content-inner">
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
            style={{
              textAlign: "center",
              marginBottom: "1.5rem",
              fontSize: "1.8rem",
            }}
            aria-hidden="true"
          >
            &#x1F48C;
          </motion.div>

          {LETTER_LINES.map((line, i) => {
            const visible = visibleCount > i;

            if (line.type === "spacer") {
              return (
                <div
                  key={line.id}
                  style={{
                    height: visible ? "1.1rem" : "0",
                    transition: "height 0.4s ease",
                  }}
                />
              );
            }

            const isClosing = line.type === "closing";

            return (
              <AnimatePresence key={line.id}>
                {visible && (
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.85, ease: "easeOut" }}
                    className={
                      isClosing ? "letter-line-closing" : "letter-line-body"
                    }
                  >
                    {line.text}
                  </motion.p>
                )}
              </AnimatePresence>
            );
          })}

          <div
            style={{
              marginTop: "2.5rem",
              textAlign: "center",
              minHeight: "5rem",
            }}
          >
            <AnimatePresence>
              {showButton && !hideButton && (
                <motion.button
                  key="play-again-btn"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  className="letter-play-again-btn"
                  onClick={handlePlayAgain}
                  data-ocid="letter.primary_button"
                  type="button"
                >
                  Play again?
                </motion.button>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showStillChoose && (
                <motion.p
                  key="still-choose"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                  className="letter-still-choose"
                  data-ocid="letter.success_state"
                >
                  I&rsquo;d still choose you.
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <footer className="letter-footer">
            <p>
              &copy; {new Date().getFullYear()}. Built with{" "}
              <span style={{ color: "#9b4d63" }}>&hearts;</span> using{" "}
              <a
                href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#7d3c52", pointerEvents: "auto" }}
              >
                caffeine.ai
              </a>
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────
// Root App
// ──────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<GameScreen>("game");
  const [showWin, setShowWin] = useState(false);

  const handleWin = useCallback(() => setShowWin(true), []);

  const handleContinue = useCallback(() => {
    setShowWin(false);
    setScreen("transition");
  }, []);

  const handleTransitionDone = useCallback(() => setScreen("reveal"), []);

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <AnimatePresence mode="wait">
        {screen === "game" && (
          <motion.div
            key="game"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{ position: "absolute", inset: 0 }}
          >
            <GameScreen onWin={handleWin} />
            {showWin && <WinScreen onContinue={handleContinue} />}
          </motion.div>
        )}

        {screen === "transition" && (
          <motion.div
            key="transition"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            style={{ position: "absolute", inset: 0 }}
          >
            <TransitionOverlay onDone={handleTransitionDone} />
          </motion.div>
        )}

        {screen === "next" && (
          <motion.div
            key="next"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            style={{ position: "absolute", inset: 0 }}
          >
            <RevealScene onContinue={() => setScreen("letter")} />
          </motion.div>
        )}

        {screen === "reveal" && (
          <motion.div
            key="reveal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            style={{ position: "absolute", inset: 0 }}
          >
            <RevealScene onContinue={() => setScreen("letter")} />
          </motion.div>
        )}

        {screen === "letter" && (
          <motion.div
            key="letter"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{ position: "absolute", inset: 0 }}
          >
            <FinalLetterScene
              onPlayAgain={() => {
                setScreen("game");
                setShowWin(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
