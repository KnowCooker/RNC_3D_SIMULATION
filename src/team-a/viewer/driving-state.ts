import { registeredVehicleLayout, type Vec3 } from '../../shared/lab-contracts';

export type DrivingView = 'orbit' | 'overhead' | 'fl' | 'fr' | 'rl' | 'rr' | 'tl' | 'tr';
// Eye positions derived from the current P7+ seat geometry, in the SAME car coordinates.
// They are viewing locations, not replacements for the acoustic microphones.
export const cabinViews: Record<Exclude<DrivingView, 'orbit' | 'overhead' | 'tl' | 'tr'>, { label: string; eye: Vec3; seat: string }> = {
  fl: { label: '主驾', eye: [.465, 1.17, .49], seat: 'seat-1-1' },
  fr: { label: '副驾', eye: [-.465, 1.17, .49], seat: 'seat-1-2' },
  rl: { label: '左后排', eye: [.49, 1.17, -.72], seat: 'seat-2-1' },
  rr: { label: '右后排', eye: [-.49, 1.17, -.72], seat: 'seat-2-3' },
};
export type CabinView = Exclude<DrivingView,'orbit'|'overhead'>;
export const isCabinView = (view: DrivingView): view is CabinView => !['orbit','overhead'].includes(view);
export function cabinViewsForAsset(assetId:string|undefined):Record<CabinView,{label:string;eye:Vec3;seat:string}> {
  const row=registeredVehicleLayout(assetId);
  const third={tl:{label:'三排左座',eye:[.48,1.27,-1.42] as Vec3,seat:'seat-3-1'},tr:{label:'三排右座',eye:[-.48,1.27,-1.42] as Vec3,seat:`seat-3-${assetId==='xpeng-x9'?3:2}`}};
  if(!row||assetId==='xpeng-p7plus')return {...cabinViews,...third};
  const make=(right:boolean,r:number,label:string)=>({label,eye:[right?-.48:.48,1.27,row.seatZ[r]+.10] as Vec3,seat:`seat-${r+1}-${right?(r===1?row.secondRowSeats:r===2&&assetId==='xpeng-x9'?3:2):1}`});
  return {fl:make(false,0,'主驾'),fr:make(true,0,'副驾'),rl:make(false,1,'二排左座'),rr:make(true,1,'二排右座'),...third,...(row.seatZ.length===3?{tl:make(false,2,'三排左座'),tr:make(true,2,'三排右座')}:{})};
}
export function travelDistance(time: number, speedKph: number) {
  if (!Number.isFinite(time) || !Number.isFinite(speedKph)) return 0;
  return Math.max(0, time) * Math.max(0, speedKph) / 3.6;
}
/** A stable world-indexed segment. Seeking backward reconstructs exactly the same scenery. */
export function roadSegment(slot: number, distance: number, count = 12, length = 48, behind = 3) {
  const first = Math.floor(distance / length) - behind;
  const index = first + ((slot - first % count + count) % count);
  return { index, z: index * length - distance };
}
export function drivingLook(eye: Vec3, yaw = 0, pitch = 0): Vec3 {
  const p = Math.max(-.55, Math.min(.55, pitch));
  return [eye[0] + Math.sin(yaw) * Math.cos(p) * 5, eye[1] + Math.sin(p) * 5, eye[2] + Math.cos(yaw) * Math.cos(p) * 5];
}
