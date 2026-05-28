import React, { useMemo } from 'react';

const ParticlesAmbience = React.memo(() => {
  const particles = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      left: `${5 + Math.random() * 90}%`,
      delay: `${(Math.random() * 12).toFixed(1)}s`,
      duration: `${(12 + Math.random() * 16).toFixed(1)}s`,
    })),
  []);

  return (
    <>
      <style>{`
        @keyframes particle-rise {
          0%   { transform: translateY(100vh); opacity: 0; }
          10%  { opacity: 0.7; }
          90%  { opacity: 0.4; }
          100% { transform: translateY(-10vh); opacity: 0; }
        }
      `}</style>
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden h-screen opacity-20">
        {particles.map(p => (
          <div
            key={p.id}
            className="absolute bottom-0 w-1 h-1 bg-red-500 rounded-full shadow-[0_0_10px_rgba(220,38,38,1)]"
            style={{
              left: p.left,
              animation: `particle-rise ${p.duration} ${p.delay} infinite linear`,
            }}
          />
        ))}
      </div>
    </>
  );
});

export default ParticlesAmbience;
