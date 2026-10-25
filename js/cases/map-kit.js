// Помощники для схем мест преступления.
// Схема — это список фигур в координатах viewBox. Фигура с полем when
// показывается, только когда на стол легла карта с такой меткой (marks).
//
// Классы (c): outer — внешняя стена, room — комната, room2 — комната с заливкой,
// zone — участок на улице, glass — застеклённое помещение, win — окно, door — дверь,
// band — полоса (перрон), line — пунктир (тропа, трос).
// Классы текста: num — крупный номер, name — имя, label — подпись, small — мелкая подпись,
// caption — подпись по краю, plabel — надпись на полосе.

export const rect = (x, y, w, h, c = 'room', when) => ({ t: 'rect', x, y, w, h, c, when });
export const text = (x, y, s, c = 'label', when) => ({ t: 'text', x, y, s, c, when });
export const line = (x1, y1, x2, y2, c = 'line', when) => ({ t: 'line', x1, y1, x2, y2, c, when });

// Комната с подписью по центру.
export function room(x, y, w, h, label, c = 'room', cls = 'label') {
  return [rect(x, y, w, h, c), text(x + w / 2, y + h / 2 + 5, label, cls)];
}
