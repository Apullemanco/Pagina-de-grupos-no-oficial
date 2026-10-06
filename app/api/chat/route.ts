import { gateway, generateText } from 'ai'
import { NextRequest, NextResponse } from 'next/server'
import groupsData from '@/data/groups.json'

const context = `Eres TECbot, el asistente del portal de Grupos Estudiantiles del Tecnológico de Monterrey, campus Monterrey. Responde en español y usa los datos concretos que aparecen en el contexto. No inventes nombres, correos, fechas ni grupos. Si falta información, dilo claramente y guía a la sección correcta. Sé útil: da pasos, menciona nombres de grupos cuando correspondan y responde directamente a la pregunta.

DATOS DEL PORTAL:
- Hay ${groupsData.length} grupos estudiantiles organizados por giro.
- Giros disponibles: ${Array.from(new Set(groupsData.map((g) => g.category))).join(', ')}.
- Fechas operativas de referencia: registro de evento, 10 días hábiles antes; solicitud de presupuesto, 15 días hábiles antes; alta de un grupo, 20 días hábiles antes.
- La sección Grupos permite buscar por nombre y filtrar por giro. La sección Noticias contiene convocatorias y eventos. Formatos, Fechas importantes y Líderes muestran la información publicada por coordinación.
- El portal no es oficial del Tecnológico de Monterrey.`

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

function localReply(message: string) {
  const text = normalize(message.trim())
  const words = text.split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !['que', 'hay', 'los', 'las', 'del', 'una', 'uno', 'como', 'para', 'con', 'por', 'grupo', 'grupos'].includes(word))
  if (text.includes('fecha') || text.includes('cuando') || text.includes('cuándo') || text.includes('plazo') || text.includes('anticipación') || text.includes('anticipacion')) return 'Para que tu actividad sea aceptada a tiempo: registra el evento al menos 10 días hábiles antes, solicita presupuesto 15 días hábiles antes y registra un grupo nuevo 20 días hábiles antes. Las fechas publicadas por coordinación aparecen en “Fechas importantes”.'
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
    if (!lastMessage) return NextResponse.json({ error: 'Escribe una pregunta para TECbot.' }, { status: 400 })

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
