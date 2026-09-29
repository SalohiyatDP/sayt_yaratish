/**
 * Chegara (boundary) ma'lumoti bilan ishlash yordamchilari.
 *
 * Chegara ikki formatда bo'lishi mumkin:
 *   • Eski (bitta poligon):  [[lat,lng], [lat,lng], ...]
 *   • Yangi (ko'p poligon):  [[[lat,lng],...], [[lat,lng],...]]
 * KMZ ichida bir nechta ko'pburchak bo'lishi mumkin, shuning uchun yangi
 * formatда saqlanadi. Bu yordamchi ikkalasini ham bir xil ishlaydigan
 * "poligonlar ro'yxati" ga keltiradi.
 */

/**
 * Istalgan chegara formatini poligonlar ro'yxatiga aylantiradi.
 * @param {*} value boundary qiymati (bitta yoki ko'p poligon)
 * @returns {Array<Array<[number, number]>>} har biri >= 3 nuqtali poligonlar
 */
export function toPolygonList(value) {
  if (!Array.isArray(value) || value.length === 0) return [];
  // Ko'p-poligon: birinchi element o'zi nuqtalar massivi (ichma-ich massiv)
  const isMulti = Array.isArray(value[0]) && Array.isArray(value[0][0]);
  const polygons = isMulti ? value : [value];
  return polygons.filter((poly) => Array.isArray(poly) && poly.length >= 3);
}
