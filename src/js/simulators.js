// Physics Simulator Drawing Logic

    function drawFluxSim(angleDeg, B, A_cm2) {
      const container = document.getElementById('sim-flux-svg-container');
      if (!container) return;
      const angle = angleDeg * Math.PI / 180;
      const w = 40 + A_cm2 * 0.4;
      const h = 40 + A_cm2 * 0.3;
      const X_c = 180, Y_c = 120;
      const getProj = (u, v) => {
        const x = u * Math.cos(angle);
        const z = u * Math.sin(angle);
        return { x: X_c + x - z * 0.4, y: Y_c + v - z * 0.2 };
      };
      const c1 = getProj(-w, -h), c2 = getProj(w, -h), c3 = getProj(w, h), c4 = getProj(-w, h);
      const x_normal = 50 * Math.sin(angle);
      const z_normal = 50 * Math.cos(angle);
      const X_n = X_c - x_normal + z_normal * 0.4;
      const Y_n = Y_c - z_normal * 0.2 - 40;
      const numLines = Math.round(B * 6) + 2;
      let fieldLinesHTML = '';
      for (let i = 0; i < numLines; i++) {
        const yLine = 50 + (i * 140 / (numLines - 1));
        const opacity = Math.sin(angle) * 0.6 + 0.4;
        fieldLinesHTML += `<line x1="40" y1="${yLine}" x2="320" y2="${yLine}" stroke="rgba(239,68,68,${opacity})" stroke-width="2.5" marker-end="url(#arrow-red)"/>`;
      }
      container.innerHTML = `
    <svg viewBox="0 0 360 240" class="w-full max-w-sm h-auto">
      <defs>
        <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <marker id="arrow-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#ef4444" />
        </marker>
        <marker id="arrow-gold" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#f59e0b" />
        </marker>
      </defs>
      <rect width="100%" height="100%" rx="16" fill="#090d16"/>
      ${fieldLinesHTML}
      <line x1="${X_c}" y1="30" x2="${X_c}" y2="210" stroke="#4b5563" stroke-width="1.5" stroke-dasharray="4 4"/>
      <text x="${X_c}" y="25" fill="#9ca3af" font-size="10" text-anchor="middle">แกนหมุน</text>
      <polygon points="${c1.x},${c1.y} ${c2.x},${c2.y} ${c3.x},${c3.y} ${c4.x},${c4.y}" fill="rgba(6, 182, 212, 0.2)" stroke="#22d3ee" stroke-width="3" filter="url(#glow-cyan)"/>
      <text x="${c1.x - 10}" y="${c1.y}" fill="#22d3ee" font-size="10">A</text>
      <line x1="${X_c}" y1="${Y_c}" x2="${X_n}" y2="${Y_n}" stroke="#f59e0b" stroke-width="2.5" marker-end="url(#arrow-gold)"/>
      <text x="${X_n + 10}" y="${Y_n}" fill="#f59e0b" font-size="10" font-weight="bold">vector A</text>
      <path d="M ${X_c + 20} ${Y_c} A 20 20 0 0 0 ${X_c + 20 * Math.cos(angle)} ${Y_c - 20 * Math.sin(angle)}" fill="none" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="${X_c + 25}" y="${Y_c - 10}" fill="#f59e0b" font-size="10">θ</text>
    </svg>
  `;
    }


    function drawChargeSim(chargeType, vVal, BVal) {
      const container = document.getElementById('sim-charge-svg-container');
      if (!container) return;
      const opacity = BVal / 8.0;
      let gridHTML = '';
      for (let x = 100; x <= 300; x += 50) {
        for (let y = 50; y <= 190; y += 45) {
          gridHTML += `
        <g opacity="${opacity}">
          <circle cx="${x}" cy="${y}" r="6" fill="none" stroke="#6366f1" stroke-width="1"/>
          <line x1="${x - 3}" y1="${y - 3}" x2="${x + 3}" y2="${y + 3}" stroke="#6366f1" stroke-width="1"/>
          <line x1="${x + 3}" y1="${y - 3}" x2="${x - 3}" y2="${y + 3}" stroke="#6366f1" stroke-width="1"/>
        </g>
      `;
        }
      }
      const R = (vVal / BVal) * 160;
      const isPositive = chargeType === 'positive';
      const sweep = isPositive ? 0 : 1;
      const thetaMax = Math.min(1.2, 220 / R);
      const xEnd = 100 + R * Math.sin(thetaMax);
      const yEnd = isPositive ? 120 - R * (1 - Math.cos(thetaMax)) : 120 + R * (1 - Math.cos(thetaMax));
      const pathD = `M 40,120 L 100,120 A ${R},${R} 0 0,${sweep} ${xEnd},${yEnd}`;
      container.innerHTML = `
    <svg viewBox="0 0 360 240" class="w-full max-w-sm h-auto">
      <defs>
        <filter id="glow-indigo" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width="100%" height="100%" rx="16" fill="#090d16"/>
      <rect x="80" y="20" width="260" height="200" rx="8" fill="rgba(99, 102, 241, 0.05)" stroke="rgba(99, 102, 241, 0.2)" stroke-dasharray="3 3"/>
      <text x="210" y="35" fill="rgba(99, 102, 241, 0.6)" font-size="8" text-anchor="middle">สนามแม่เหล็กพุ่งเข้าหน้าจอ (⊗)</text>
      ${gridHTML}
      <rect x="15" y="105" width="40" height="30" rx="4" fill="#374151" stroke="#4b5563"/>
      <rect x="55" y="115" width="15" height="10" fill="#1f2937" stroke="#374151"/>
      <text x="35" y="123" fill="#9ca3af" font-size="7" text-anchor="middle">ปืนยิงประจุ</text>
      <path id="traj-path" d="${pathD}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2" stroke-dasharray="4 4"/>
      <path d="${pathD}" fill="none" stroke="${isPositive ? '#10b981' : '#ec4899'}" stroke-width="3.5" filter="url(#glow-indigo)"/>
      <circle r="7" fill="${isPositive ? '#34d399' : '#f472b6'}" filter="url(#glow-indigo)">
        <animateMotion dur="2.5s" repeatCount="indefinite" path="${pathD}" />
      </circle>
      <line x1="60" y1="120" x2="90" y2="120" stroke="#f59e0b" stroke-width="2" marker-end="url(#arrow-gold)"/>
      <text x="75" y="112" fill="#f59e0b" font-size="9">v</text>
    </svg>
  `;
    }


    function drawWireSimStatic(xPos, I, B, l_cm) {
      const container = document.getElementById('sim-wire-svg-container');
      if (!container) return;
      let gridHTML = '';
      for (let x = 70; x <= 290; x += 40) {
        for (let y = 65; y <= 175; y += 50) {
          gridHTML += `
        <g opacity="0.3">
          <circle cx="${x}" cy="${y}" r="5" fill="none" stroke="#a78bfa" stroke-width="1"/>
          <line x1="${x - 2.5}" y1="${y - 2.5}" x2="${x + 2.5}" y2="${y + 2.5}" stroke="#a78bfa" stroke-width="1"/>
          <line x1="${x + 2.5}" y1="${y - 2.5}" x2="${x - 2.5}" y2="${y + 2.5}" stroke="#a78bfa" stroke-width="1"/>
        </g>
      `;
        }
      }
      const l_m = l_cm * 1e-2;
      const force = I * l_m * B;
      const arrowLen = Math.min(100, force * 600);
      container.innerHTML = `
    <svg viewBox="0 0 360 240" class="w-full max-w-sm h-auto">
      <defs>
        <marker id="arrow-blue" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#3b82f6" />
        </marker>
      </defs>
      <rect width="100%" height="100%" rx="16" fill="#090d16"/>
      <rect x="60" y="40" width="250" height="160" rx="8" fill="rgba(167, 139, 250, 0.05)" stroke="rgba(167, 139, 250, 0.2)" stroke-dasharray="3 3"/>
      <text x="185" y="32" fill="rgba(167, 139, 250, 0.6)" font-size="8" text-anchor="middle">สนามแม่เหล็ก B ทิศพุ่งเข้า (⊗)</text>
      ${gridHTML}
      <line x1="40" y1="80" x2="320" y2="80" stroke="#9ca3af" stroke-width="6"/>
      <line x1="40" y1="160" x2="320" y2="160" stroke="#9ca3af" stroke-width="6"/>
      <text x="35" y="75" fill="#9ca3af" font-size="8">รางบน (+)</text>
      <text x="35" y="175" fill="#9ca3af" font-size="8">รางล่าง (-)</text>
      <rect x="${xPos - 4}" y="65" width="8" height="110" rx="2" fill="#d97706" stroke="#b45309" stroke-width="1.5"/>
      <text x="${xPos}" y="60" fill="#fbbf24" font-size="10" font-weight="bold" text-anchor="middle">P</text>
      <text x="${xPos}" y="190" fill="#fbbf24" font-size="10" font-weight="bold" text-anchor="middle">Q</text>
      <line x1="${xPos}" y1="90" x2="${xPos}" y2="115" stroke="#fbbf24" stroke-width="2" marker-end="url(#arrow-gold)"/>
      <text x="${xPos - 12}" y="105" fill="#fbbf24" font-size="8">I</text>
      ${arrowLen > 5 ? `<line x1="${xPos + 4}" y1="120" x2="${xPos + 4 + arrowLen}" y2="120" stroke="#3b82f6" stroke-width="3" marker-end="url(#arrow-blue)"/>
      <text x="${xPos + 10 + arrowLen / 2}" y="115" fill="#3b82f6" font-size="9" font-weight="bold">F</text>` : ''}
    </svg>
  `;
    }


    function drawMomentSim(angleDeg, N, I) {
      const container = document.getElementById('sim-moment-svg-container');
      if (!container) return;
      const angle = angleDeg * Math.PI / 180;
      const X_c = 130, Y_c = 100;
      const w = 45;
      const h = 40;
      const getProj = (u, v) => {
        const x = u * Math.sin(angle);
        const z = -u * Math.cos(angle);
        return { x: X_c + x + z * 0.4, y: Y_c + v + z * 0.2 };
      };
      const c1 = getProj(-w, -h), c2 = getProj(w, -h), c3 = getProj(w, h), c4 = getProj(-w, h);
      const fLen = I * 4;
      const graphXStart = 330;
      const graphYZero = 100;
      let cosPoints = '';
      for (let th = 0; th <= 180; th += 5) {
        const r = th * Math.PI / 180;
        const gx = graphXStart + (th / 180) * 180;
        const gy = graphYZero - 50 * Math.cos(r);
        cosPoints += `${gx},${gy} `;
      }
      const dotX = graphXStart + (angleDeg / 180) * 180;
      const dotY = graphYZero - 50 * Math.cos(angle);
      container.innerHTML = `
    <svg viewBox="0 0 540 200" class="w-full h-auto">
      <defs>
        <filter id="glow-violet" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <marker id="arrow-violet" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#a78bfa" />
        </marker>
      </defs>
      <rect width="100%" height="100%" rx="16" fill="#090d16"/>
      <text x="130" y="25" fill="#a78bfa" font-size="10" font-weight="bold" text-anchor="middle">จำลองขดลวดหมุน</text>
      <line x1="30" y1="60" x2="230" y2="60" stroke="rgba(239, 68, 68, 0.3)" stroke-width="1.5" marker-end="url(#arrow-red)"/>
      <line x1="30" y1="100" x2="230" y2="100" stroke="rgba(239, 68, 68, 0.3)" stroke-width="1.5" marker-end="url(#arrow-red)"/>
      <line x1="30" y1="140" x2="230" y2="140" stroke="rgba(239, 68, 68, 0.3)" stroke-width="1.5" marker-end="url(#arrow-red)"/>
      <line x1="${X_c}" y1="35" x2="${X_c}" y2="165" stroke="#4b5563" stroke-width="1.5" stroke-dasharray="4 4"/>
      <polygon points="${c1.x},${c1.y} ${c2.x},${c2.y} ${c3.x},${c3.y} ${c4.x},${c4.y}" fill="rgba(139, 92, 246, 0.2)" stroke="#a78bfa" stroke-width="2.5" filter="url(#glow-violet)"/>
      <line x1="${c1.x}" y1="${c1.y}" x2="${c1.x}" y2="${c1.y - fLen}" stroke="#fbbf24" stroke-width="2" marker-end="url(#arrow-gold)"/>
      <text x="${c1.x}" y="${c1.y - fLen - 4}" fill="#fbbf24" font-size="8" text-anchor="middle">F</text>
      <line x1="${c3.x}" y1="${c3.y}" x2="${c3.x}" y2="${c3.y + fLen}" stroke="#fbbf24" stroke-width="2" marker-end="url(#arrow-gold)"/>
      <text x="${c3.x}" y="${c3.y + fLen + 10}" fill="#fbbf24" font-size="8" text-anchor="middle">F</text>
      <text x="420" y="25" fill="#a78bfa" font-size="10" font-weight="bold" text-anchor="middle">แผนภูมิความสัมพันธ์ M - θ (Cos)</text>
      <line x1="${graphXStart}" y1="${graphYZero}" x2="${graphXStart + 190}" y2="${graphYZero}" stroke="#9ca3af" stroke-width="1"/>
      <line x1="${graphXStart}" y1="35" x2="${graphXStart}" y2="165" stroke="#9ca3af" stroke-width="1"/>
      <text x="${graphXStart + 195}" y="${graphYZero + 3}" fill="#9ca3af" font-size="8">θ</text>
      <text x="${graphXStart}" y="30" fill="#9ca3af" font-size="8" text-anchor="middle">M</text>
      <line x1="${graphXStart + 90}" y1="35" x2="${graphXStart + 90}" y2="165" stroke="#374151" stroke-width="0.5" stroke-dasharray="2 2"/>
      <text x="${graphXStart + 90}" y="175" fill="#6b7280" font-size="8" text-anchor="middle">90°</text>
      <line x1="${graphXStart + 180}" y1="35" x2="${graphXStart + 180}" y2="165" stroke="#374151" stroke-width="0.5" stroke-dasharray="2 2"/>
      <text x="${graphXStart + 180}" y="175" fill="#6b7280" font-size="8" text-anchor="middle">180°</text>
      <text x="${graphXStart - 5}" y="53" fill="#6b7280" font-size="7" text-anchor="end">+Mmax</text>
      <text x="${graphXStart - 5}" y="153" fill="#6b7280" font-size="7" text-anchor="end">-Mmax</text>
      <text x="${graphXStart - 5}" y="${graphYZero + 3}" fill="#6b7280" font-size="7" text-anchor="end">0</text>
      <polyline points="${cosPoints}" fill="none" stroke="#a78bfa" stroke-width="2.5" filter="url(#glow-violet)"/>
      <line x1="${dotX}" y1="${graphYZero}" x2="${dotX}" y2="${dotY}" stroke="#e5e7eb" stroke-dasharray="2 2" stroke-width="1"/>
      <circle cx="${dotX}" cy="${dotY}" r="5" fill="#ec4899" filter="url(#glow-violet)"/>
    </svg>
  `;
    }
