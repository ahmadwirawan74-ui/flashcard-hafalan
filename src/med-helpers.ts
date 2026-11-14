import type { Prep, Reg, Who } from "./med-data";

// ---------------------------------------------------------------- pembantu
export type O = Partial<Reg>;
const rng = (d: number | [number, number]): [number, number] => (Array.isArray(d) ? d : [d, d]);
export const kg = (who: Who, label: string, route: string, dose: number | [number, number], freq: number, every: string, o: O = {}): Reg => ({ who, label, route, kind: "kg", dose: rng(dose), freq, every, ...o });
export const kgd = (who: Who, label: string, route: string, dose: number | [number, number], freq: number, every: string, o: O = {}): Reg => ({ who, label, route, kind: "kgday", dose: rng(dose), freq, every, ...o });
export const fx = (who: Who, label: string, route: string, dose: number | [number, number], freq: number, every: string, o: O = {}): Reg => ({ who, label, route, kind: "fixed", dose: rng(dose), freq, every, ...o });
export const tx = (who: Who, label: string, route: string, text: string, o: O = {}): Reg => ({ who, label, route, kind: "text", text, ...o });
export const A: Who = "dewasa", C: Who = "anak";
export const tab = (mg: number, l = "Tablet"): Prep => ({ label: `${l} ${fmt(mg)} mg`, form: "tab", mg });
export const kap = (mg: number): Prep => ({ label: `Kapsul ${fmt(mg)} mg`, form: "kap", mg });
export const syr = (mg: number, ml: number, l = "Sirup"): Prep => ({ label: `${l} ${fmt(mg)} mg/${ml} mL`, form: "syr", mgMl: mg / ml });
export const drop = (mgMl: number, l = "Drops"): Prep => ({ label: `${l} ${fmt(mgMl)} mg/mL`, form: "drop", mgMl });
export const inj = (mg: number, ml: number, l = "Injeksi"): Prep => ({ label: `${l} ${fmt(mg)} mg/${ml} mL`, form: "inj", mgMl: mg / ml });
export function fmt(n: number) { return n.toLocaleString("id-ID", { maximumFractionDigits: 3 }); }



export const PREG_SAFE = "Umumnya dapat dipakai bila ada indikasi; data keamanan baik.";
export const LACT_OK = "Dapat dipakai saat menyusui.";
