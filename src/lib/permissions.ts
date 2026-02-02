// Helper functions pour la gestion des permissions
// Roles: entity_admin, agency_manager, operator

export type UserRole = 'entity_admin' | 'agency_manager' | 'operator'

export interface UserProfile {
  id: string
  user_id: string
  entity_id: string
  agency_id: string | null
  role: UserRole
  first_name: string | null
  last_name: string | null
  phone: string | null
  created_at: string
}

/**
 * Verifie si l'utilisateur est admin de l'entite
 */
export function isEntityAdmin(profile: UserProfile | null): boolean {
  return profile?.role === 'entity_admin'
}

/**
 * Verifie si l'utilisateur est manager d'agence
 */
export function isAgencyManager(profile: UserProfile | null): boolean {
  return profile?.role === 'agency_manager'
}

/**
 * Verifie si l'utilisateur peut gerer les agences (creation, modification, suppression)
 * Seul entity_admin peut gerer les agences
 */
export function canManageAgencies(profile: UserProfile | null): boolean {
  return isEntityAdmin(profile)
}

/**
 * Verifie si l'utilisateur peut voir la liste des agences
 * entity_admin et agency_manager peuvent voir les agences
 */
export function canViewAgencies(profile: UserProfile | null): boolean {
  return profile?.role === 'entity_admin' || profile?.role === 'agency_manager'
}

/**
 * Verifie si l'utilisateur peut gerer les utilisateurs d'une agence specifique
 */
export function canManageAgencyUsers(profile: UserProfile | null, agencyId: string): boolean {
  if (!profile) return false

  // entity_admin peut gerer tous les utilisateurs
  if (isEntityAdmin(profile)) return true

  // agency_manager peut gerer les utilisateurs de son agence
  if (isAgencyManager(profile) && profile.agency_id === agencyId) return true

  return false
}

/**
 * Verifie si l'utilisateur appartient a une entite specifique
 */
export function belongsToEntity(profile: UserProfile | null, entityId: string): boolean {
  return profile?.entity_id === entityId
}
