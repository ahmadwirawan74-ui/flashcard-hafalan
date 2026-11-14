/**
 * Jadwal sholat offline (algoritma astronomi standar, gaya PrayTimes) dengan parameter Kemenag RI:
 * Subuh 20°, Isya 18°, Ashar mazhab Syafi'i (bayangan 1×), ihtiyath +2 menit, Imsak = Subuh − 10 menit.
 * Hasil bisa berbeda 1–2 menit dari jadwal resmi; tersedia koreksi manual per waktu.
 */
export interface City { name: string; lat: number; lng: number; tz: number; elev?: number }
export const CITIES: City[] = [
	{ name: "Jakarta", lat: -6.2088, lng: 106.8456, tz: 7 },
	{ name: "Bandung", lat: -6.9175, lng: 107.6191, tz: 7, elev: 768 },
	{ name: "Bogor", lat: -6.595, lng: 106.8166, tz: 7, elev: 265 },
	{ name: "Bekasi", lat: -6.2383, lng: 106.9756, tz: 7 },
	{ name: "Tangerang", lat: -6.1783, lng: 106.6319, tz: 7 },
	{ name: "Depok", lat: -6.4025, lng: 106.7942, tz: 7 },
	{ name: "Serang", lat: -6.1104, lng: 106.1640, tz: 7 },
	{ name: "Semarang", lat: -6.9667, lng: 110.4167, tz: 7 },
	{ name: "Yogyakarta", lat: -7.7956, lng: 110.3695, tz: 7, elev: 113 },
	{ name: "Solo", lat: -7.5755, lng: 110.8243, tz: 7 },
	{ name: "Surabaya", lat: -7.2575, lng: 112.7521, tz: 7 },
	{ name: "Malang", lat: -7.9666, lng: 112.6326, tz: 7, elev: 440 },
	{ name: "Banda Aceh", lat: 5.5483, lng: 95.3238, tz: 7 },
	{ name: "Medan", lat: 3.5952, lng: 98.6722, tz: 7 },
	{ name: "Padang", lat: -0.9471, lng: 100.4172, tz: 7 },
	{ name: "Pekanbaru", lat: 0.5071, lng: 101.4478, tz: 7 },
	{ name: "Jambi", lat: -1.6101, lng: 103.6131, tz: 7 },
	{ name: "Palembang", lat: -2.9761, lng: 104.7754, tz: 7 },
	{ name: "Bengkulu", lat: -3.7928, lng: 102.2608, tz: 7 },
	{ name: "Bandar Lampung", lat: -5.3971, lng: 105.2668, tz: 7 },
	{ name: "Batam", lat: 1.0456, lng: 104.0305, tz: 7 },
	{ name: "Pontianak", lat: -0.0263, lng: 109.3425, tz: 7 },
	{ name: "Palangka Raya", lat: -2.2161, lng: 113.9135, tz: 7 },
	{ name: "Banjarmasin", lat: -3.3186, lng: 114.5944, tz: 8 },
	{ name: "Samarinda", lat: -0.5022, lng: 117.1536, tz: 8 },
	{ name: "Balikpapan", lat: -1.2379, lng: 116.8529, tz: 8 },
	{ name: "Denpasar", lat: -8.6705, lng: 115.2126, tz: 8 },
	{ name: "Mataram", lat: -8.5833, lng: 116.1167, tz: 8 },
	{ name: "Kupang", lat: -10.1772, lng: 123.6070, tz: 8 },
	{ name: "Makassar", lat: -5.1477, lng: 119.4327, tz: 8 },
	{ name: "Kendari", lat: -3.9985, lng: 122.5129, tz: 8 },
	{ name: "Palu", lat: -0.8917, lng: 119.8707, tz: 8 },
	{ name: "Gorontalo", lat: 0.5435, lng: 123.0568, tz: 8 },
	{ name: "Manado", lat: 1.4748, lng: 124.8421, tz: 8 },
	{ name: "Ambon", lat: -3.6954, lng: 128.1814, tz: 9 },
	{ name: "Ternate", lat: 0.7893, lng: 127.3742, tz: 9 },
	{ name: "Jayapura", lat: -2.5337, lng: 140.7181, tz: 9 },
	{ name: "Kuala Lumpur", lat: 3.139, lng: 101.6869, tz: 8 },
	{ name: "Singapura", lat: 1.3521, lng: 103.8198, tz: 8 },
	{ name: "Makkah", lat: 21.4225, lng: 39.8262, tz: 3 },
];
export const PRAYER_NAMES = ["Imsak", "Subuh", "Terbit", "Dhuha", "Dzuhur", "Ashar", "Maghrib", "Isya"] as const;
export type PrayerName = (typeof PRAYER_NAMES)[number];

const rad = (d: number) => (d * Math.PI) / 180, deg = (r: number) => (r * 180) / Math.PI;
const fix = (a: number, b: number) => { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; };
const sin = (d: number) => Math.sin(rad(d)), cos = (d: number) => Math.cos(rad(d)), tan = (d: number) => Math.tan(rad(d));
const asin = (x: number) => deg(Math.asin(x)), acos = (x: number) => deg(Math.acos(x)), atan2 = (y: number, x: number) => deg(Math.atan2(y, x)), acot = (x: number) => deg(Math.atan(1 / x));

function julian(y: number, m: number, d: number) {
	if (m <= 2) { y -= 1; m += 12; }
	const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
	return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}
function sunPos(jd: number) {
	const D = jd - 2451545.0;
	const g = fix(357.529 + 0.98560028 * D, 360), q = fix(280.459 + 0.98564736 * D, 360);
	const L = fix(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360);
	const e = 23.439 - 0.00000036 * D;
	const RA = fix(atan2(cos(e) * sin(L), cos(L)) / 15, 24);
	return { decl: asin(sin(e) * sin(L)), eqt: q / 15 - RA };
}

/** Waktu sholat untuk tanggal tertentu (jam lokal kota, desimal). */
export function prayerTimes(date: Date, c: City, adj: number[] = []): Record<PrayerName, number> {
	const jd0 = julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) - c.lng / (15 * 24);
	const mid = (t: number) => fix(12 - sunPos(jd0 + t).eqt, 24);
	const angleTime = (angle: number, t: number, ccw: boolean) => {
		const { decl } = sunPos(jd0 + t);
		const T = acos((-sin(angle) - sin(decl) * sin(c.lat)) / (cos(decl) * cos(c.lat))) / 15;
		return mid(t) + (ccw ? -T : T);
	};
	const riseAngle = 0.833 + 0.0347 * Math.sqrt(Math.max(0, c.elev ?? 0));
	let t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18, isha: 18 };
	for (let i = 0; i < 2; i++) {
		const p = (h: number) => h / 24;
		const decl = sunPos(jd0 + p(t.asr)).decl;
		t = {
			fajr: angleTime(20, p(t.fajr), true),
			sunrise: angleTime(riseAngle, p(t.sunrise), true),
			dhuhr: mid(p(t.dhuhr)),
			asr: angleTime(-acot(1 + tan(Math.abs(c.lat - decl))), p(t.asr), false),
			maghrib: angleTime(riseAngle, p(t.maghrib), false),
			isha: angleTime(18, p(t.isha), false),
		};
	}
	const z = c.tz - c.lng / 15;
	const m = (h: number, ihtiyat: number, k: number) => h + z + (ihtiyat + (adj[k] ?? 0)) / 60;
	const subuh = m(t.fajr, 2, 1);
	return {
		Imsak: subuh - 10 / 60 + (adj[0] ?? 0) / 60,
		Subuh: subuh,
		Terbit: m(t.sunrise, -2, 2),
		Dhuha: m(t.sunrise, 15, 3),
		Dzuhur: m(t.dhuhr, 3, 4),
		Ashar: m(t.asr, 2, 5),
		Maghrib: m(t.maghrib, 2, 6),
		Isya: m(t.isha, 2, 7),
	};
}

export const hm = (h: number) => {
	const t = Math.round(h * 60);
	return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};
/** Waktu sholat sebagai timestamp (ms) pada hari `date`, memperhitungkan zona waktu kota vs perangkat. */
export function prayerAt(date: Date, c: City, name: PrayerName, adj: number[] = []): number {
	const h = prayerTimes(date, c, adj)[name];
	const utcMid = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
	return utcMid + (Math.round(h * 60) - c.tz * 60) * 60_000;
}
