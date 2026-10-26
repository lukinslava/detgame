// Иллюстрации для карт: векторные виньетки в духе гравюры.
// Всё рисуется цветом currentColor, поэтому цвет задаётся из CSS (обычная карта, поворот, финал).
// Вырезы рисуются цветом фона виньетки: var(--art-bg).
//
// art: 'key' — предмет из библиотеки ниже; 'p:<id>' — портрет из case.people.

const L = 'fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
const T = 'fill="currentColor" fill-opacity=".16" stroke="none"';
const F = 'fill="currentColor" stroke="none"';
const C = 'style="fill:var(--art-bg)" stroke="none"'; // вырез цветом фона
const thin = 'stroke-width="2"';

const g = (body) => `<g ${L}>${body}</g>`;

// ---------- предметы (viewBox 0 0 120 120) ----------
const OBJECTS = {
  key: () => g(`
    <circle cx="34" cy="56" r="15"/><circle cx="34" cy="56" r="5"/>
    <path d="M49 56H102M90 56v12h5v-7h6v9"/>
    <path d="M24 67l-6 14" ${thin}/>
    <g transform="rotate(-14 20 92)"><rect x="6" y="82" width="28" height="18" rx="3" ${T}/><rect x="6" y="82" width="28" height="18" rx="3"/>
    <text x="20" y="95" font-size="10" font-family="PT Mono, monospace" text-anchor="middle" ${F}>4/3</text></g>`),

  telegram: () => g(`
    <rect x="20" y="18" width="80" height="86" rx="2" ${C}/><rect x="20" y="18" width="80" height="86" rx="2"/>
    <text x="60" y="34" font-size="9" font-family="PT Sans, sans-serif" font-weight="700" letter-spacing="1" text-anchor="middle" ${F}>ТЕЛЕГРАММА</text>
    <path d="M28 40H92" ${thin}/>
    <rect x="28" y="48" width="64" height="9" ${T}/><rect x="28" y="62" width="58" height="9" ${T}/><rect x="28" y="76" width="62" height="9" ${T}/>
    <path d="M34 52.5H84M34 66.5H78M34 80.5H82" stroke-width="1.6" stroke-dasharray="4 3"/>
    <path d="M64 96c4-5 8 3 12-2s6 2 10-1" ${thin}/>`),

  letter: () => g(`
    <rect x="16" y="32" width="88" height="58" rx="3" ${C}/><rect x="16" y="32" width="88" height="58" rx="3"/>
    <path d="M16 34l44 32 44-32" />
    <path d="M16 90l32-26M104 90L72 64" ${thin}/>
    <circle cx="60" cy="66" r="9" ${F}/><path d="M56 63l8 6M64 63l-8 6" style="stroke:var(--art-bg)" stroke-width="1.6"/>`),

  document: () => g(`
    <path d="M28 14h48l16 16v76H28z" ${C}/><path d="M28 14h48l16 16v76H28z"/><path d="M76 14v16h16"/>
    <path d="M38 40H82M38 50H82M38 60H76M38 70H82M38 80H64" ${thin}/>
    <path d="M58 94c4-7 7 3 11-3s5 3 9-1" ${thin}/>`),

  will: () => g(`
    <path d="M30 22h60v74H30z" ${C}/>
    <path d="M30 22h60M30 96h60M30 22v74M90 22v74"/>
    <ellipse cx="30" cy="22" rx="6" ry="6"/><ellipse cx="90" cy="96" rx="6" ry="6"/>
    <path d="M40 38H80M40 48H80M40 58H72M40 68H78" ${thin}/>
    <path d="M70 76l-4 26M76 76l6 24" ${thin}/>
    <circle cx="72" cy="78" r="10" ${F}/><circle cx="72" cy="78" r="5" ${C}/>`),

  notebook: () => g(`
    <rect x="28" y="16" width="56" height="84" rx="4" ${T}/><rect x="28" y="16" width="56" height="84" rx="4"/>
    <path d="M38 16v84" ${thin}/><path d="M28 70h56" stroke-width="4"/>
    <path d="M92 26l10 70-4 6-4-6z" ${C}/><path d="M92 26l10 70-4 6-4-6zM93 34h7" ${thin}/>`),

  ledger: () => g(`
    <path d="M14 30c14-6 30-6 46 2 16-8 32-8 46-2v66c-14-6-30-6-46 2-16-8-32-8-46-2z" ${C}/>
    <path d="M14 30c14-6 30-6 46 2 16-8 32-8 46-2v66c-14-6-30-6-46 2-16-8-32-8-46-2zM60 32v66"/>
    <path d="M22 44h30M22 54h30M22 64h30M22 74h30M68 44h30M68 54h30M68 64h30M68 74h30M40 38v46M86 38v46" stroke-width="1.5"/>`),

  folder: () => g(`
    <path d="M18 30h30l6 8h48v62H18z" ${T}/><path d="M18 30h30l6 8h48v62H18z"/>
    <rect x="38" y="52" width="44" height="22" rx="2" ${C}/><rect x="38" y="52" width="44" height="22" rx="2" ${thin}/>
    <text x="60" y="67" font-size="10" font-family="PT Sans, sans-serif" font-weight="700" text-anchor="middle" ${F}>ДЕЛО</text>
    <path d="M60 100v10M54 112l6-2 6 2" ${thin}/>`),

  clock: () => g(`
    <circle cx="60" cy="60" r="42" ${C}/><circle cx="60" cy="60" r="42"/><circle cx="60" cy="60" r="36" ${thin}/>
    ${Array.from({ length: 12 }, (_, i) => {
      const a = (i * Math.PI) / 6;
      return `<path d="M${60 + 30 * Math.sin(a)} ${60 - 30 * Math.cos(a)}L${60 + 35 * Math.sin(a)} ${60 - 35 * Math.cos(a)}" stroke-width="${i % 3 ? 1.5 : 3}"/>`;
    }).join('')}
    <path d="M60 60L48 44M60 60l2-26" /><circle cx="60" cy="60" r="3" ${F}/>`),

  clocks: () => g(`
    ${[[34, 'МСК', 3], [86, 'МЕСТН.', 7]].map(([x, label, h]) => {
      const a = (h * Math.PI) / 6;
      return `<circle cx="${x}" cy="54" r="24" ${C}/><circle cx="${x}" cy="54" r="24"/>
      <path d="M${x} 54L${x + 13 * Math.sin(a)} ${54 - 13 * Math.cos(a)}M${x} 54v-18"/><circle cx="${x}" cy="54" r="2.5" ${F}/>
      <text x="${x}" y="96" font-size="11" font-family="PT Sans, sans-serif" font-weight="700" text-anchor="middle" ${F}>${label}</text>`;
    }).join('')}
    <path d="M56 54h8" ${thin}/>`),

  pocketwatch: () => g(`
    <circle cx="56" cy="66" r="34" ${C}/><circle cx="56" cy="66" r="34"/><circle cx="56" cy="66" r="28" ${thin}/>
    <rect x="50" y="22" width="12" height="10" rx="3" ${F}/><circle cx="56" cy="16" r="6"/>
    <path d="M56 66l-10-12M56 66l14-6" /><circle cx="56" cy="66" r="2.5" ${F}/>
    <path d="M62 14c14-6 30 0 40 12 8 10 8 24 2 34" stroke-dasharray="3 4"/>`),

  wristwatch: () => g(`
    <rect x="46" y="8" width="28" height="104" rx="6" ${T}/><path d="M46 14v92M74 14v92" ${thin}/>
    <circle cx="60" cy="60" r="26" ${C}/><circle cx="60" cy="60" r="26"/>
    <path d="M60 60l-14 10M60 60l2-17"/>
    <path d="M44 46l12 10 4-8 10 12 6-4" stroke-width="1.6"/>
    <path d="M86 60h4" stroke-width="5"/>`),

  vial: () => g(`
    <path d="M48 18h24v10H48z" ${F}/>
    <path d="M50 28h20v10c10 4 16 12 16 24v38a6 6 0 0 1-6 6H40a6 6 0 0 1-6-6V62c0-12 6-20 16-24z" ${T}/>
    <path d="M50 28h20v10c10 4 16 12 16 24v38a6 6 0 0 1-6 6H40a6 6 0 0 1-6-6V62c0-12 6-20 16-24z"/>
    <rect x="40" y="62" width="40" height="26" ${C}/><rect x="40" y="62" width="40" height="26" ${thin}/>
    <path d="M46 71h28M46 79h20" stroke-width="1.6"/>`),

  tea: () => g(`
    <path d="M40 30h40l-4 54H44z" ${C}/>
    <path d="M42 44h36l-2 40H44z" ${T}/>
    <path d="M40 30h40l-4 54H44z"/>
    <path d="M38 70h44l-4 30H42z" ${F}/>
    <path d="M44 78h32M46 88h28" style="stroke:var(--art-bg)" stroke-width="1.5"/>
    <path d="M82 74c14 0 16 20 0 22"/>
    <path d="M70 16L58 66" ${thin}/><ellipse cx="72" cy="14" rx="4" ry="3" ${F}/>`),

  punch: () => g(`
    <path d="M38 40h44l-6 62H44z" ${C}/>
    <path d="M40 52h40l-5 50H45z" ${T}/>
    <path d="M38 40h44l-6 62H44z"/>
    <circle cx="80" cy="40" r="14" ${C}/><circle cx="80" cy="40" r="14"/><circle cx="80" cy="40" r="9" ${thin}/>
    <path d="M80 26v28M66 40h28M70 30l20 20M90 30L70 50" stroke-width="1.2"/>
    <path d="M50 30c-4-6 4-10 0-16M62 30c-4-6 4-10 0-16" ${thin}/>`),

  decanter: () => g(`
    <path d="M52 30h16v10c14 6 22 18 22 34 0 18-12 30-30 30S30 92 30 74c0-16 8-28 22-34z" ${C}/>
    <path d="M32 78h56c-2 16-14 26-28 26S34 94 32 78z" ${T}/>
    <path d="M52 30h16v10c14 6 22 18 22 34 0 18-12 30-30 30S30 92 30 74c0-16 8-28 22-34z"/>
    <path d="M54 30l-2-8h16l-2 8" /><circle cx="60" cy="14" r="7" ${F}/>
    <path d="M42 60c2-6 6-10 10-12" stroke-width="2" stroke-opacity=".6"/>`),

  glasses: () => g(`
    <path d="M30 24h26c0 18-4 30-13 30S30 42 30 24zM43 54v34M33 90h20" transform="rotate(-12 43 60)"/>
    <path d="M64 24h26c0 18-4 30-13 30S64 42 64 24zM77 54v34M67 90h20" transform="rotate(12 77 60)"/>
    <path d="M33 30h20" transform="rotate(-12 43 60)" ${thin}/><path d="M67 30h20" transform="rotate(12 77 60)" ${thin}/>
    <path d="M60 10v8M52 14l4 5M68 14l-4 5" ${thin}/>`),

  revolver: () => g(`
    <path d="M18 42h56v12H18z" ${T}/><path d="M18 42h56v12H18z"/>
    <path d="M12 40h8v6h-8z" ${F}/>
    <rect x="62" y="36" width="24" height="24" rx="4" ${C}/><rect x="62" y="36" width="24" height="24" rx="4"/>
    <path d="M68 36v24M74 36v24M80 36v24" ${thin}/>
    <path d="M86 40h10l6 4v12l-8 4H86z"/>
    <path d="M94 60c4 14 6 30 4 44H82c-4-12-6-26-4-40" ${F}/>
    <path d="M76 60c-4 8-2 14 6 14" />
    <path d="M100 42l6-6" />`),

  cartridge: () => g(`
    ${[[40, false], [80, true]].map(([x, live]) => `
      <rect x="${x - 10}" y="30" width="20" height="66" rx="2" ${C}/><rect x="${x - 10}" y="30" width="20" height="66" rx="2"/>
      <path d="M${x - 14} 96h28v6H${x - 14}z" ${F}/>
      ${live ? `<path d="M${x - 6} 30c0-8 3-12 6-12s6 4 6 12" ${T}/><path d="M${x - 6} 30c0-8 3-12 6-12s6 4 6 12" ${thin}/>`
        : `<path d="M${x - 10} 30l5 -8 5 6 5-6 5 8" ${thin}/>`}
      <path d="M${x - 10} 46h20" ${thin}/>`).join('')}
    <text x="40" y="116" font-size="9" font-family="PT Mono, monospace" text-anchor="middle" ${F}>1924</text>
    <text x="80" y="116" font-size="9" font-family="PT Mono, monospace" text-anchor="middle" ${F}>1914</text>`),

  fan: () => g(`
    <path d="M60 96L14 54a62 62 0 0 1 92 0z" ${T}/>
    <path d="M60 96L14 54a62 62 0 0 1 92 0z"/>
    ${Array.from({ length: 9 }, (_, i) => {
      const a = (-130 + i * 10) * Math.PI / 180;
      return `<path d="M60 96L${60 + 62 * Math.cos(a)} ${96 + 62 * Math.sin(a)}" stroke-width="1.5"/>`;
    }).join('')}
    <circle cx="60" cy="96" r="5" ${F}/><path d="M60 101c-4 6 2 12-2 16" ${thin}/>`),

  pliers: () => g(`
    <path d="M36 104c4-20 10-36 22-48M84 104c-4-20-10-36-22-48" stroke-width="7"/>
    <path d="M58 56l-8-30 6-12 4 30M62 56l8-30-6-12-4 30"/>
    <circle cx="60" cy="58" r="5" ${F}/>`),

  hatbox: () => g(`
    <path d="M24 46v46c0 8 16 14 36 14s36-6 36-14V46" ${C}/>
    <path d="M24 46v46c0 8 16 14 36 14s36-6 36-14V46" ${T}/>
    <path d="M24 46v46c0 8 16 14 36 14s36-6 36-14V46"/>
    <ellipse cx="60" cy="42" rx="40" ry="14" ${C}/><ellipse cx="60" cy="42" rx="40" ry="14"/>
    <path d="M60 56v50" stroke-width="4"/>
    <path d="M60 30c-10-14-24-8-14 0 4 3 10 2 14 0 4 2 10 3 14 0 10-8-4-14-14 0z" ${F}/>`),

  muff: () => g(`
    <rect x="22" y="40" width="76" height="46" rx="23" ${T}/><rect x="22" y="40" width="76" height="46" rx="23"/>
    <ellipse cx="28" cy="63" rx="8" ry="20" ${C}/><ellipse cx="28" cy="63" rx="8" ry="20"/>
    <path d="M44 42c-2 8 2 14 0 22s2 14 0 20M60 41c-2 8 2 14 0 22s2 14 0 22M76 42c-2 8 2 14 0 22s2 14 0 20" stroke-width="1.5"/>
    <path d="M50 40c0-16 20-16 20 0" ${thin}/>`),

  sandbox: () => g(`
    <path d="M22 66h76v36H22z" ${C}/><path d="M22 66h76v36H22z"/>
    <path d="M26 66c8-12 22-14 34-8 10-6 24-4 34 8" ${T}/><path d="M26 66c8-12 22-14 34-8 10-6 24-4 34 8" ${thin}/>
    <path d="M70 18l-8 52" /><path d="M58 64l8 10 8-4-2-12z" ${F}/>
    <text x="60" y="92" font-size="10" font-family="PT Sans, sans-serif" font-weight="700" text-anchor="middle" ${F}>ПЕСОК</text>
    <rect x="44" y="56" width="12" height="7" rx="2" ${F}/>`),

  bell: () => g(`
    <path d="M30 86c6-6 8-14 8-30 0-14 10-26 22-26s22 12 22 26c0 16 2 24 8 30z" ${T}/>
    <path d="M30 86c6-6 8-14 8-30 0-14 10-26 22-26s22 12 22 26c0 16 2 24 8 30z"/>
    <path d="M26 86h68"/><circle cx="60" cy="94" r="6" ${F}/><path d="M60 30v-10"/><circle cx="60" cy="17" r="4"/>
    <path d="M14 54c-4 8-4 16 0 24M106 54c4 8 4 16 0 24M20 60c-2 4-2 8 0 12M100 60c2 4 2 8 0 12" ${thin}/>`),

  masks: () => g(`
    <path d="M18 30c12-6 30-6 40 0 0 22-6 44-20 50-14-6-20-28-20-50z" ${C}/>
    <path d="M18 30c12-6 30-6 40 0 0 22-6 44-20 50-14-6-20-28-20-50z"/>
    <path d="M26 44c2-3 6-3 8 0M42 44c2-3 6-3 8 0M28 60c4 6 16 6 20 0" ${thin}/>
    <g transform="rotate(14 82 60)">
    <path d="M62 34c12-6 30-6 40 0 0 22-6 44-20 50-14-6-20-28-20-50z" ${F}/>
    <path d="M70 50c2 3 6 3 8 0M86 50c2 3 6 3 8 0M72 70c4-6 16-6 20 0" style="stroke:var(--art-bg)" ${thin}/></g>
    <path d="M38 80c0 14-10 20-18 26M82 86c0 10 10 16 18 20" ${thin}/>`),

  stage: () => g(`
    <path d="M8 12h104v8H8z" ${F}/>
    <path d="M10 20c0 30 6 60 4 92h22c-6-26-8-60 2-92z" ${T}/><path d="M10 20c0 30 6 60 4 92h22c-6-26-8-60 2-92z"/>
    <path d="M110 20c0 30-6 60-4 92H84c6-26 8-60-2-92z" ${T}/><path d="M110 20c0 30-6 60-4 92H84c6-26 8-60-2-92z"/>
    <path d="M38 20c10 14 34 14 44 0" ${thin}/>
    <path d="M30 100h60" stroke-width="4"/>
    <path d="M60 20l-18 80M60 20l18 80" stroke-width="1" stroke-opacity=".5"/>
    <path d="M50 98c2-8 8-12 16-10 6 2 8 6 6 10" ${F}/>`),

  lamp: () => g(`
    <path d="M60 6v24"/>
    <path d="M40 54c0-14 8-24 20-24s20 10 20 24z" ${F}/>
    <circle cx="60" cy="58" r="7" ${C}/><circle cx="60" cy="58" r="7" ${thin}/>
    <path d="M40 54l-18 52h76L80 54" ${T}/>
    <path d="M44 72l-6 10M60 70v14M76 72l6 10" ${thin} stroke-opacity=".6"/>`),

  body: () => g(`
    <rect x="6" y="22" width="108" height="76" rx="4" ${T}/>
    <circle cx="24" cy="57" r="9" stroke-dasharray="4 3"/>
    <path d="M33 52L48 50 60 34 66 37 56 52 74 50 96 42 99 47 80 57 100 66 97 71 74 64 56 66 52 82 46 81 48 66 33 64z" stroke-dasharray="4 3"/>
    <path d="M14 30l6 4M104 88l-6-4" ${thin}/>`),

  pillow: () => g(`
    <path d="M18 40c14-6 28 0 42-4s28-2 42 4c-4 14-4 28 0 42-14 6-28 0-42 4s-28 2-42-4c4-14 4-28 0-42z" ${C}/>
    <path d="M18 40c14-6 28 0 42-4s28-2 42 4c-4 14-4 28 0 42-14 6-28 0-42 4s-28 2-42-4c4-14 4-28 0-42z"/>
    <path d="M40 50c6 6 6 14 2 20M78 48c-6 6-6 16 0 22" ${thin}/>
    <circle cx="64" cy="62" r="3" ${F}/>`),

  robe: () => g(`
    <path d="M60 10v8M54 10h12"/>
    <path d="M46 22l14-4 14 4 20 22-8 10-8-6v58H42V48l-8 6-8-10z" ${T}/>
    <path d="M46 22l14-4 14 4 20 22-8 10-8-6v58H42V48l-8 6-8-10z"/>
    <path d="M60 18l-8 30v58M60 18l8 30" ${thin}/>
    <path d="M42 70h36" stroke-width="4"/>
    <path d="M86 52l6 10 4-4" ${F} stroke="currentColor"/>`),

  vest: () => g(`
    <path d="M36 18l12 8 12 20 12-20 12-8 10 16-4 64-30 8-30-8-4-64z" ${T}/>
    <path d="M36 18l12 8 12 20 12-20 12-8 10 16-4 64-30 8-30-8-4-64z"/>
    <path d="M60 46v60" ${thin}/>
    <circle cx="60" cy="56" r="2.5" ${F}/><circle cx="60" cy="70" r="2.5" ${F}/><circle cx="60" cy="84" r="2.5" ${F}/>
    <path d="M60 70c-8 6-16 6-20 2" stroke-dasharray="2 3"/><circle cx="38" cy="74" r="6" ${F}/>
    <path d="M66 62h14M66 78h14" ${thin}/>`),

  dragonfly: () => g(`
    <path d="M60 26c-30-14-50-2-44 10 8 12 34 6 44-4z" ${T}/><path d="M60 26c-30-14-50-2-44 10 8 12 34 6 44-4z"/>
    <path d="M60 26c30-14 50-2 44 10-8 12-34 6-44-4z" ${T}/><path d="M60 26c30-14 50-2 44 10-8 12-34 6-44-4z"/>
    <path d="M60 36c-26-2-42 12-34 20 8 8 26-6 34-14z" ${T}/><path d="M60 36c-26-2-42 12-34 20 8 8 26-6 34-14z"/>
    <path d="M60 36c26-2 42 12 34 20-8 8-26-6-34-14z" ${T}/><path d="M60 36c26-2 42 12 34 20-8 8-26-6-34-14z"/>
    <ellipse cx="60" cy="40" rx="8" ry="10" ${F}/>
    <path d="M56 44l4 4 4-4" style="stroke:var(--art-bg)" stroke-width="1.5"/>
    <path d="M60 50v54" stroke-width="5"/><path d="M60 58v40" style="stroke:var(--art-bg)" stroke-width="1.5" stroke-dasharray="3 5"/>
    <circle cx="60" cy="22" r="5" ${F}/>`),

  stove: () => g(`
    <path d="M34 14h20v16H34z" ${F}/>
    <path d="M26 30h36v62c0 6-6 10-18 10s-18-4-18-10z" ${T}/><path d="M26 30h36v62c0 6-6 10-18 10s-18-4-18-10z"/>
    <rect x="34" y="56" width="20" height="16" rx="2" ${F}/>
    <path d="M38 64h12" style="stroke:var(--art-bg)" stroke-width="1.5"/>
    <path d="M70 70h36v34H70z" ${C}/><path d="M70 70h36v34H70z"/>
    <path d="M74 70c4-8 8-10 12-6 4-6 10-4 14 0 2 2 4 4 4 6" ${F}/>
    <path d="M70 66l38 0" ${thin}/>`),

  mailbag: () => g(`
    <path d="M38 30c-10 20-14 44-10 66 2 8 62 8 64 0 4-22 0-46-10-66z" ${T}/>
    <path d="M38 30c-10 20-14 44-10 66 2 8 62 8 64 0 4-22 0-46-10-66z"/>
    <path d="M38 30c6-4 38-4 44 0M44 22l16 6 16-6" />
    <circle cx="60" cy="66" r="14" ${C}/><circle cx="60" cy="66" r="14" ${thin}/>
    <path d="M52 62l8 6 8-6M52 62v10h16V62" stroke-width="1.6"/>`),

  window: () => g(`
    <rect x="22" y="14" width="76" height="92" rx="8" ${C}/><rect x="22" y="14" width="76" height="92" rx="8"/>
    <rect x="30" y="40" width="60" height="58" rx="4" ${T}/><rect x="30" y="40" width="60" height="58" rx="4" ${thin}/>
    <path d="M30 26h60" stroke-width="5"/>
    <path d="M40 54v6M56 66v6M72 52v6M48 82v6M80 76v6M66 90v4" stroke-width="2"/>
    <rect x="52" y="34" width="16" height="6" rx="2" ${F}/>`),

  train: () => g(`
    <path d="M8 96h104" stroke-width="2"/><path d="M8 102h104" stroke-width="2" stroke-dasharray="6 6"/>
    <rect x="44" y="48" width="66" height="40" rx="4" ${T}/><rect x="44" y="48" width="66" height="40" rx="4"/>
    <path d="M50 58h12v12H50zM68 58h12v12H68zM86 58h12v12H86z" ${C}/><path d="M50 58h12v12H50zM68 58h12v12H68zM86 58h12v12H86z" ${thin}/>
    <path d="M10 88V60h22V46h10v42z" ${F}/>
    <path d="M14 46h8V34h-8z" ${F}/>
    <path d="M18 28c-4-6 6-10 4-16 8 2 12 8 8 14" stroke-width="2"/>
    ${[22, 38, 56, 92].map((x) => `<circle cx="${x}" cy="92" r="6" ${C}/><circle cx="${x}" cy="92" r="6" ${thin}/>`).join('')}`),

  sink: () => g(`
    <path d="M18 54h84c0 22-18 36-42 36S18 76 18 54z" ${C}/>
    <path d="M18 54h84c0 22-18 36-42 36S18 76 18 54z"/>
    <path d="M30 62c8 8 18 4 26 10M66 64c6 6 14 2 20 8" stroke-width="2.2" stroke-opacity=".7"/>
    <path d="M60 90v18M48 108h24"/>
    <path d="M60 54V26h18v8"/><path d="M72 22h12" stroke-width="4"/>
    <path d="M78 40v4M78 48v4" ${thin}/>`),

  ashtray: () => g(`
    <ellipse cx="60" cy="80" rx="44" ry="16" ${T}/><ellipse cx="60" cy="80" rx="44" ry="16"/>
    <ellipse cx="60" cy="76" rx="30" ry="9" ${C}/><ellipse cx="60" cy="76" rx="30" ry="9" ${thin}/>
    <path d="M46 74l10-8 12 2 6 6z" ${F}/>
    <path d="M60 64c-6-10 6-14 0-24s6-14 2-24" ${thin} stroke-opacity=".6"/>`),

  footprints: () => g(`
    ${[[30, 92, -14], [54, 70, 10], [44, 44, -14], [70, 22, 10]].map(([x, y, r]) => `
      <g transform="rotate(${r} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="8" ry="13" ${F}/><ellipse cx="${x}" cy="${y + 18}" rx="6" ry="6" ${F}/></g>`).join('')}`),

  handkerchief: () => g(`
    <path d="M24 34l58-8 14 52-58 14z" ${C}/><path d="M24 34l58-8 14 52-58 14z"/>
    <path d="M30 40l46-6 10 40-46 10z" ${thin} stroke-dasharray="3 3"/>
    <path d="M24 34c-4 4 0 8-4 12M82 26c4 2 8-2 12 2" ${thin}/>
    <path d="M40 92l58-14" stroke-width="1.6"/>`),

  loupe: () => g(`
    <circle cx="50" cy="50" r="30" ${C}/><circle cx="50" cy="50" r="30" ${T}/>
    <circle cx="50" cy="50" r="30" stroke-width="5"/>
    <path d="M72 72l30 30" stroke-width="10"/>
    <path d="M34 42c4-8 10-12 18-12" ${thin} style="stroke:var(--art-bg)"/>`),

  stamp: () => g(`
    <g transform="rotate(-10 60 64)">
      <rect x="12" y="38" width="96" height="48" rx="6" stroke-width="4"/>
      <rect x="18" y="44" width="84" height="36" rx="3" ${thin}/>
      <text x="60" y="60" font-size="13" font-family="PT Sans, sans-serif" font-weight="700" letter-spacing="2" text-anchor="middle" ${F}>ДЕЛО</text>
      <text x="60" y="75" font-size="13" font-family="PT Sans, sans-serif" font-weight="700" letter-spacing="2" text-anchor="middle" ${F}>ЗАКРЫТО</text>
    </g>`),

  armchair: () => g(`
    <path d="M30 34c0-14 60-14 60 0v30H30z" ${T}/><path d="M30 34c0-14 60-14 60 0v30H30z"/>
    <path d="M22 50c-6 0-8 6-6 12l4 20h80l4-20c2-6 0-12-6-12-6 0-8 6-8 14H30c0-8-2-14-8-14z" ${C}/>
    <path d="M22 50c-6 0-8 6-6 12l4 20h80l4-20c2-6 0-12-6-12-6 0-8 6-8 14H30c0-8-2-14-8-14z"/>
    <path d="M26 82v14M94 82v14"/>
    <path d="M44 30c4 8 16 10 26 4" ${thin}/>`),

  manor: () => g(`
    <path d="M10 104h100" ${thin}/>
    <path d="M16 56L60 26l44 30z" ${T}/><path d="M16 56L60 26l44 30z"/>
    <path d="M22 56v48h76V56"/>
    <path d="M14 58c10-6 18 2 28-2s20 4 30 0 22 4 34-2" stroke-width="4"/>
    ${[34, 48, 72, 86].map((x) => `<path d="M${x} 62v42" ${thin}/>`).join('')}
    <path d="M54 104V76h12v28z" ${F}/>
    <path d="M60 36v8" ${thin}/><circle cx="60" cy="40" r="5"/>
    ${[[18, 18], [36, 10], [92, 14], [106, 26], [74, 8]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" ${F}/>`).join('')}`),

  door: () => g(`
    <rect x="30" y="10" width="60" height="100" rx="2" ${T}/><rect x="30" y="10" width="60" height="100" rx="2"/>
    <rect x="38" y="20" width="44" height="34" ${thin}/><rect x="38" y="62" width="44" height="38" ${thin}/>
    <rect x="58" y="54" width="34" height="8" rx="2" ${C}/><rect x="58" y="54" width="34" height="8" rx="2"/>
    <path d="M66 58h-14" stroke-width="5"/><circle cx="84" cy="58" r="2" ${F}/>
    <circle cx="80" cy="72" r="4" ${F}/>`),

  drawer: () => g(`
    <path d="M10 40h100v8H10z" ${F}/>
    <path d="M18 48h84v12H18z"/>
    <path d="M28 60l8 34h64l-6-34" ${T}/><path d="M28 60l8 34h64l-6-34z"/>
    <circle cx="64" cy="78" r="4" ${F}/><path d="M58 72l10 12M70 72l-8 12" stroke-width="1.4"/>
    <path d="M16 96l40-22" stroke-width="4"/><path d="M54 75l6-4" stroke-width="2"/>`),

  poker: () => g(`
    <path d="M30 18c-8 0-12 8-8 14l6 6" stroke-width="4"/>
    <path d="M28 38l58 58" stroke-width="5"/>
    <path d="M86 96l14 6-6-14M92 90l10-4" stroke-width="4"/>
    <circle cx="96" cy="100" r="3" ${F}/>
    <path d="M100 108c0 3 2 5 4 5M92 108c0 2 1 3 2 3" ${thin}/>`),

  ring: () => g(`
    <ellipse cx="60" cy="74" rx="30" ry="26" stroke-width="7"/>
    <rect x="42" y="22" width="36" height="30" rx="6" ${F}/>
    <path d="M60 28v18M52 32c4 4 12 4 16 0M50 40c6 6 14 6 20 0M56 46l-4 4M64 46l4 4" style="stroke:var(--art-bg)" stroke-width="2"/>`),

  lemon: () => g(`
    <path d="M18 60c0-18 14-28 30-28s30 10 30 28-14 28-30 28-30-10-30-28z" ${T}/>
    <path d="M18 60c0-18 14-28 30-28s30 10 30 28-14 28-30 28-30-10-30-28z"/>
    <path d="M14 60l-4 0M82 60l4 0"/>
    <circle cx="88" cy="84" r="20" ${C}/><circle cx="88" cy="84" r="20"/><circle cx="88" cy="84" r="14" ${thin}/>
    <path d="M88 70v28M74 84h28M78 74l20 20M98 74L78 94" stroke-width="1.4"/>
    <path d="M44 32c-2-10 6-18 18-20-2 10-8 18-18 20z" ${F}/>`),

  greenhouse: () => g(`
    <path d="M12 104V52c0-26 96-26 96 0v52z" ${C}/><path d="M12 104V52c0-26 96-26 96 0v52z"/>
    <path d="M36 104V36M60 104V30M84 104V36M12 72h96" ${thin}/>
    <path d="M52 104V82M68 104V82M60 90V70" stroke-width="3"/>
    <circle cx="60" cy="62" r="16" ${F}/><circle cx="54" cy="58" r="3" ${C}/><circle cx="66" cy="66" r="3" ${C}/><circle cx="62" cy="54" r="3" ${C}/>
    <path d="M10 104h100"/>`),

  shirt: () => g(`
    <path d="M44 16l16 6 16-6 26 18-10 16-12-6v62H40V44l-12 6-10-16z" ${C}/>
    <path d="M44 16l16 6 16-6 26 18-10 16-12-6v62H40V44l-12 6-10-16z"/>
    <path d="M60 22v84M52 18l8 12 8-12" ${thin}/>
    <path d="M18 34l-6 12 10 4 6-10" ${T}/>
    <circle cx="14" cy="56" r="3" ${F}/><circle cx="20" cy="62" r="2" ${F}/><circle cx="12" cy="66" r="2.4" ${F}/>`),

  locket: () => g(`
    <path d="M60 6c-20 6-22 22-22 30M60 6c20 6 22 22 22 30" ${thin} stroke-dasharray="2 3"/>
    <ellipse cx="44" cy="70" rx="24" ry="30" ${C}/><ellipse cx="44" cy="70" rx="24" ry="30"/><ellipse cx="44" cy="70" rx="18" ry="24" ${thin}/>
    <path d="M36 92c0-10 4-14 8-16-6-2-8-8-8-14 0-6 4-10 8-10s8 4 8 10c0 6-2 12-8 14 4 2 8 6 8 16" ${F}/>
    <ellipse cx="88" cy="70" rx="22" ry="28" ${T}/><ellipse cx="88" cy="70" rx="22" ry="28"/>
    <path d="M84 58c4 6 4 16 0 24" ${thin}/>`),

  drop: () => g(`
    <path d="M50 20c14 22 24 36 24 52a24 24 0 0 1-48 0c0-16 10-30 24-52z" ${F}/>
    <path d="M42 70c0 8 4 12 10 14" style="stroke:var(--art-bg)" ${thin}/>
    <path d="M88 64c6 9 10 15 10 22a10 10 0 0 1-20 0c0-7 4-13 10-22z" ${F}/>
    <circle cx="78" cy="104" r="4" ${F}/>`),

  gloves: () => g(`
    ${[[40, -10], [80, 10]].map(([x, r]) => `<g transform="rotate(${r} ${x} 64)">
      <path d="M${x - 14} 104V66l-6-18c-2-6 6-8 8-2l4 10V30c0-6 8-6 8 0v22-28c0-6 8-6 8 0v28-24c0-6 8-6 8 0v30-18c0-6 8-6 8 0v40l-6 22z" ${T}/>
      <path d="M${x - 14} 104V66l-6-18c-2-6 6-8 8-2l4 10V30c0-6 8-6 8 0v22-28c0-6 8-6 8 0v28-24c0-6 8-6 8 0v30-18c0-6 8-6 8 0v40l-6 22z" ${thin}/></g>`).join('')}
    <circle cx="84" cy="30" r="3" fill="currentColor" stroke="none" fill-opacity=".5"/><circle cx="90" cy="38" r="2" fill="currentColor" stroke="none" fill-opacity=".5"/>`),

  camera: () => g(`
    <path d="M60 78l-24 34M60 78l24 34M60 78v34"/>
    <rect x="22" y="26" width="30" height="48" rx="2" ${F}/>
    <path d="M52 32l30 8v28l-30 8z" ${T}/><path d="M52 32l30 8v28l-30 8zM62 34v40M72 37v34" ${thin}/>
    <rect x="82" y="42" width="14" height="24" rx="2"/>
    <circle cx="100" cy="54" r="5" ${F}/>
    <path d="M28 22l6-10h10l4 10" ${thin}/>`),

  station: () => g(`
    <path d="M6 104c20-6 40 2 60-2s36 4 48 0" ${thin}/>
    <path d="M14 60h70v40H14z" ${T}/><path d="M14 60h70v40H14z"/>
    <path d="M10 62l39-24 39 24" />
    <path d="M10 58c12-8 24-6 39-20 15 14 27 12 39 20" stroke-width="5"/>
    <path d="M24 72h12v10H24zM60 72h12v10H60z" ${F}/><rect x="42" y="78" width="12" height="22" ${F}/>
    <path d="M100 104V18M92 30l8-12 8 12M94 44h12M95 62h10" ${thin}/>
    ${[[20, 22], [40, 14], [70, 20], [84, 8], [112, 70]].map(([x, y]) => `<path d="M${x - 3} ${y}h6M${x} ${y - 3}v6" stroke-width="1.5"/>`).join('')}`),

  booth: () => g(`
    <rect x="30" y="20" width="60" height="50" ${C}/><rect x="30" y="20" width="60" height="50" ${T}/>
    <rect x="30" y="20" width="60" height="50"/>
    <path d="M26 20l34-10 34 10" />
    ${[30, 38, 46, 54, 62].map((y) => `<path d="M36 ${y}l48 4" stroke-width="1.6"/>`).join('')}
    <path d="M38 70l-6 40M82 70l6 40M36 92h48" />
    <path d="M14 112c18-4 30 2 46-2s30 4 46 0" ${thin}/>`),

  rope: () => g(`
    ${[14, 50, 86].map((x, i) => `<path d="M${x} ${100 - i * 6}V${54 - i * 6}" stroke-width="5"/>`).join('')}
    <path d="M14 56c12 6 24 2 36-4s24-4 36-8l26-6" />
    <path d="M10 104c20-6 40 2 60-2s30 2 46-4" ${thin}/>
    <path d="M20 26c10-2 18 4 30 0M44 16c12 0 20 6 34 2M70 30c12-2 20 4 34 0" stroke-width="1.6" stroke-opacity=".6"/>`),

  carabiner: () => g(`
    <path d="M44 20h32c14 0 22 10 22 22v36c0 14-10 24-24 24H46c-14 0-24-10-24-24V42c0-12 8-22 22-22z" stroke-width="7"/>
    <path d="M22 50v28" style="stroke:var(--art-bg)" stroke-width="9"/>
    <path d="M28 46l-6 32" stroke-width="5"/>
    <rect x="14" y="60" width="16" height="22" rx="3" ${T}/><rect x="14" y="60" width="16" height="22" rx="3" ${thin}/>
    <path d="M14 66h16M14 72h16M14 78h16" stroke-width="1.4"/>
    <path d="M10 58l-6-6M8 86l-6 4" ${thin}/>`),

  radio: () => g(`
    <rect x="14" y="40" width="92" height="56" rx="4" ${T}/><rect x="14" y="40" width="92" height="56" rx="4"/>
    <circle cx="36" cy="64" r="11" ${C}/><circle cx="36" cy="64" r="11"/><path d="M36 64l6-6" ${thin}/>
    <circle cx="64" cy="64" r="7"/><circle cx="86" cy="64" r="7"/>
    <path d="M26 84h68" ${thin} stroke-dasharray="4 3"/>
    <path d="M30 40c0-22 60-22 60 0" />
    <rect x="22" y="30" width="12" height="16" rx="5" ${F}/><rect x="86" y="30" width="12" height="16" rx="5" ${F}/>
    <path d="M60 40V26" ${thin}/>`),

  tube: () => g(`
    <path d="M42 30c0-12 36-12 36 0v52H42z" ${C}/>
    <path d="M42 30c0-12 36-12 36 0v52H42z" ${T}/>
    <path d="M42 30c0-12 36-12 36 0v52H42z"/>
    <path d="M50 40h20v26H50zM54 46h12M54 52h12M54 58h12" stroke-width="1.6"/>
    <rect x="38" y="82" width="44" height="14" rx="2" ${F}/>
    <path d="M46 96v12M56 96v12M64 96v12M74 96v12" ${thin}/>
    <path d="M60 18v-8" ${thin}/>`),

  crate: () => g(`
    ${[[14, 58], [62, 58], [38, 16]].map(([x, y]) => `
      <rect x="${x}" y="${y}" width="44" height="42" ${C}/><rect x="${x}" y="${y}" width="44" height="42" ${T}/><rect x="${x}" y="${y}" width="44" height="42"/>
      <path d="M${x} ${y + 14}h44M${x} ${y + 28}h44M${x + 4} ${y + 40}l36-36" stroke-width="1.6"/>`).join('')}`),

  tusk: () => g(`
    <path d="M70 52c-8-4-14 10-12 22 2 12 10 18 18 18 8 0 12-8 12-18s-6-24-18-22z" ${T}/>
    <path d="M70 52c-8-4-14 10-12 22 2 12 10 18 18 18 8 0 12-8 12-18s-6-24-18-22z" ${thin}/>
    <path d="M14 106c10-50 40-86 90-92-4 6-6 10-10 12-40 8-62 38-70 80z" ${C}/>
    <path d="M14 106c10-50 40-86 90-92-4 6-6 10-10 12-40 8-62 38-70 80z"/>
    <path d="M30 80c8-14 18-26 32-36M46 60l4 6M60 46l4 5M38 74l4 6" stroke-width="1.5"/>`),

  helicopter: () => g(`
    <path d="M8 26h104" stroke-width="4"/><path d="M60 26v10"/>
    <path d="M30 38h44c14 0 24 10 24 22v6H42c-8 0-16-6-16-14z" ${T}/>
    <path d="M30 38h44c14 0 24 10 24 22v6H42c-8 0-16-6-16-14z"/>
    <path d="M30 46H6l-4-8h8" /><path d="M2 30v18" ${thin}/>
    <path d="M76 44h12c4 2 6 6 6 10H76z" ${F}/>
    <path d="M48 46h8v8h-8zM60 46h8v8h-8z" ${F}/>
    <path d="M44 66l-4 12M84 66l4 12M32 78h64" />`),

  flashlight: () => g(`
    <g transform="rotate(-24 60 60)">
      <rect x="18" y="50" width="48" height="20" rx="4" ${T}/><rect x="18" y="50" width="48" height="20" rx="4"/>
      <path d="M66 46h14v28H66z" ${F}/>
      <path d="M80 46l26-12v52L80 74" stroke-width="1.6" stroke-dasharray="4 4"/>
      <path d="M30 56v8" ${thin}/>
    </g>
    <path d="M84 96l6-6 4 8 6-4M72 104l8-2" ${thin}/>`),

  pick: () => g(`
    <path d="M24 10l70 82" stroke-width="7"/>
    <path d="M90 86l12 24 -22-14z" ${F}/>
    <path d="M18 18l14-10" stroke-width="5"/>
    <path d="M40 30l8-6M56 48l8-6" ${thin}/>
    <circle cx="94" cy="104" r="3" fill="currentColor" stroke="none" fill-opacity=".5"/>`),

  mittens: () => g(`
    ${[[42, -8], [80, 8]].map(([x, r]) => `<g transform="rotate(${r} ${x} 60)">
      <path d="M${x - 16} 104V52c0-18 8-28 18-28s16 10 16 28v4l6-6c4-4 10 0 8 6l-14 18v30z" ${T}/>
      <path d="M${x - 16} 104V52c0-18 8-28 18-28s16 10 16 28v4l6-6c4-4 10 0 8 6l-14 18v30z"/>
      <path d="M${x - 18} 92h38" stroke-width="5"/></g>`).join('')}
    <circle cx="84" cy="56" r="3" ${F}/><circle cx="90" cy="64" r="2" ${F}/>`),

  money: () => g(`
    ${[0, 10, 20].map((d) => `<rect x="${18 + d / 2}" y="${66 - d}" width="76" height="30" rx="2" ${C}/><rect x="${18 + d / 2}" y="${66 - d}" width="76" height="30" rx="2"/>`).join('')}
    <rect x="44" y="44" width="14" height="32" ${F}/>
    <circle cx="80" cy="61" r="7" ${thin}/>
    <text x="80" y="64" font-size="8" font-family="PT Mono, monospace" text-anchor="middle" ${F}>100</text>`),

  snowflake: () => g(`
    ${[0, 60, 120].map((r) => `<g transform="rotate(${r} 60 60)"><path d="M60 14v92M60 30l-10-10M60 30l10-10M60 90l-10 10M60 90l10 10"/></g>`).join('')}
    <circle cx="60" cy="60" r="6" ${F}/>`),

  corridor: () => g(`
    <path d="M10 10l36 30v40l-36 30M110 10L74 40v40l36 30M46 40h28M46 80h28"/>
    <circle cx="60" cy="24" r="6" ${F}/>
    <path d="M56 80c0-14 2-24 4-26 2 2 4 12 4 26z" ${F}/><circle cx="60" cy="50" r="4" ${F}/>`),
};

// ---------- портреты (силуэт в профиль в овальной рамке) ----------
// person: { sex: 'm'|'f', hair, beard, hat, glasses, collar, earring }
const HEAD = {
  m: 'M30 120c0-14 10-22 20-24l-2-9c-7-6-10-15-10-27 0-18 12-31 27-31 13 0 20 8 21 18l1 5c1 4 5 8 6 11 0 2-3 3-5 3v2c1 1 0 3-1 4 1 1 1 3-1 4 0 4-2 7-7 8-4 1-6 2-7 6l1 7c10 3 20 10 22 27z',
  f: 'M32 120c0-12 10-20 18-22l-1-12c-6-6-9-14-9-25 0-17 11-29 25-29 12 0 19 8 20 17l1 5c1 3 4 6 5 9 0 2-2 3-4 3v2c1 1 0 3-1 3 1 1 1 3-1 4 0 4-2 6-6 7-3 1-5 2-6 5l1 11c9 2 18 9 20 22z',
};

const HAIR = {
  short: 'M38 54c-2-16 8-28 24-30 12-1 20 6 21 14-6-4-14-4-20 0-4 2-6 8-10 10-4 2-6 2-8 8z',
  wavy: 'M36 58c-4-18 6-34 26-35 14 0 22 8 22 16-4-4-10-6-14-4 2 4-2 6-6 4 0 4-4 6-8 4 0 6-6 8-10 6 0 4-2 8-6 10z',
  bald: 'M39 64c-2-6-2-12 0-16 2 4 6 6 8 10z',
  side: 'M39 66c-2-6-2-14 2-20 2 6 6 10 10 12 0 6-4 10-10 12zM46 36c4-6 10-8 16-8',
  curly: 'M34 56c-6-6-2-16 4-18-2-8 6-14 12-12 2-6 12-8 16-2 6-4 14 0 14 6 6 2 6 8 2 10-6-2-12-2-16 2-4-2-10 0-12 4-4 0-6 4-6 8-6-2-10 0-14 2z',
  bun: 'M40 58c-4-16 6-30 22-30 12 0 20 8 20 14-8-6-20-6-28 2-4 4-6 10-14 14zM30 40a10 10 0 1 0 20 0 10 10 0 1 0-20 0',
  long: 'M40 56c-4-18 8-30 24-30 12 0 20 8 20 14-8-4-18-4-24 2-6 6-8 14-8 24 0 14-2 28-10 38-6-14-6-32-2-48z',
  bob: 'M36 70c-6-22 4-44 26-44 14 0 22 8 22 16-6-2-12-2-18 2-4 6-6 14-8 22-6 2-14 4-22 4z',
  braid: 'M40 58c-4-16 6-30 22-30 12 0 20 8 20 14-8-6-20-6-28 2-4 4-6 10-14 14zM40 56c-4 10-2 20 2 28-4 6-2 14 2 20-2 6 0 10 2 14',
};

const BEARD = {
  mustache: 'M83 65c-4 0-10 1-14 4 4 0 10 0 14-2z',
  curled: 'M84 65c-4 0-8 2-11 4-3 2-6 0-6-3 2 4 6 4 9 2l8-4z',
  full: 'M86 67c0 6-2 12-6 16-6 4-14 4-20 0-4-4-6-10-6-16 4 4 10 6 16 4 6-2 10-6 16-4z',
  goatee: 'M84 72c0 6-2 10-6 10-2-4-2-8 0-10z',
  sideburns: 'M58 52c-2 10 0 22 6 28 4-6 4-16 0-26z',
};

const HAT = {
  conductor: 'M38 40c0-12 10-20 26-20s24 6 24 14v8H38zM84 40l14 4-2 4-14-4z',
  officer: 'M36 40c0-10 12-18 28-18s26 6 26 12l-2 8H38zM86 40l12 6-4 3-12-5zM40 36h48',
  bowler: 'M40 38c0-12 10-22 24-22s22 10 22 22zM32 38c8 4 52 4 60 0v4c-8 4-52 4-60 0z',
  flatcap: 'M36 40c0-12 12-18 26-18 12 0 22 6 24 14l14 6-4 4-36-2H36z',
  ushanka: 'M32 46c0-20 14-30 32-30s26 10 26 22v6H32zM32 44c-4 10-2 22 4 30 6-6 8-16 6-28zM40 40h48',
  kerchief: 'M34 64c-4-24 8-40 28-40 16 0 24 10 26 22-10-6-24-6-32 2-6 6-8 12-10 18zM34 62c-6 6-10 12-8 18 6-2 10-8 12-14z',
  feather: 'M40 40c0-10 10-16 22-16s20 6 22 14zM36 40c10 4 44 4 52 0v4c-8 4-44 4-52 0zM46 26c-4-14 8-24 18-24-6 4-10 12-10 22z',
  headphones: 'M44 50c0-20 10-30 24-30s20 10 20 20M38 52a8 10 0 1 0 16 0 8 10 0 1 0-16 0',
  knitcap: 'M38 46c0-16 10-26 26-26 12 0 22 8 22 20v6zM36 46h52v6H36zM62 18a4 4 0 1 0 0 1',
  pilot: 'M36 44c0-16 12-26 28-26 12 0 22 8 22 20v6zM70 40a8 6 0 1 0 16 0 8 6 0 1 0-16 0',
};

const EXTRA = {
  pince: '<circle cx="80" cy="50" r="5" style="stroke:var(--art-bg)" stroke-width="1.8" fill="none"/><path d="M80 55c-2 10-6 14-12 18" style="stroke:var(--art-bg)" stroke-width="1" fill="none"/>',
  glasses: '<circle cx="79" cy="50" r="5.5" style="stroke:var(--art-bg)" stroke-width="2" fill="none"/><path d="M74 50H58" style="stroke:var(--art-bg)" stroke-width="1.6" fill="none"/>',
  bowtie: '<path d="M58 99l-8-6v12zM58 99l8-6v12z" style="fill:var(--art-bg)"/>',
  collar: '<path d="M44 100l14 6 10-8M58 106v14" style="stroke:var(--art-bg)" stroke-width="2" fill="none"/>',
  uniform: '<path d="M44 102h26M40 112l8-4M74 112l-6-4" style="stroke:var(--art-bg)" stroke-width="2" fill="none"/><circle cx="57" cy="114" r="2" style="fill:var(--art-bg)"/>',
  lace: '<path d="M42 100c4 4 8 4 10 0 2 4 6 4 8 0 2 4 6 4 8 0" style="stroke:var(--art-bg)" stroke-width="1.8" fill="none"/>',
  earring: '<circle cx="62" cy="76" r="2.4" style="fill:var(--art-bg)"/>',
  turtleneck: '<path d="M48 92h22M48 98h24" style="stroke:var(--art-bg)" stroke-width="1.8" fill="none"/>',
  apron: '<path d="M46 104h28l-2 16H48z" style="fill:var(--art-bg)"/>',
  medal: '<circle cx="64" cy="110" r="3.4" style="fill:var(--art-bg)"/><path d="M62 104l2 4 2-4" style="stroke:var(--art-bg)" stroke-width="1.4" fill="none"/>',
};

function portrait(p) {
  const sex = p.sex === 'f' ? 'f' : 'm';
  const parts = [];
  parts.push(`<path d="${HEAD[sex]}" fill="currentColor"/>`);
  if (p.hair && HAIR[p.hair]) parts.push(`<path d="${HAIR[p.hair]}" fill="currentColor"/>`);
  if (p.beard && BEARD[p.beard]) parts.push(`<path d="${BEARD[p.beard]}" fill="currentColor"/>`);
  if (p.hat && HAT[p.hat]) {
    const hp = HAT[p.hat];
    if (p.hat === 'headphones') {
      parts.push(`<path d="M50 54c-4-22 6-36 22-36 12 0 18 8 18 18" fill="none" stroke="currentColor" stroke-width="5"/>
        <path d="M50 54c-4-22 6-36 22-36 12 0 18 8 18 18" fill="none" style="stroke:var(--art-bg)" stroke-width="1.4"/>
        <ellipse cx="52" cy="58" rx="9" ry="11" fill="currentColor" style="stroke:var(--art-bg)" stroke-width="2"/>`);
    } else {
      parts.push(`<path d="${hp}" fill="currentColor"/>`);
      if (p.hat === 'ushanka') parts.push('<path d="M40 30l4 6M50 24l3 6M62 21l2 6M74 22l1 6M84 28l-1 6M36 56l5 2M35 64l5 1" style="stroke:var(--art-bg)" stroke-width="1.6" fill="none"/>');
    }
  }
  for (const x of [p.glasses, p.collar, p.earring ? 'earring' : null, ...(p.extra || [])]) {
    if (x && EXTRA[x]) parts.push(EXTRA[x]);
  }
  return `
    <defs><clipPath id="cam-${p.id}"><ellipse cx="60" cy="62" rx="40" ry="50"/></clipPath></defs>
    <ellipse cx="60" cy="62" rx="40" ry="50" fill="currentColor" fill-opacity=".1"/>
    <g clip-path="url(#cam-${p.id})">${parts.join('')}</g>
    <ellipse cx="60" cy="62" rx="40" ry="50" fill="none" stroke="currentColor" stroke-width="3"/>
    <ellipse cx="60" cy="62" rx="45" ry="55" fill="none" stroke="currentColor" stroke-width="1.2"/>`;
}

// SVG для карты. Неизвестное — пустая строка.
export function artSvg(art, caseData) {
  if (!art) return '';
  if (art.startsWith('p:')) {
    const id = art.slice(2);
    const person = caseData?.people?.[id];
    if (!person) return '';
    return `<svg viewBox="0 0 120 120" aria-hidden="true">${portrait({ id: caseData.id + '-' + id, ...person })}</svg>`;
  }
  const draw = OBJECTS[art];
  return draw ? `<svg viewBox="0 0 120 120" aria-hidden="true">${draw()}</svg>` : '';
}

export const ART_NAMES = Object.keys(OBJECTS);

// ---------- обложки дел (viewBox 0 0 360 120) ----------
const stars = (pts) => pts.map(([x, y, r = 1.6]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor"/>`).join('');
const COVERS = {
  'night-express': () => `
    <circle cx="300" cy="30" r="16" fill="currentColor" fill-opacity=".9"/><circle cx="292" cy="26" r="15" style="fill:var(--art-bg)"/>
    ${stars([[40, 20], [80, 34], [130, 14], [190, 28], [240, 12], [340, 50], [20, 60]])}
    <path d="M0 104h360" stroke="currentColor" stroke-width="2"/><path d="M0 110h360" stroke="currentColor" stroke-width="2" stroke-dasharray="8 8"/>
    <g fill="currentColor">
      <path d="M40 98V70h26V56h12v42z"/><path d="M46 56h10V42H46z"/>
      ${[0, 1, 2].map((i) => `<rect x="${84 + i * 82}" y="62" width="76" height="36" rx="3"/>`).join('')}
    </g>
    ${[0, 1, 2].map((i) => [0, 1, 2, 3].map((j) => `<rect x="${90 + i * 82 + j * 18}" y="70" width="12" height="11" style="fill:var(--art-bg)" ${j === 2 && i === 1 ? '' : 'fill-opacity=".5"'}/>`).join('')).join('')}
    <path d="M50 38c-6-8 8-12 4-22 14 0 20 12 12 20 14-4 24 6 16 14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-opacity=".6"/>`,
  'last-act': () => `
    <path d="M0 8h360v12H0z" fill="currentColor"/>
    <path d="M0 20c20 40 10 70 18 100h70c-20-30-24-70-10-100zM360 20c-20 40-10 70-18 100h-70c20-30 24-70 10-100z" fill="currentColor" fill-opacity=".85"/>
    <path d="M78 20c40 22 164 22 204 0" fill="none" stroke="currentColor" stroke-width="3"/>
    <path d="M180 20l-60 100M180 20l60 100" stroke="currentColor" stroke-width="1" stroke-opacity=".4"/>
    <path d="M120 120l60-100 60 100z" fill="currentColor" fill-opacity=".08"/>
    <g transform="translate(120 10) scale(1)">${OBJECTS.masks()}</g>
    <path d="M100 112h160" stroke="currentColor" stroke-width="3"/>`,
  'snow-estate': () => `
    ${stars([[20, 20, 2], [60, 40, 2.4], [100, 14, 2], [150, 30, 1.6], [250, 18, 2.4], [300, 40, 2], [340, 16, 2], [200, 8, 1.6], [320, 80, 2], [40, 84, 2]])}
    <g transform="translate(120 0)">${OBJECTS.manor()}</g>
    <path d="M30 104V60M30 70l-10-10M30 78l12-12M30 88l-8-6M330 104V54M330 64l12-12M330 74l-12-10M330 86l10-8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    <path d="M0 108c60-8 120 4 180-2s120 6 180-2v16H0z" fill="currentColor" fill-opacity=".14"/>`,
  'polar-night': () => `
    <path d="M0 40c40-20 80 10 120-6s80-24 120-4 80 12 120-8" fill="none" stroke="currentColor" stroke-width="6" stroke-opacity=".25"/>
    <path d="M0 52c50-16 90 8 130-6s80-18 120 0 70 8 110-6" fill="none" stroke="currentColor" stroke-width="3" stroke-opacity=".4"/>
    ${stars([[30, 14], [90, 24], [160, 10], [210, 26], [280, 14], [340, 30]])}
    <g transform="translate(116 6)">${OBJECTS.station()}</g>
    <path d="M220 96c20 4 40 6 60 10M232 90v14M254 94v14M276 98v12" fill="none" stroke="currentColor" stroke-width="2.4"/>
    <path d="M0 112c60-6 120 2 180-2s120 4 180-2v12H0z" fill="currentColor" fill-opacity=".14"/>`,
};

export function coverSvg(caseId) {
  const draw = COVERS[caseId];
  return draw ? `<svg viewBox="0 0 360 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${draw()}</svg>` : '';
}
