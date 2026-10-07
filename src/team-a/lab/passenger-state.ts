import { isPassenger, type PassengerId } from '../viewer/passenger-model';
import type { PassengerSeat, PassengerAssignments } from '../viewer/passenger-cabin';

/** Purely visual, per-vehicle preferences. Deliberately outside LabConfig/run identity. */
export function createPassengerState() {
  const vehicles = new Map<string, Record<string, PassengerId | null>>();
  let asset = '', seats: readonly PassengerSeat[] = [];
  const current = () => vehicles.get(asset)!;
  return {
    get assignments(): PassengerAssignments { return { ...current() }; },
    bind(id: string, available: readonly PassengerSeat[]) {
      asset = id; seats = available;
      const previous = vehicles.get(id) ?? {};
      vehicles.set(id, Object.fromEntries(available.map(s => [s.id, previous[s.id] ?? null])));
      return { ...current() };
    },
    choose(seat: string, passenger: PassengerId | null) {
      if (!seats.some(s => s.id === seat) || passenger !== null && !isPassenger(passenger)) return false;
      current()[seat] = passenger; return true;
    },
    clear() { for (const seat of seats) current()[seat.id] = null; },
    fill() { seats.forEach((s, i) => current()[s.id] = i < 3 ? (['niulai', 'ayaka', 'luffy'] as const)[i] : null); },
  };
}
