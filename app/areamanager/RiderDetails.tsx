"use client";

export type Details = {
  vehicle_type: string; vehicle_number: string; licence_number: string;
  id_type: string; id_last4: string; emergency_name: string; emergency_phone: string; address: string;
};

export const emptyDetails = (): Details => ({
  vehicle_type: "", vehicle_number: "", licence_number: "", id_type: "", id_last4: "", emergency_name: "", emergency_phone: "", address: "",
});

export const VEHICLES: [string, string][] = [["motorbike", "Motorbike"], ["scooter", "Scooter"], ["electric", "Electric bike"], ["bicycle", "Bicycle"], ["other", "Other"]];
export const ID_TYPES: [string, string][] = [["aadhaar", "Aadhaar"], ["voter", "Voter ID"], ["pan", "PAN"], ["passport", "Passport"], ["other", "Other"]];
export const vehicleLabel = (v: string) => VEHICLES.find(([k]) => k === v)?.[1] ?? v;
export const idLabel = (v: string) => ID_TYPES.find(([k]) => k === v)?.[1] ?? v;

// Row from the am_rider_details function -> form values
export const fromRow = (r: any): Details => ({
  vehicle_type: r.out_vehicle_type ?? "", vehicle_number: r.out_vehicle_number ?? "", licence_number: r.out_licence_number ?? "",
  id_type: r.out_id_type ?? "", id_last4: r.out_id_last4 ?? "", emergency_name: r.out_emergency_name ?? "",
  emergency_phone: r.out_emergency_phone ?? "", address: r.out_address ?? "",
});

const alnum = (t: string) => t.replace(/[^A-Za-z0-9]/g, "");

// Same rules as the database, so mistakes show up before saving
export function checkDetails(d: Details): string | null {
  if (!d.vehicle_type) return "Choose the rider's vehicle.";
  if (d.vehicle_type !== "bicycle") {
    const n = alnum(d.vehicle_number).length;
    if (n < 6 || n > 12) return "Enter the vehicle number, for example PB10AB1234.";
    const l = alnum(d.licence_number).length;
    if (l < 8 || l > 20) return "Enter the driving licence number.";
  }
  if (d.id_type && alnum(d.id_last4).length !== 4) return "Enter only the last 4 digits of the ID.";
  if (!d.emergency_name.trim()) return "Enter the emergency contact name.";
  const p = d.emergency_phone.replace(/\D/g, "");
  if (!(p.length === 10 || (p.length === 12 && p.startsWith("91")))) return "Enter a valid 10-digit emergency contact number.";
  return null;
}

export const telHref = (p: string | null | undefined) => {
  const d = String(p ?? "").replace(/\D/g, "");
  return d ? "tel:+" + (d.length === 10 ? "91" + d : d) : undefined;
};

export function RiderDetailsFields({ value, onChange }: { value: Details; onChange: (d: Details) => void }) {
  const set = (k: keyof Details, v: string) => onChange({ ...value, [k]: v });
  const motor = !!value.vehicle_type && value.vehicle_type !== "bicycle";
  return (<div className="am-form">
    <label><span>Vehicle</span>
      <select value={value.vehicle_type} onChange={(e) => set("vehicle_type", e.target.value)}>
        <option value="">Choose a vehicle</option>
        {VEHICLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select></label>
    {motor && <>
      <label><span>Vehicle number</span>
        <input placeholder="e.g. PB10AB1234" value={value.vehicle_number} onChange={(e) => set("vehicle_number", e.target.value.toUpperCase())} autoCapitalize="characters" autoCorrect="off" /></label>
      <label><span>Driving licence number</span>
        <input placeholder="e.g. PB1020110012345" value={value.licence_number} onChange={(e) => set("licence_number", e.target.value.toUpperCase())} autoCapitalize="characters" autoCorrect="off" /></label>
    </>}
    <label><span>ID proof (optional)</span>
      <select value={value.id_type} onChange={(e) => set("id_type", e.target.value)}>
        <option value="">No ID added</option>
        {ID_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select></label>
    {value.id_type && <label><span>Last 4 digits of the ID</span>
      <input inputMode="text" maxLength={4} placeholder="1234" value={value.id_last4} onChange={(e) => set("id_last4", alnum(e.target.value).toUpperCase())} autoCorrect="off" /></label>}
    {value.id_type && <p className="adm-hint wide">Only the last 4 digits are stored. Do not type the full ID number.</p>}
    <label><span>Emergency contact name</span>
      <input placeholder="e.g. Father, wife, friend" value={value.emergency_name} onChange={(e) => set("emergency_name", e.target.value)} /></label>
    <label><span>Emergency contact number</span>
      <input type="tel" inputMode="tel" placeholder="9999999995" value={value.emergency_phone} onChange={(e) => set("emergency_phone", e.target.value)} /></label>
    <label className="wide"><span>Home address (optional)</span>
      <input placeholder="House, street, area" value={value.address} onChange={(e) => set("address", e.target.value)} /></label>
  </div>);
}
