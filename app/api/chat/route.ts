import { gateway, generateText } from 'ai'
import { NextRequest, NextResponse } from 'next/server'
import groupsData from '@/data/groups.json'

const context = `Eres el Asistente de Grupos, un asistente estudiantil independiente para el portal de Grupos Estudiantiles de Campus Monterrey. Responde en español, de forma directa y concreta, usando únicamente los datos del contexto. No inventes nombres, correos, fechas ni grupos. Si falta información, dilo claramente y guía a la sección correcta. Antes de responder identifica la intención: grupos, consejo, líder, presidencia, formato, apertura de grupo, fecha o noticia. Si preguntan por un grupo específico, busca coincidencias reales y menciona su nombre y giro. Nunca respondas algo genérico si la pregunta tiene una coincidencia en los datos.

DATOS DEL PORTAL:
- Hay ${groupsData.length} grupos estudiantiles organizados por giro.
- Giros disponibles: ${Array.from(new Set(groupsData.map((g) => g.category))).join(', ')}.
- Para abrir un grupo: revisa la oferta del CGIV, prepara Presentación y Anexo 2, agenda una cita y envía la documentación dentro de las semanas indicadas en “Abrir un grupo”. No inventes un plazo si no está publicado.
- La sección Grupos permite buscar por nombre y filtrar por giro. La sección Noticias contiene convocatorias y eventos. Formatos, Fechas importantes y Líderes muestran la información publicada por coordinación.
- El portal no es oficial del Tecnológico de Monterrey.`

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

function localReply(message: string) {
  const text = normalize(message.trim())
  const words = text.split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !['que', 'hay', 'los', 'las', 'del', 'una', 'uno', 'como', 'para', 'con', 'por', 'grupo', 'grupos'].includes(word))
  if (text.includes('abrir') || text.includes('nuevo grupo') || text.includes('crear grupo')) return 'Para abrir un grupo, revisa la oferta del CGIV, prepara la Presentación y el Anexo 2, define tu mesa directiva, agenda una cita con el CGIV y envía la documentación. Consulta la pestaña “Abrir un grupo” para ver requisitos y puestos.'
  if (text.includes('fecha') || text.includes('cuando') || text.includes('cuándo') || text.includes('plazo') || text.includes('anticipación') || text.includes('anticipacion')) return 'Revisa la pestaña “Fechas importantes”. Para eventos, consulta el formato correspondiente porque cada trámite tiene su propio plazo; no todos los formatos aplican a todas las actividades.'
  if (text.includes('presupuesto') || text.includes('dinero') || text.includes('pago')) return 'La solicitud de presupuesto debe enviarse con al menos 15 días hábiles de anticipación. Revisa el formato correspondiente y la fecha vigente en “Formatos” y “Fechas importantes”. El contacto administrativo se publicará en cuanto coordinación lo agregue.'
  if (text.includes('giro') || text.includes('categor')) return `Puedes filtrar los ${groupsData.length} grupos desde “Grupos”. Los giros disponibles son: ${Array.from(new Set(groupsData.map((g) => g.category))).join(', ')}.`
  if (text.includes('formato') || text.includes('documento')) return 'Ve a “Formatos” para consultar cada documento, su ejemplo y su fecha límite. Si todavía no aparece un formato, significa que coordinación aún no lo ha publicado.'
  if (text.includes('líder') || text.includes('lider') || text.includes('contacto')) return 'La pestaña “Líderes” reúne los responsables y sus medios de contacto cuando coordinación los publique. Para contactar al responsable del portal, usa el enlace “Contacto” del pie de página.'
  if (text.includes('noticia') || text.includes('evento') || text.includes('convocatoria')) return 'Consulta “Noticias” para ver eventos, convocatorias y avisos publicados. El muro se actualiza desde el panel de administración para toda la comunidad.'
  const matches = groupsData.filter((g) => {
    const haystack = normalize(`${g.name} ${g.acronym} ${g.description} ${g.category}`)
    return words.some((word) => haystack.includes(word))
  }).slice(0, 5)
  if (matches.length) return `Encontré ${matches.length} coincidencia${matches.length === 1 ? '' : 's'} para “${message}”:\n\n${matches.map((g) => `• ${g.name} (${g.acronym}) — giro: ${g.category}. ${g.description}`).join('\n')}`
  return `Puedo ayudarte con los ${groupsData.length} grupos, sus giros, noticias, formatos, fechas y líderes. Por ejemplo, pregunta “¿qué grupos hay de ${groupsData[0].category}?” o “¿con cuánta anticipación registro un evento?”.`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const messages = Array.isArray(body?.messages) ? body.messages : []
    const lastMessage = messages.at(-1)?.content?.trim()
    if (!lastMessage) return NextResponse.json({ error: 'Escribe una pregunta para el Asistente de Grupos.' }, { status: 400 })

    try {
      const result = await Promise.race([
        generateText({ model: gateway('openai/gpt-5-mini'), system: context, messages }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('AI Gateway timeout')), 3500)),
      ])
      if (result.text?.trim()) return NextResponse.json({ text: result.text })
    } catch (error) {
      console.error('[v0] AI Gateway no disponible, usando respuesta local:', error)
    }

    return NextResponse.json({ text: localReply(lastMessage), fallback: true })
  } catch {
    return NextResponse.json({ text: 'Puedo ayudarte con grupos, formatos, noticias, líderes y fechas. Escribe una pregunta concreta para comenzar.' })
  }
}
