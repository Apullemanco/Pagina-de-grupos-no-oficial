import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const password = formData.get('password')
    if (password !== '102326') return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(file instanceof File)) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
    const blob = await put(`grupos-estudiantiles/${Date.now()}-${file.name}`, file, { access: 'private', addRandomSuffix: false })
    return NextResponse.json({ pathname: blob.pathname })
  } catch {
    return NextResponse.json({ error: 'No se pudo subir el archivo' }, { status: 500 })
  }
}
