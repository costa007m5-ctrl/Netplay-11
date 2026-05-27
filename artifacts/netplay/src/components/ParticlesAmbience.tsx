import React, { useMemo } from 'react';
import { motion } from 'motion/react';

const ParticlesAmbience = React.memo(() => {
  const configs = useMemo(() =>
    Array.from({ length: 15 }, () => ({
      x1: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1920),
      x2: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1920),
      duration: 10 + Math.random() * 20,
      delay: Math.random() * 10,
    })),
  []);

  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden h-screen opacity-20">
      {configs.map((c, i) => (
        <motion.div
          key={i}
          initial={{ y: '100vh', x: c.x1, opacity: 0 }}
          animate={{ y: '-10vh', x: c.x2, opacity: [0, 1, 0] }}
          transition={{ duration: c.duration, repeat: Infinity, ease: 'linear', delay: c.delay }}
          className="absolute w-1 h-1 bg-red-500 rounded-full shadow-[0_0_10px_rgba(220,38,38,1)]"
        />
      ))}
    </div>
  );
});

export default ParticlesAmbience;
