// Definition des plans et leurs limites

export type PlanType = 'free' | 'starter' | 'pro' | 'enterprise'

export interface PlanLimits {
  maxUsers: number
  maxTours: number
  maxStorageGb: number
  maxStorageBytes: number
  features: string[]
  price: number // EUR/mois
}

export const PLANS: Record<PlanType, PlanLimits> = {
  free: {
    maxUsers: 1,
    maxTours: 10,
    maxStorageGb: 5,
    maxStorageBytes: 5 * 1024 * 1024 * 1024, // 5 GB
    features: [
      'Visite virtuelle HD',
      'Assistant Lia basique',
      'Export PDF',
    ],
    price: 0,
  },
  starter: {
    maxUsers: 10,
    maxTours: 50,
    maxStorageGb: 20,
    maxStorageBytes: 20 * 1024 * 1024 * 1024, // 20 GB
    features: [
      'Tout Free +',
      'Multi-utilisateurs',
      'Agences',
      'Assistant Lia avance',
      'Export Word',
    ],
    price: 29,
  },
  pro: {
    maxUsers: 25,
    maxTours: 200,
    maxStorageGb: 100,
    maxStorageBytes: 100 * 1024 * 1024 * 1024, // 100 GB
    features: [
      'Tout Starter +',
      'API Access',
      'White label',
      'Support prioritaire',
      'Analyse avancee',
    ],
    price: 79,
  },
  enterprise: {
    maxUsers: Infinity,
    maxTours: Infinity,
    maxStorageGb: Infinity,
    maxStorageBytes: Infinity,
    features: [
      'Tout Pro +',
      'Utilisateurs illimites',
      'Tours illimites',
      'Stockage illimite',
      'Support dedie',
      'SLA garanti',
    ],
    price: -1, // Sur devis
  },
}

export interface EntityUsage {
  totalTours: number
  totalUsers: number
  storageBytes: number
  liaViewsMonth: number
}

export interface UsageWithLimits extends EntityUsage {
  limits: PlanLimits
  plan: PlanType
}

/**
 * Obtient les limites d'un plan
 */
export function getPlanLimits(plan: PlanType): PlanLimits {
  return PLANS[plan] || PLANS.free
}

/**
 * Calcule le pourcentage d'utilisation
 */
export function getUsagePercent(current: number, max: number): number {
  if (max === Infinity || max <= 0) return 0
  return Math.min(100, Math.round((current / max) * 100))
}

/**
 * Determine la couleur selon le pourcentage
 */
export function getUsageColor(percent: number): 'green' | 'orange' | 'red' {
  if (percent >= 90) return 'red'
  if (percent >= 70) return 'orange'
  return 'green'
}

/**
 * Verifie si un quota est depasse
 */
export function isOverQuota(usage: EntityUsage, limits: PlanLimits): {
  tours: boolean
  users: boolean
  storage: boolean
  any: boolean
} {
  const tours = usage.totalTours >= limits.maxTours
  const users = usage.totalUsers >= limits.maxUsers
  const storage = usage.storageBytes >= limits.maxStorageBytes

  return {
    tours,
    users,
    storage,
    any: tours || users || storage,
  }
}

/**
 * Verifie si proche d'un quota (>80%)
 */
export function isNearQuota(usage: EntityUsage, limits: PlanLimits, threshold = 80): {
  tours: boolean
  users: boolean
  storage: boolean
  any: boolean
} {
  const toursPercent = getUsagePercent(usage.totalTours, limits.maxTours)
  const usersPercent = getUsagePercent(usage.totalUsers, limits.maxUsers)
  const storagePercent = getUsagePercent(usage.storageBytes, limits.maxStorageBytes)

  return {
    tours: toursPercent >= threshold,
    users: usersPercent >= threshold,
    storage: storagePercent >= threshold,
    any: toursPercent >= threshold || usersPercent >= threshold || storagePercent >= threshold,
  }
}

/**
 * Formate les bytes en taille lisible
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B'
  if (bytes === Infinity) return 'Illimite'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * Formate un nombre avec gestion de l'infini
 */
export function formatLimit(value: number): string {
  if (value === Infinity) return 'Illimite'
  return value.toString()
}

/**
 * Obtient le nom affichable du plan
 */
export function getPlanDisplayName(plan: PlanType): string {
  const names: Record<PlanType, string> = {
    free: 'Gratuit',
    starter: 'Starter',
    pro: 'Pro',
    enterprise: 'Enterprise',
  }
  return names[plan] || plan
}
