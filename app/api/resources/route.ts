import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const resources = {
  'logistica-y-necesidades.docx': 'Formato-de-Logstica-y-Necesidades-6020de.docx',
  'estacionamientos.docx': 'Formato-de-Estacionamiento-79b6d0.docx',
  'entrada-proveedores.docx': 'Formato-de-Entrada-de-Proveedores-8fac49.docx',
  'guia-requerimientos.docx': 'resources/Cómo envío mis requerimientos.docx',
  'tecfood-responsabilidad.doc': 'resources/1. Carta de Liberación de Responsabilidad por alimentos.doc',
  'tecfood-registro.docx': 'resources/2. Registro Introducción de Alimentos y Bebidas Externos (002).docx',
  'tecfood-contacto.docx': 'resources/3. Envía los documentos a este Contacto TecFood.docx',
  'reserva-emis.xlsx': 'resources/formato de reserva EMIS.xlsx',
} as const

const contentTypes: Record<string, string> = {
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name') as keyof typeof resources | null
  if (!name || !resources[name]) return NextResponse.json({ error: 'Recurso no encontrado' }, { status: 404 })

  try {
    const file = await readFile(path.join(process.cwd(), 'data', resources[name]))
    const extension = path.extname(resources[name]).toLowerCase()
    return new NextResponse(file, {
      headers: {
        'Content-Type': contentTypes[extension] ?? 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${resources[name]}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el recurso' }, { status: 404 })
  }
}
