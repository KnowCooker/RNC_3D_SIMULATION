import type { XPengId } from './xpeng-catalog';

type Stations = readonly (readonly [number, number])[];
/** Independently traced longitudinal stations in metres. Photo estimates, not CAD tolerances.
 * +Z forward; the roof includes windscreen and liftback, rather than a scaled generic roof. */
export const xpengProfiles: Record<Exclude<XPengId,'p7plus'>, {
  roof: Stations; shoulder: Stations; width: Stations; hood: Stations;
  tire: number; rim: number; roofHalf: number; screenFront: number; screenRear: number;
  roofFront: number; roofRear: number; split: number; rearDoor: number;
}> = {
  x9: {
    roof:[[-2.48,1.20],[-2.18,1.46],[-1.77,1.70],[-1.1,1.766],[.1,1.774],[.75,1.73],[1.11,1.57],[1.45,1.34],[1.78,1.15]],
    shoulder:[[-2.658,1.16],[-2,1.22],[-1,1.20],[0,1.15],[1,1.13],[1.8,1.13],[2.658,1.06]],
    width:[[-2.658,.87],[-2.25,.956],[-1.58,.994],[-.3,.973],[.8,.977],[1.58,.994],[2.15,.978],[2.658,.89]],
    hood:[[1.78,1.155],[2,1.13],[2.30,1.098],[2.658,1.045]],
    tire:.372,rim:.254,roofHalf:.79,screenFront:1.78,screenRear:-2.48,roofFront:.75,roofRear:-1.77,split:.27,rearDoor:-1.28,
  },
  l03: {
    roof:[[-2.13,1.11],[-1.70,1.31],[-1.1,1.49],[-.45,1.587],[.1,1.588],[.56,1.51],[.91,1.34],[1.30,1.11]],
    shoulder:[[-2.325,1.09],[-1.8,1.10],[-1,1.075],[0,1.035],[.8,1.035],[1.425,1.06],[2.325,.845]],
    width:[[-2.325,.855],[-1.9,.931],[-1.425,.96],[-.4,.937],[.5,.94],[1.425,.96],[1.9,.928],[2.325,.85]],
    hood:[[1.30,1.088],[1.55,1.031],[1.85,.956],[2.325,.832]],
    tire:.365,rim:.254,roofHalf:.735,screenFront:1.30,screenRear:-2.13,roofFront:.56,roofRear:-1.1,split:-.12,rearDoor:-1.15,
  },
  m03: {
    roof:[[-2.08,1.005],[-1.65,1.16],[-1.08,1.327],[-.40,1.424],[.18,1.423],[.58,1.348],[.93,1.19],[1.32,.98]],
    shoulder:[[-2.3925,.945],[-1.9,1.005],[-1.4075,.992],[-.4,.96],[.6,.934],[1.4075,.965],[1.9,.91],[2.3925,.76]],
    width:[[-2.3925,.866],[-1.95,.932],[-1.4075,.948],[-.4,.933],[.6,.936],[1.4075,.948],[1.9,.93],[2.3925,.858]],
    hood:[[1.32,.97],[1.55,.939],[1.91,.858],[2.3925,.75]],
    tire:.351,rim:.2413,roofHalf:.737,screenFront:1.32,screenRear:-2.08,roofFront:.58,roofRear:-1.08,split:-.1,rearDoor:-1.12,
  },
  gx: {
    roof:[[-2.43,1.31],[-2.16,1.63],[-1.88,1.767],[-1,1.79],[0,1.785],[.63,1.73],[.95,1.52],[1.31,1.24]],
    shoulder:[[-2.6325,1.23],[-2.1,1.25],[-1.5575,1.26],[-.5,1.22],[.5,1.21],[1.5575,1.225],[2.15,1.17],[2.6325,1.10]],
    width:[[-2.6325,.925],[-2.2,.985],[-1.5575,.9995],[-.4,.98],[.7,.981],[1.5575,.9995],[2.14,.982],[2.6325,.922]],
    hood:[[1.31,1.245],[1.70,1.228],[2.12,1.192],[2.6325,1.095]],
    tire:.398,rim:.2794,roofHalf:.831,screenFront:1.31,screenRear:-2.43,roofFront:.63,roofRear:-1.88,split:.12,rearDoor:-1.32,
  },
};
export function sampleXPeng(rows: Stations, z: number): number {
  let i=0;while(i<rows.length-2&&z>rows[i+1][0])i++;
  const a=rows[i],b=rows[i+1],p=rows[Math.max(0,i-1)],n=rows[Math.min(rows.length-1,i+2)];
  const t=Math.max(0,Math.min(1,(z-a[0])/(b[0]-a[0]))),d=b[0]-a[0];
  return (2*t**3-3*t*t+1)*a[1]+(t**3-2*t*t+t)*d*(b[1]-p[1])/(b[0]-p[0])+(-2*t**3+3*t*t)*b[1]+(t**3-t*t)*d*(n[1]-a[1])/(n[0]-a[0]);
}
