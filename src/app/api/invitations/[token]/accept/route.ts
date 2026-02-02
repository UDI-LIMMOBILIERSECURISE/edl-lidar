import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createServerComponentClient } from '@/lib/supabase-server'

interface AcceptInvitationBody {
  password?: string // Si nouveau compte
}

interface InvitationInfo {
  valid: boolean
  error?: string
  email?: string
  role?: string
  entity_name?: string
  entity_logo?: string | null
  expires_at?: string
}

interface AcceptResult {
  success: boolean
  error?: string
  entity_id?: string
  role?: string
}

// POST: Accepter une invitation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const serviceClient = createServerClient()

    if (!token) {
      return NextResponse.json(
        { error: 'Token requis' },
        { status: 400 }
      )
    }

    // Recuperer les infos de l'invitation via la fonction SQL
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: invitationInfoData, error: infoError } = await (serviceClient as any)
      .rpc('get_invitation_info', { p_token: token })

    if (infoError) {
      console.error('Erreur recuperation invitation:', infoError)
      return NextResponse.json(
        { error: 'Erreur lors de la verification de l\'invitation' },
        { status: 500 }
      )
    }

    const invitationInfo = invitationInfoData as InvitationInfo

    if (!invitationInfo || !invitationInfo.valid) {
      return NextResponse.json(
        { error: invitationInfo?.error || 'Invitation invalide' },
        { status: 400 }
      )
    }

    // Parser le body pour le mot de passe si nouveau compte
    const body: AcceptInvitationBody = await request.json().catch(() => ({}))

    // Verifier si l'utilisateur est deja connecte
    const supabase = await createServerComponentClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    let userId: string

    if (currentUser) {
      // Utilisateur deja connecte - verifier que l'email correspond
      if (currentUser.email?.toLowerCase() !== invitationInfo.email?.toLowerCase()) {
        return NextResponse.json({
          error: 'Vous etes connecte avec un autre email. Deconnectez-vous et reessayez.',
          email_mismatch: true,
          expected_email: invitationInfo.email
        }, { status: 400 })
      }
      userId = currentUser.id
    } else {
      // Nouveau compte ou connexion requise
      if (!body.password) {
        return NextResponse.json({
          error: 'Mot de passe requis pour creer un compte',
          requires_password: true
        }, { status: 400 })
      }

      // Verifier si un compte existe deja avec cet email
      const { data: existingUsers } = await serviceClient.auth.admin.listUsers()
      const existingUser = existingUsers?.users?.find(
        u => u.email?.toLowerCase() === invitationInfo.email?.toLowerCase()
      )

      if (existingUser) {
        // Compte existe - doit se connecter
        return NextResponse.json({
          error: 'Un compte existe deja avec cet email. Veuillez vous connecter.',
          requires_login: true,
          email: invitationInfo.email
        }, { status: 400 })
      }

      // Creer le nouveau compte
      const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
        email: invitationInfo.email!,
        password: body.password,
        email_confirm: true, // Confirmer automatiquement car invite
        user_metadata: {
          invitation_accepted: true,
          entity_name: invitationInfo.entity_name
        }
      })

      if (createError || !newUser.user) {
        console.error('Erreur creation utilisateur:', createError)
        return NextResponse.json(
          { error: 'Erreur lors de la creation du compte' },
          { status: 500 }
        )
      }

      userId = newUser.user.id
    }

    // Accepter l'invitation via la fonction SQL
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: acceptResultData, error: acceptError } = await (serviceClient as any)
      .rpc('accept_invitation', {
        p_token: token,
        p_user_id: userId
      })

    if (acceptError) {
      console.error('Erreur acceptation invitation:', acceptError)
      return NextResponse.json(
        { error: 'Erreur lors de l\'acceptation de l\'invitation' },
        { status: 500 }
      )
    }

    const acceptResult = acceptResultData as AcceptResult

    if (!acceptResult || !acceptResult.success) {
      return NextResponse.json(
        { error: acceptResult?.error || 'Echec de l\'acceptation' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation acceptee avec succes',
      entity_id: acceptResult.entity_id,
      role: acceptResult.role,
      is_new_user: !currentUser
    })

  } catch (error) {
    console.error('Erreur API accept invitation:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// GET: Recuperer les infos publiques d'une invitation (sans auth)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const serviceClient = createServerClient()

    if (!token) {
      return NextResponse.json(
        { error: 'Token requis' },
        { status: 400 }
      )
    }

    // Recuperer les infos via la fonction SQL
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: invitationInfo, error } = await (serviceClient as any)
      .rpc('get_invitation_info', { p_token: token })

    if (error) {
      console.error('Erreur recuperation invitation:', error)
      return NextResponse.json(
        { error: 'Erreur lors de la verification' },
        { status: 500 }
      )
    }

    return NextResponse.json(invitationInfo as InvitationInfo)

  } catch (error) {
    console.error('Erreur API get invitation:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
