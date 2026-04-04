'use client';
import { motion } from 'framer-motion';

// npm install framer-motion

export default function FloatingCard({ file, lang, pct, delay = 0, yOffset = 0 }) {
  return (
    <motion.div
      initial={{ y: yOffset, opacity: 0 }}
      animate={{ 
        y: [yOffset, yOffset - 20, yOffset],
        opacity: 1 
      }}
      transition={{
        y: {
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: delay
        },
        opacity: { duration: 0.8, delay: delay }
      }}
      style={{
        background: '#11132d',
        padding: '20px',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.08)',
        width: '340px',
        marginBottom: '20px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        color: 'white'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '12px' }}>
        <span style={{ fontWeight: '600' }}>{file}</span>
        <span style={{ color: '#8a3ffc', background: 'rgba(138, 63, 252, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
          Translating...
        </span>
      </div>
      <div style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '15px' }}>{lang}</div>
      <div style={{ height: '6px', background: '#1e2044', borderRadius: '10px', overflow: 'hidden' }}>
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.5, delay: delay + 0.5 }}
          style={{ height: '100%', background: '#8a3ffc', boxShadow: '0 0 10px #8a3ffc' }} 
        />
      </div>
      <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#9499c3', marginTop: '8px' }}>
        {pct}% complete
      </div>
    </motion.div>
  );
}