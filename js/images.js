// Готовые картинки из нейросети. Лежат в img/<дело>/<id>.jpg.
// Перечислите здесь id карт (и 'cover' для обложки), для которых картинка уже есть:
// они покажутся вместо векторного рисунка. Подробнее — в prompts/README.md.
export const IMAGES = {
  'night-express': [],
  'last-act': [],
  'snow-estate': [],
  'polar-night': [],
};

export function imageUrl(caseId, id) {
  return IMAGES[caseId]?.includes(id) ? `img/${caseId}/${id}.jpg` : null;
}
