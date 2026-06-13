// 2026 F1 Fantasy data.
// Driver roster confirmed against Jolpica/Ergast 2026 driver list (May 2026).
// Prices are placeholders [VERIFY THIS] — update from fantasy.formula1.com
// when the in-app numbers feel off. Everything is plain TS, no build step.

export type ConstructorId =
  | "MCL"
  | "FER"
  | "MER"
  | "RBR"
  | "AST"
  | "ALP"
  | "WIL"
  | "RB"
  | "AUD"
  | "HAA"
  | "CAD";

export type Constructor = {
  id: ConstructorId;
  name: string;
  short: string;
  color: string;
  price: number; // millions
};

// [VERIFY THIS] — placeholder constructor prices in millions.
export const CONSTRUCTORS: Constructor[] = [
  { id: "MCL", name: "McLaren",       short: "MCL", color: "#FF8000", price: 30.5 },
  { id: "MER", name: "Mercedes",      short: "MER", color: "#27F4D2", price: 28.0 },
  { id: "FER", name: "Ferrari",       short: "FER", color: "#E80020", price: 25.5 },
  { id: "RBR", name: "Red Bull",      short: "RBR", color: "#3671C6", price: 22.0 },
  { id: "WIL", name: "Williams",      short: "WIL", color: "#64C4FF", price: 17.0 },
  { id: "ALP", name: "Alpine",        short: "ALP", color: "#FF87BC", price: 15.0 },
  { id: "AST", name: "Aston Martin",  short: "AST", color: "#229971", price: 13.0 },
  { id: "HAA", name: "Haas",          short: "HAA", color: "#B6BABD", price: 11.0 },
  { id: "RB",  name: "Racing Bulls",  short: "RB",  color: "#6692FF", price:  9.5 },
  { id: "AUD", name: "Audi",          short: "AUD", color: "#52E252", price:  8.0 },
  { id: "CAD", name: "Cadillac",      short: "CAD", color: "#C0C0C0", price:  6.0 },
];

export type Driver = {
  number: number;
  acronym: string;
  name: string;
  team: ConstructorId;
  price: number; // millions
};

// 2026 grid confirmed from race results. Prices are placeholders [VERIFY THIS].
export const DRIVERS: Driver[] = [
  // McLaren
  { number: 1,  acronym: "NOR", name: "Lando Norris",          team: "MCL", price: 31.5 },
  { number: 81, acronym: "PIA", name: "Oscar Piastri",         team: "MCL", price: 27.0 },
  // Mercedes
  { number: 12, acronym: "ANT", name: "Andrea Kimi Antonelli", team: "MER", price: 24.0 },
  { number: 63, acronym: "RUS", name: "George Russell",        team: "MER", price: 22.5 },
  // Ferrari
  { number: 16, acronym: "LEC", name: "Charles Leclerc",       team: "FER", price: 23.0 },
  { number: 44, acronym: "HAM", name: "Lewis Hamilton",        team: "FER", price: 20.5 },
  // Red Bull
  { number: 3,  acronym: "VER", name: "Max Verstappen",        team: "RBR", price: 26.0 },
  { number: 6,  acronym: "HAD", name: "Isack Hadjar",          team: "RBR", price: 11.5 },
  // Williams
  { number: 55, acronym: "SAI", name: "Carlos Sainz",          team: "WIL", price: 16.0 },
  { number: 23, acronym: "ALB", name: "Alex Albon",            team: "WIL", price: 14.5 },
  // Alpine
  { number: 43, acronym: "COL", name: "Franco Colapinto",      team: "ALP", price: 11.0 },
  { number: 10, acronym: "GAS", name: "Pierre Gasly",          team: "ALP", price:  9.5 },
  // Aston Martin
  { number: 14, acronym: "ALO", name: "Fernando Alonso",       team: "AST", price: 10.0 },
  { number: 18, acronym: "STR", name: "Lance Stroll",          team: "AST", price:  7.5 },
  // Haas
  { number: 87, acronym: "BEA", name: "Oliver Bearman",        team: "HAA", price:  9.0 },
  { number: 31, acronym: "OCO", name: "Esteban Ocon",          team: "HAA", price:  8.5 },
  // Racing Bulls
  { number: 41, acronym: "LIN", name: "Arvid Lindblad",        team: "RB",  price:  7.0 },
  { number: 30, acronym: "LAW", name: "Liam Lawson",           team: "RB",  price:  6.5 },
  // Audi
  { number: 5,  acronym: "BOR", name: "Gabriel Bortoleto",     team: "AUD", price:  6.5 },
  { number: 27, acronym: "HUL", name: "Nico Hulkenberg",       team: "AUD", price:  6.0 },
  // Cadillac
  { number: 11, acronym: "PER", name: "Sergio Perez",          team: "CAD", price:  5.5 },
  { number: 77, acronym: "BOT", name: "Valtteri Bottas",       team: "CAD", price:  4.5 },
];

// [VERIFY THIS] — official 2026 budget cap.
export const BUDGET_CAP = 100.0; // millions

export const SQUAD_SIZE = {
  drivers: 5,
  constructors: 2,
};

// DRS Boost multiplier on chosen driver this round.
// [VERIFY THIS] — 2x is current; check official rules each season.
export const DRS_BOOST_MULTIPLIER = 2;

export function driverByNumber(num: number): Driver | undefined {
  return DRIVERS.find((d) => d.number === num);
}

export function driverByAcronym(a: string): Driver | undefined {
  return DRIVERS.find((d) => d.acronym === a);
}

export function constructorById(id: ConstructorId): Constructor | undefined {
  return CONSTRUCTORS.find((c) => c.id === id);
}

export function teamDrivers(id: ConstructorId): Driver[] {
  return DRIVERS.filter((d) => d.team === id);
}

export function teammate(d: Driver): Driver | undefined {
  return DRIVERS.find((x) => x.team === d.team && x.number !== d.number);
}
