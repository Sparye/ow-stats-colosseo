export type TeamCode =
  | 'ATL' | 'BOS' | 'CDH' | 'DAL' | 'FLA' | 'GLA' | 'GZC' | 'HOU' | 'HZS' | 'LDN'
  | 'NYE' | 'PAR' | 'PHI' | 'SEO' | 'SFS' | 'SHD' | 'TOR' | 'VAL' | 'VAN' | 'WAS'

export type Team = { code: TeamCode; name: string; color: string }

/**
 * One bright color per Overwatch League team, picked from its official colors
 * as listed in the `owl-colors` package (values copied, package not used).
 */
export const TEAMS: Record<TeamCode, Team> = {
  ATL: { code: 'ATL', name: 'Atlanta Reign', color: '#910F1B' },
  BOS: { code: 'BOS', name: 'Boston Uprising', color: '#174B97' },
  CDH: { code: 'CDH', name: 'Chengdu Hunters', color: '#FFA000' },
  DAL: { code: 'DAL', name: 'Dallas Fuel', color: '#0072CE' },
  FLA: { code: 'FLA', name: 'Florida Mayhem', color: '#CF4691' },
  GLA: { code: 'GLA', name: 'Los Angeles Gladiators', color: '#3C1053' },
  GZC: { code: 'GZC', name: 'Guangzhou Charge', color: '#67A2B2' },
  HOU: { code: 'HOU', name: 'Houston Outlaws', color: '#97D700' },
  HZS: { code: 'HZS', name: 'Hangzhou Spark', color: '#FB7299' },
  LDN: { code: 'LDN', name: 'London Spitfire', color: '#59CBE8' },
  NYE: { code: 'NYE', name: 'New York Excelsior', color: '#0F57EA' },
  PAR: { code: 'PAR', name: 'Paris Eternal', color: '#8D042D' },
  PHI: { code: 'PHI', name: 'Philadelphia Fusion', color: '#F99E29' },
  SEO: { code: 'SEO', name: 'Seoul Dynasty', color: '#AA8A00' },
  SFS: { code: 'SFS', name: 'San Francisco Shock', color: '#FC4C02' },
  SHD: { code: 'SHD', name: 'Shanghai Dragons', color: '#D22630' },
  TOR: { code: 'TOR', name: 'Toronto Defiant', color: '#C10021' },
  VAL: { code: 'VAL', name: 'Los Angeles Valiant', color: '#1888C6' },
  VAN: { code: 'VAN', name: 'Vancouver Titans', color: '#2FB228' },
  WAS: { code: 'WAS', name: 'Washington Justice', color: '#990034' },
}

/** One team per Slot, Slot 1 first. */
export type TeamOrder = TeamCode[]

export const DEFAULT_TEAM_ORDER: TeamOrder = ['DAL', 'SHD', 'HOU', 'GLA', 'HZS']

const STORAGE_KEY = 'colosseo.teamOrder'

export function loadTeamOrder(): TeamOrder {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    return isValidTeamOrder(stored) ? stored : DEFAULT_TEAM_ORDER
  } catch {
    return DEFAULT_TEAM_ORDER
  }
}

export function saveTeamOrder(order: TeamOrder): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
  } catch {
    // Storage is blocked (private mode, site data disabled); the order lasts for this visit only.
  }
}

function isValidTeamOrder(value: unknown): value is TeamOrder {
  return (
    Array.isArray(value) &&
    value.length === DEFAULT_TEAM_ORDER.length &&
    value.every((code) => typeof code === 'string' && code in TEAMS) &&
    new Set(value).size === value.length
  )
}
