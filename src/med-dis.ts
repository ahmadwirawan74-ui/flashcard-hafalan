/**
 * Modul Penyakit (v20): tipe data, tingkat kemampuan SKDI 2019, dan gabungan data penyakit.
 * Isi klinis ditulis ulang dengan bahasa sendiri dari CURRENT Medical Diagnosis & Treatment 2026 (CMDT),
 * Macleod's Clinical Examination 15th ed. (2024), dan disesuaikan dengan konteks layanan primer Indonesia
 * (SKDI 2019, PPK/PNPK). Bukan salinan teks buku.
 */
import { DIS_A, DIS_B, DIS_C, DIS_D } from "./med-dis-base";
import { DIS_SKDI, SKDI_LINK } from "./med-dis-skdi";

export interface RxItem {
	/** id obat di database (untuk tautan & interaksi) */
	d?: string;
	/** baris R/ — nama, sediaan, kekuatan, jumlah (angka Romawi) */
	r: string;
	/** baris signa */
	s: string;
	/** Hitung otomatis dari BB pasien: regimen & sediaan di database obat. */
	kg?: { reg?: number; prep?: number; days: number };
}
export interface Rx { label: string; who: "dewasa" | "anak"; items: RxItem[]; note?: string }

export interface Disease {
	id: string;
	name: string;
	en?: string;
	icd?: string;
	/** id sistem SKDI (saraf, respirasi, kardio, ...) */
	sys: string;
	/** tingkat kemampuan SKDI 2019 */
	lvl: string;
	/** indeks baris daftar SKDI yang dicakup materi ini */
	skdi?: number[];
	def: string;
	epi: string[];
	etio: string[];
	klas: string[];
	pato: string[];
	klinis: string[];
	sub?: string[];
	dx: string[];
	lab?: string[];
	patol?: string[];
	ddx: string[];
	farm: string[];
	non: string[];
	edu: string[];
	komp?: string[];
	rujuk?: string[];
	/** temuan pemeriksaan fisik khas */
	pf: string[];
	/** modul pemeriksaan fisik terkait (id di med-pf) */
	pfMod: string[];
	/** obat terkait (id database obat) */
	drugs: string[];
	rx: Rx[];
	src: string[];
}

export const LEVELS: Record<string, { label: string; short: string; color: string; desc: string }> = {
	"1": { label: "Tingkat 1", short: "Mengenali & menjelaskan", color: "#64748b", desc: "Mengenali gambaran klinis, mencari informasi lanjutan, merujuk dengan tepat, dan menindaklanjuti setelah kembali dari rujukan." },
	"2": { label: "Tingkat 2", short: "Mendiagnosis & merujuk", color: "#0ea5e9", desc: "Membuat diagnosis klinis berdasarkan anamnesis & pemeriksaan fisik, lalu merujuk ke fasilitas yang tepat." },
	"3A": { label: "Tingkat 3A", short: "Diagnosis, terapi awal, rujuk (bukan gawat darurat)", color: "#f59e0b", desc: "Diagnosis klinis dengan penunjang sederhana, memberi terapi pendahuluan pada keadaan bukan gawat darurat, lalu merujuk." },
	"3B": { label: "Tingkat 3B", short: "Diagnosis, terapi awal, rujuk (gawat darurat)", color: "#ef4444", desc: "Diagnosis klinis dan terapi pendahuluan pada keadaan gawat darurat untuk menyelamatkan nyawa/mencegah kecacatan, lalu merujuk." },
	"4": { label: "Tingkat 4", short: "Diagnosis & tata laksana tuntas", color: "#16a34a", desc: "Mendiagnosis dan menatalaksana secara mandiri dan tuntas (4A: kompetensi saat lulus dokter)." },
};

export const DISEASES: Disease[] = [...DIS_A, ...DIS_B, ...DIS_C, ...DIS_D, ...DIS_SKDI];
const BY_ID = new Map(DISEASES.map((d) => [d.id, d]));
export const diseaseById = (id: string) => BY_ID.get(id);
/** Materi penyakit untuk baris SKDI ke-i. */
export const diseaseForRow = (i: number) => { const id = SKDI_LINK[i]; return id ? BY_ID.get(id) : undefined; };
/** Semua indeks baris SKDI yang dicakup materi (kebalikan SKDI_LINK). */
export function rowsOf(id: string): number[] { const out: number[] = []; for (const k in SKDI_LINK) if (SKDI_LINK[k] === id) out.push(+k); return out; }

/** Cari materi lengkap untuk nama penyakit SKDI (pencocokan kata kunci sederhana). */
const KEYMAP: [RegExp, string][] = [
	[/^faringitis akut|^tonsilitis akut/, "faringitis"], [/^asma bronkial|status asmatikus/, "asma"], [/^pneumonia komunitas|^pneumonia, bronkopneumonia/, "pneumonia"],
	[/^bronkiolitis akut/, "bronkiolitis"], [/^tb paru tanpa/, "tbparu"], [/^ppok eksaserbasi/, "ppok"], [/^demam tifoid$/, "tifoid"], [/^demam dengue|dengue shock/, "dengue"],
	[/^malaria$/, "malaria"], [/^leptospirosis \(tanpa/, "leptospirosis"], [/^morbili/, "campak"], [/^hipertensi esensial$/, "hipertensi"], [/^hipertensi krisis/, "krisis-ht"],
	[/^sindrom koroner akut|^infark miokard$/, "ska"], [/^gagal jantung (akut|kronik)$/, "gagal-jantung"], [/^diabetes melitus tipe 2$/, "dm2"], [/^hipoglikemia/, "hipoglikemia"],
	[/^ketoasidosis/, "kad"], [/^dislipidemia$/, "dislipidemia"], [/^artritis gout akut|^hiperurisemia$/, "gout"], [/^anemia defisiensi besi/, "anemia-besi"], [/^hipertiroid$/, "hipertiroid"],
	[/^refluks gastro/, "gerd"], [/^gastritis/, "dispepsia"], [/^gastroenteritis/, "diare-akut"], [/^disentri/, "disentri"], [/^apendisitis akut/, "apendisitis"], [/^hepatitis a$/, "hepatitis-a"],
	[/^askariasis/, "askariasis"], [/^infeksi saluran kemih( bagian bawah)?/, "isk"], [/^pielonefritis tanpa/, "pielonefritis"], [/^preeklampsia/, "preeklamsia"], [/^vaginosis/, "vaginosis"],
	[/^vulvovaginitis candida/, "kandidiasis-vv"], [/^gonore$|^uretritis gonore tanpa/, "gonore"], [/^kejang demam/, "kejang-demam"], [/^tension headache/, "tth"], [/^migren$/, "migren"],
	[/^bells/, "bells-palsy"], [/^vertigo \(benign/, "bppv"], [/^infark serebral/, "stroke-iskemik"], [/^gangguan depresi ringan/, "depresi"], [/^skabies$/, "skabies"],
	[/^tinea\/ pitiriasis|^tinea fasialis/, "tinea"], [/^herpes zoster/, "herpes-zoster"], [/^varisela/, "varisela"], [/^impetigo/, "impetigo"], [/^akne vulgaris ringan/, "akne"],
	[/^urtikaria akut/, "urtikaria"], [/^sifilis primer/, "sifilis"], [/^konjungtivitis/, "konjungtivitis"], [/^reaksi anafilaktik/, "anafilaksis"],
];
export const diseaseFor = (skdiName: string) => { const n = skdiName.toLowerCase().replace(/[’']/g, ""); const k = KEYMAP.find(([re]) => re.test(n)); return k ? DISEASES.find((d) => d.id === k[1]) : undefined; };
