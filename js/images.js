// Готовые картинки из нейросети. Лежат в img/<дело>/<id>.jpg.
// Перечислите здесь id карт (и 'cover' для обложки), для которых картинка уже есть:
// они покажутся вместо векторного рисунка. Подробнее — в prompts/README.md.
export const IMAGES = {
  'night-express': ['c01', 'c02', 'c03', 'c04', 'c05', 'c06', 'c07', 'c08', 'c09', 'c10', 'c11', 'c12', 'c13', 'c14', 'c15'],
  'last-act': [],
  'snow-estate': ['cover', 'h01', 'h02', 'h03', 'h04', 'h05', 'h06', 'h07', 'h08', 'h09', 'h10', 'h11', 'h12', 'h13', 'h14', 'h15', 'h16', 'h17', 'h18', 'h19', 'h20', 'h21', 'h22', 'h23', 'h24', 'h25', 'h26', 'h27', 'h28', 'h29', 'h30', 'h31', 'h32', 'h33', 'h34', 'h35', 'h36', 'h37', 'h38', 'h39', 'h40', 'h41', 'h42', 'h43'],
  'polar-night': [],
};

export function imageUrl(caseId, id) {
  return IMAGES[caseId]?.includes(id) ? `img/${caseId}/${id}.jpg` : null;
}
