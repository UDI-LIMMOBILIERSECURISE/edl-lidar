import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createServerComponentClient } from '@/lib/supabase-server'

// Types
interface CreateInvitationBody {
  email: string
  role: 'entity_admin' | 'agency_manager' | 'agent'
  agency_ids?: string[]
}

interface UserProfile {
  entity_id: string
  role: string
}

interface InvitationRow {
  id: string
  email: string
  role: string
  agency_ids: string[]
  expires_at: string
  accepted_at: string | null
  created_at: string
  invited_by: string
  token: string
}

// POST: Creer une invitation
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerComponentClient()
    const serviceClient = createServerClient()

    // Verifier authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifie' },
        { status: 401 }
      )
    }

    // Recuperer le profil utilisateur
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('entity_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profileData) {
      return NextResponse.json(
        { error: 'Profil utilisateur non trouve' },
        { status: 404 }
      )
    }

    const profile = profileData as UserProfile

    // Verifier les permissions
    if (profile.role !== 'entity_admin' && profile.role !== 'agency_manager') {
      return NextResponse.json(
        { error: 'Permission refusee. Seuls les admins et managers peuvent inviter.' },
        { status: 403 }
      )
    }

    // Parser le body
    const body: CreateInvitationBody = await request.json()
    const { email, role, agency_ids } = body

    // Validations
    if (!email || !role) {
      return NextResponse.json(
        { error: 'Email et role requis' },
        { status: 400 }
      )
    }

    // Valider format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Format email invalide' },
        { status: 400 }
      )
    }

    // Verifier que le role demande est autorise
    if (profile.role === 'agency_manager' && role !== 'agent') {
      return NextResponse.json(
        { error: 'Un manager ne peut inviter que des agents' },
        { status: 403 }
      )
    }

    // Verifier si une invitation en attente existe deja
    const { data: existingInvitation } = await serviceClient
      .from('invitations')
      .select('id, expires_at')
      .eq('entity_id', profile.entity_id)
      .eq('email', email.toLowerCase())
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (existingInvitation) {
      return NextResponse.json(
        { error: 'Une invitation en attente existe deja pour cet email' },
        { status: 409 }
      )
    }

    // Creer l'invitation avec service client (bypass RLS pour generer token)
    const { data: invitationData, error: insertError } = await serviceClient
      .from('invitations')
      .insert({
        entity_id: profile.entity_id,
        email: email.toLowerCase(),
        role: role,
        agency_ids: agency_ids || [],
        invited_by: user.id
      })
      .select()
      .single()

    if (insertError || !invitationData) {
      console.error('Erreur creation invitation:', insertError)
      return NextResponse.json(
        { error: 'Erreur lors de la creation de l\'invitation' },
        { status: 500 }
      )
    }

    const invitation = invitationData as InvitationRow

    // Recuperer le nom de l'entity pour l'email
    const { data: entity } = await serviceClient
      .from('entities')
      .select('name')
      .eq('id', profile.entity_id)
      .single()

    // Construire l'URL d'invitation
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const inviteUrl = `${baseUrl}/invite/${invitation.token}`

    // Envoyer l'email d'invitation via Supabase Auth
    try {
      const { error: emailError } = await serviceClient.auth.admin.inviteUserByEmail(
        email.toLowerCase(),
        {
          redirectTo: inviteUrl,
          data: {
            invitation_token: invitation.token,
            entity_name: (entity as { name: string } | null)?.name || 'EDL LIDAR',
            role: role
          }
        }
      )

      if (emailError) {
        console.warn('Email invitation non envoye:', emailError.message)
        // On continue meme si l'email echoue - l'invitation est creee
      }
    } catch (emailErr) {
      console.warn('Erreur envoi email:', emailErr)
    }

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expires_at: invitation.expires_at,
        invite_url: inviteUrl
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Erreur API invitations POST:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// GET: Liste des invitations de l'entity
export async function GET() {
  try {
    const supabase = await createServerComponentClient()

    // Verifier authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifie' },
        { status: 401 }
      )
    }

    // Recuperer le profil utilisateur
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('entity_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profileData) {
      return NextResponse.json(
        { error: 'Profil utilisateur non trouve' },
        { status: 404 }
      )
    }

    const profile = profileData as UserProfile

    // Verifier les permissions
    if (profile.role !== 'entity_admin' && profile.role !== 'agency_manager') {
      return NextResponse.json(
        { error: 'Permission refusee' },
        { status: 403 }
      )
    }

    // Recuperer les invitations
    const { data: invitations, error: queryError } = await supabase
      .from('invitations')
      .select(`
        id,
        email,
        role,
        agency_ids,
        expires_at,
        accepted_at,
        created_at,
        invited_by
      `)
      .eq('entity_id', profile.entity_id)
      .order('created_at', { ascending: false })

    if (queryError) {
      console.error('Erreur recuperation invitations:', queryError)
      return NextResponse.json(
        { error: 'Erreur lors de la recuperation des invitations' },
        { status: 500 }
      )
    }

    // Enrichir avec le statut
    const enrichedInvitations = (invitations as InvitationRow[]).map(inv => ({
      ...inv,
      status: inv.accepted_at
        ? 'accepted'
        : new Date(inv.expires_at) < new Date()
          ? 'expired'
          : 'pending'
    }))

    return NextResponse.json({
      invitations: enrichedInvitations
    })

  } catch (error) {
    console.error('Erreur API invitations GET:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// DELETE: Annuler une invitation
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerComponentClient()

    // Verifier authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifie' },
        { status: 401 }
      )
    }

    // Recuperer le profil utilisateur
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('entity_id, role')
      .eq('id', user.id)
      .single()

    const profile = profileData as UserProfile | null

    if (!profile || profile.role !== 'entity_admin') {
      return NextResponse.json(
        { error: 'Seul un admin peut annuler une invitation' },
        { status: 403 }
      )
    }

    // Recuperer l'ID depuis l'URL
    const { searchParams } = new URL(request.url)
    const invitationId = searchParams.get('id')

    if (!invitationId) {
      return NextResponse.json(
        { error: 'ID invitation requis' },
        { status: 400 }
      )
    }

    // Supprimer l'invitation (RLS verifie l'appartenance a l'entity)
    const { error: deleteError } = await supabase
      .from('invitations')
      .delete()
      .eq('id', invitationId)
      .eq('entity_id', profile.entity_id)
      .is('accepted_at', null)

    if (deleteError) {
      console.error('Erreur suppression invitation:', deleteError)
      return NextResponse.json(
        { error: 'Erreur lors de la suppression' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Erreur API invitations DELETE:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
