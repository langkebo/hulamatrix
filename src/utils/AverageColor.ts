export async function averageColorFromImage(img: HTMLImageElement): Promise<[number, number, number]> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  const w = 32
  const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * 32))
  canvas.width = w
  canvas.height = h
  ctx.drawImage(img, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h).data
  let r = 0
  let g = 0
  let b = 0
  let count = 0
  for (let i = 0; i < data.length; i += 4) {
    r += data[i] || 0
    g += data[i + 1] || 0
    b += data[i + 2] || 0
    count++
  }
  return [Math.round(r / count), Math.round(g / count), Math.round(b / count)]
}
