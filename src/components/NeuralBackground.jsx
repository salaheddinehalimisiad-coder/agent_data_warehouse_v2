import * as d3 from 'd3';
// src/components/NeuralBackground.jsx — High-End Generative Intelligence Background (V3 Premium)
import { useEffect, useRef } from 'react';

export default function NeuralBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let width, height;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener('resize', resize);
    resize();

    const nodeCount = 80;
    const nodes = d3.range(nodeCount).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: Math.random() * 2 + 1,
    }));

    const mouse = { x: -1000, y: -1000 };
    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      
      // Obsidian gradient background
      const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height));
      gradient.addColorStop(0, '#040408');
      gradient.addColorStop(1, '#000000');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      ctx.lineWidth = 0.5;

      for (let i = 0; i < nodeCount; i++) {
        const d = nodes[i];
        d.x += d.vx;
        d.y += d.vy;

        // Bounce
        if (d.x < 0 || d.x > width) d.vx *= -1;
        if (d.y < 0 || d.y > height) d.vy *= -1;

        // Mouse interaction
        const dx = d.x - mouse.x;
        const dy = d.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
          const force = (200 - dist) / 200;
          d.x += dx * force * 0.02;
          d.y += dy * force * 0.02;
        }

        // Connections
        for (let j = i + 1; j < nodeCount; j++) {
          const d2 = nodes[j];
          const dx2 = d.x - d2.x;
          const dy2 = d.y - d2.y;
          const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

          if (dist2 < 150) {
            const alpha = (150 - dist2) / 150 * 0.2;
            ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d2.x, d2.y);
            ctx.stroke();
          }
        }

        // Render point
        ctx.fillStyle = 'rgba(99, 102, 241, 0.4)';
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
        ctx.fill();
        
        if (isActiveNode(d, mouse)) {
             ctx.shadowBlur = 15;
             ctx.shadowColor = '#6366f1';
             ctx.fillStyle = '#fff';
             ctx.beginPath(); ctx.arc(d.x, d.y, d.radius * 1.5, 0, Math.PI*2); ctx.fill();
             ctx.shadowBlur = 0;
        }
      }

      requestAnimationFrame(animate);
    };

    function isActiveNode(d, mouse) {
        const dx = d.x - mouse.x;
        const dy = d.y - mouse.y;
        return Math.sqrt(dx*dx + dy*dy) < 50;
    }

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 pointer-events-none z-0 opacity-40 select-none grayscale contrast-125"
    />
  );
}
