const sharp = require('sharp');
const pngToIco = require('png-to-ico').default;
const path = require('path');
const fs = require('fs');

const inputPath = 'C:/Users/Marc/GeoMind-Infra/docs/Logos/GeoMind_Logo_tsp2.png';
const outputDir = 'C:/Users/Marc/GeoMind-Infra/geomind-app/src-tauri/icons';

async function generateIcons() {
  // Get image metadata
  const metadata = await sharp(inputPath).metadata();
  console.log(`Original image: ${metadata.width}x${metadata.height}`);

  // Crop to get only the symbol (top ~55% of image)
  const cropHeight = Math.floor(metadata.height * 0.55);
  const top = Math.floor(metadata.height * 0.05);

  // Extract the symbol area
  const symbolBuffer = await sharp(inputPath)
    .extract({ left: 0, top: top, width: metadata.width, height: cropHeight })
    .toBuffer();

  // Get the cropped dimensions
  const croppedMeta = await sharp(symbolBuffer).metadata();
  console.log(`Cropped to: ${croppedMeta.width}x${croppedMeta.height}`);

  // Make it square
  const size = Math.max(croppedMeta.width, croppedMeta.height);
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
    { name: 'icon.png', size: 512 }
  ];

  for (const { name, size } of pngSizes) {
    await sharp(squareBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toFile(path.join(outputDir, name));
    console.log(`Generated: ${name}`);
  }

  // Generate a high-quality 256x256 PNG for ICO conversion
  const ico256Path = path.join(outputDir, 'icon_256.png');
  await sharp(squareBuffer)
    .resize(256, 256, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(ico256Path);

  // Convert PNG to real ICO format
  console.log('Converting to ICO format...');
  const icoBuffer = await pngToIco(ico256Path);
  fs.writeFileSync(path.join(outputDir, 'icon.ico'), icoBuffer);
  console.log('Generated: icon.ico (real ICO format)');

  // Clean up temp file
  fs.unlinkSync(ico256Path);

  // For macOS ICNS - just use PNG (Tauri can handle it)
  await sharp(squareBuffer)
    .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(outputDir, 'icon.icns'));
  console.log('Generated: icon.icns (512x512 PNG for macOS)');

  console.log('\nAll icons generated in:', outputDir);
}

generateIcons().catch(console.error);
