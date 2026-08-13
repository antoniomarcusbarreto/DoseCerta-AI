/*
 * Gera os PNGs do manifest a partir de public/icons/icon.svg.
 * Rode depois de qualquer mudança no ícone: npm run icones
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pastaIcones = path.join(raiz, 'public', 'icons');
const svg = await readFile(path.join(pastaIcones, 'icon.svg'));

const saidas = [
  { arquivo: 'icon-180.png', tamanho: 180, maskable: false },
  { arquivo: 'icon-192.png', tamanho: 192, maskable: false },
  { arquivo: 'icon-512.png', tamanho: 512, maskable: false },
  { arquivo: 'icon-maskable-512.png', tamanho: 512, maskable: true },
];

for (const { arquivo, tamanho, maskable } of saidas) {
  // Ícone maskable precisa de zona segura: o conteúdo é reduzido a 80% e
  // centralizado sobre o azul do topo do gradiente, para o recorte circular
  // de cada launcher não comer o desenho.
  const png = maskable
    ? await sharp(svg, { density: 384 })
        .resize(Math.round(tamanho * 0.8), Math.round(tamanho * 0.8), { fit: 'contain' })
        .extend({
          top: Math.round(tamanho * 0.1),
          bottom: Math.round(tamanho * 0.1),
          left: Math.round(tamanho * 0.1),
          right: Math.round(tamanho * 0.1),
          background: '#3B4C5E',
        })
        .png()
        .toBuffer()
    : await sharp(svg, { density: 384 }).resize(tamanho, tamanho).png().toBuffer();

  await writeFile(path.join(pastaIcones, arquivo), png);
  console.log(`gerado: ${arquivo} (${tamanho}px)`);
}
