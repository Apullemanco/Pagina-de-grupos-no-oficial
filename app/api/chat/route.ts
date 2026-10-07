import { gateway, generateText } from 'ai'
import { NextRequest, NextResponse } from 'next/server'
import groupsData from '@/data/groups.json'

const context = `Eres el Asistente de Grupos, una guía estudiantil del portal no oficial de grupos del Tec Campus Monterrey. Responde siempre en español, de forma directa y útil. Escribe como máximo 70 palabras, salvo que el usuario pida una explicación detallada. Usa párrafos cortos y, cuando haya pasos, una lista numerada de máximo 4 puntos. No uses introducciones genéricas, repitas la pregunta ni cierres con frases vacías. Primero identifica la intención de la pregunta; no respondas con información genérica si preguntan por un grupo, consejo, líder, formato, reserva o trámite. Usa únicamente los datos concretos del contexto; no inventes nombres, correos, fechas ni grupos. Si no tienes el dato, dilo y señala la sección exacta donde puede revisarse. No menciones que eres un bot ni afirmes que el portal es oficial.

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
  if (text.includes('reserv') || text.includes('sala')) return 'En Inicio, pulsa “Reservar una sala”. Se abrirá Microsoft Bookings; inicia sesión con tu cuenta institucional si te lo pide.'
  if (text.includes('abrir') || text.includes('nuevo grupo') || text.includes('crear grupo')) return 'Abre “Abrir un grupo” y sigue 4 pasos: revisa que no exista uno similar, prepara la Presentación y el Anexo 2, agenda una cita con CGIV y envía la documentación completa.'
  if (text.includes('fecha') || text.includes('cuando') || text.includes('cuándo') || text.includes('plazo') || text.includes('anticipación') || text.includes('anticipacion')) return 'Referencia rápida: evento, 10 días hábiles antes; presupuesto, 15 días; grupo nuevo, 20 días. Confirma la fecha vigente en “Fechas importantes”.'
  if (text.includes('presupuesto') || text.includes('dinero') || text.includes('pago')) return 'La solicitud de presupuesto debe enviarse con al menos 15 días hábiles de anticipación. Revisa el formato correspondiente y la fecha vigente en “Formatos” y “Fechas importantes”. El contacto administrativo se publicará en cuanto coordinación lo agregue.'
  if (text.includes('giro') || text.includes('categor')) return `Puedes filtrar los ${groupsData.length} grupos desde “Grupos”. Los giros disponibles son: ${Array.from(new Set(groupsData.map((g) => g.category))).join(', ')}.`
  if (text.includes('formato') || text.includes('documento')) return 'Ve a “Formatos” para consultar cada documento, su ejemplo y su fecha límite. Si todavía no aparece un formato, significa que coordinación aún no lo ha publicado.'
  if (text.includes('líder') || text.includes('lider') || text.includes('contacto')) return 'La pestaña “Líderes” reúne líderes de portafolio y presidencias. Para solicitar acompañamiento, busca el consejo relacionado con tu grupo y abre su ficha para consultar el contacto disponible.'
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

    const normalizedQuestion = normalize(lastMessage)
    if (normalizedQuestion.includes('abrir') || normalizedQuestion.includes('nuevo grupo') || normalizedQuestion.includes('crear grupo')) return NextResponse.json({ text: 'Abre “Abrir un grupo” y sigue 4 pasos: revisa que no exista uno similar, prepara la Presentación y el Anexo 2, agenda una cita con CGIV y envía la documentación completa.', fallback: true })
    if (normalizedQuestion.includes('reserv') || normalizedQuestion.includes('sala')) return NextResponse.json({ text: 'En Inicio, pulsa “Reservar una sala”. Se abrirá Microsoft Bookings; inicia sesión con tu cuenta institucional si te lo pide.', fallback: true })
    const deterministic = ['formato', 'documento', 'fecha', 'cuando', 'plazo', 'anticipacion', 'presupuesto'].some((term) => normalizedQuestion.includes(term))
    if (deterministic) return NextResponse.json({ text: localReply(lastMessage), fallback: true })

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
