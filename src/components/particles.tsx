"use client";

import React from 'react';

/**
 * Particles background component.
 *
 * Render a collection of animated circles using randomised positions,
 * sizes and animation timings. This component is **client-side only** and
 * should be imported with `next/dynamic({ ssr: false })` to avoid server ↔︎
 * client hydration mismatches caused by `Math.random()`.
 */
export default function Particles() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      {Array.from({ length: 35 }).map((_, i) => (
        <div
          /* eslint-disable react/no-array-index-key */
          key={i}
          className="particle absolute rounded-full bg-primary/10"
          style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            width: `${Math.random() * 20 + 5}px`,
            height: `${Math.random() * 20 + 5}px`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${Math.random() * 10 + 10}s`,
          }}
        />
      ))}
    </div>
  );
} 