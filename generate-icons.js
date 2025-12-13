const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputPath = 'C:/Users/Marc/GeoMind-Infra/docs/Logos/GeoMind_Logo_tsp2.png';
const outputDir = 'C:/Users/Marc/GeoMind-Infra/geomind-app/src-tauri/icons';

async function generateIcons() {
  // Get image metadata
  const metadata = await sharp(inputPath).metadata();
  console.log(`Original image: ${metadata.width}x${metadata.height}`);

  // Crop to get only the symbol (top ~55% of image, centered)
  const cropHeight = Math.floor(metadata.height * 0.55);
  const cropWidth = metadata.width;
  const left = 0;
  const top = Math.floor(metadata.height * 0.05); // Start slightly from top

  // Extract the symbol area
  const symbolBuffer = await sharp(inputPath)
    .extract({ left: left, top: top, width: cropWidth, height: cropHeight })
    .toBuffer();

  // Get the cropped dimensions
  const croppedMeta = await sharp(symbolBuffer).metadata();
  console.log(`Cropped to: ${croppedMeta.width}x${croppedMeta.height}`);

  // Make it square by adding padding or cropping
  const size = Math.max(croppedMeta.width, croppedMeta.height);

  // Create square version with transparent background
  const squareBuffer = await sharp(symbolBuffer)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .toBuffer();

  // Generate PNG icons at required sizes
  const pngSizes = [
    { name: '32x32.png', size: 32 },
    { name: '128x128.png', size: 128 },
    { name: '128x128@2x.png', size: 256 },
    { name: 'icon.png', size: 512 } // For ICO generation
  ];

  for (const { name, size } of pngSizes) {
    await sharp(squareBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toFile(path.join(outputDir, name));
    console.log(`Generated: ${name}`);
  }

  // Generate ICO file (Windows) - contains multiple sizes
  // Sharp can create ICO with multiple resolutions
  const icoSizes = [16, 32, 48, 64, 128, 256];
  const icoBuffers = await Promise.all(
    icoSizes.map(s =>
      sharp(squareBuffer)
        .resize(s, s, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toBuffer()
    )
  );

  // For ICO, we'll use the 256x256 as icon.ico (Tauri will handle it)
  await sharp(squareBuffer)
    .resize(256, 256, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(outputDir, 'icon.ico'));
  console.log('Generated: icon.ico (256x256 PNG)');

  // For macOS, create ICNS placeholder (as PNG, Tauri converts)
  await sharp(squareBuffer)
    .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(outputDir, 'icon.icns'));
  console.log('Generated: icon.icns (512x512 PNG)');

  console.log('\nAll icons generated in:', outputDir);
}

generateIcons().catch(console.error);
