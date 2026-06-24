'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * TEMPORARY diagnostic overlay — prints the real viewport metrics iOS reports
 * in standalone so we can size the shell/nav correctly. Remove once layout is fixed.
 */
export function DebugViewport() {
  const [info, setInfo] = useState('measuring…');
  const vh = useRef<HTMLDivElement>(null);
  const dvh = useRef<HTMLDivElement>(null);
  const sat = useRef<HTMLDivElement>(null);
  const sab = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const vv = window.visualViewport;
      const px = (el: HTMLDivElement | null) => Math.round(el?.getBoundingClientRect().height ?? 0);
      setInfo(
        [
          `inner ${window.innerHeight}  vv ${vv ? Math.round(vv.height) : '-'}`,
          `100vh ${px(vh.current)}  100dvh ${px(dvh.current)}`,
          `safe-top ${px(sat.current)}  safe-bot ${px(sab.current)}`,
          `screen ${screen.height}  standalone ${String((navigator as { standalone?: boolean }).standalone)}`,
        ].join('\n'),
      );
    };
    update();
    const id = setInterval(update, 500);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      clearInterval(id);
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  return (
    <>
      {/* hidden probes — their resolved heights are what we read */}
      <div ref={vh} style={{ position: 'fixed', visibility: 'hidden', height: '100vh', width: 1 }} />
      <div ref={dvh} style={{ position: 'fixed', visibility: 'hidden', height: '100dvh', width: 1 }} />
      <div ref={sat} style={{ position: 'fixed', visibility: 'hidden', height: 'env(safe-area-inset-top)', width: 1 }} />
      <div ref={sab} style={{ position: 'fixed', visibility: 'hidden', height: 'env(safe-area-inset-bottom)', width: 1 }} />
      <div
        style={{
          position: 'fixed',
          top: 'env(safe-area-inset-top)',
          left: 0,
          right: 0,
          zIndex: 100000,
          background: 'rgba(0,0,0,0.82)',
          color: '#5cff7a',
          font: '600 11px ui-monospace, monospace',
          lineHeight: 1.5,
          padding: '6px 8px',
          textAlign: 'center',
          whiteSpace: 'pre-wrap',
          pointerEvents: 'none',
        }}
      >
        {info}
      </div>
    </>
  );
}
