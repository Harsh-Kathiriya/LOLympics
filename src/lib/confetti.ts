"use client";

// src/lib/confetti.ts
// Utility helper functions to display celebratory effects using the `canvas-confetti` library.
// The helpers take care of dynamically importing the library (avoiding SSR issues) and
// provide two flavours:
// 1. `launchConfetti()`  – a quick burst suitable for events such as a single-round win.
// 2. `launchFireworks()` – a longer, grander show ideal for final-game celebrations.
// Each helper returns a cleanup function so React callers can stop the animation on unmount.

/**
 * Launch a one-off confetti burst.
 * Useful for single events like a round winner announcement.
 */
export async function launchConfetti() {
  const confetti = (await import("canvas-confetti")).default;

  // A nice, dense burst in the centre/bottom of the screen.
  confetti({
    particleCount: 150,
    spread: 70,
    startVelocity: 45,
    gravity: 0.9,
    origin: { y: 0.7 },
    zIndex: 1000,
  });

  // Return noop cleanup – kept for API symmetry with launchFireworks.
  return () => {};
}

/**
 * Launch a fire-work style celebration for a given duration (default 10s).
 * Returns a cleanup function that callers **must** invoke on unmount to
 * stop any pending animation frames.
 */
export async function launchFireworks(durationMs: number = 10000) {
  const confetti = (await import("canvas-confetti")).default;

  // ----------------------------
  // Continuous fire-work bursts
  // ----------------------------
  const animationEnd = Date.now() + durationMs;
  const fireworkDefaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 } as const;

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  const fireworkInterval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) {
      clearInterval(fireworkInterval);
      return;
    }

    const particleCount = 50 * (timeLeft / durationMs);

    // Left burst
    confetti({
      ...fireworkDefaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
    });
    // Right burst
    confetti({
      ...fireworkDefaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
    });
  }, 250);

  // ----------------------------
  // Star-shaped celebration
  // ----------------------------
  const starDefaults = {
    spread: 360,
    ticks: 50,
    gravity: 0,
    decay: 0.94,
    startVelocity: 30,
    colors: ["#FFE400", "#FFBD00", "#E89400", "#FFCA6C", "#FDFFB8"] as string[],
    zIndex: 1000,
  };

  const shoot = () => {
    confetti({
      ...starDefaults,
      particleCount: 40,
      scalar: 1.2,
      shapes: ["star"],
    });

    confetti({
      ...starDefaults,
      particleCount: 10,
      scalar: 0.75,
      shapes: ["circle"],
    });
  };

  // Fire a quick triple-burst of stars every 3 seconds.
  const starInterval = setInterval(() => {
    shoot();
    setTimeout(shoot, 100);
    setTimeout(shoot, 200);
  }, 3000);

  // Ensure star interval stops with the main animation.
  setTimeout(() => clearInterval(starInterval), durationMs);

  // ----------------------------
  // Cleanup – clear intervals if caller unmounts early.
  // ----------------------------
  const cleanup = () => {
    clearInterval(fireworkInterval);
    clearInterval(starInterval);
  };

  return cleanup;
} 