/**
 * PyQGIS Bridge - Node.js ↔ Python communication layer
 *
 * Handles execution of Python geoprocessing algorithms via child_process
 * Supports both embedded Python (bundled) and system Python
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Python paths - order of preference
const PYTHON_PATHS = [
  // 1. Embedded Python (production - bundled with app)
  path.join(__dirname, '../resources/python/python.exe'),
  path.join(__dirname, '../python-embed/python.exe'),

  // 2. System Python (development)
  'python3',
  'python',

  // 3. Common installations
  'C:\\Python311\\python.exe',
  'C:\\Python310\\python.exe',
  'C:\\Users\\' + (process.env.USERNAME || 'User') + '\\AppData\\Local\\Programs\\Python\\Python311\\python.exe',
];

// Path to processor script
const PROCESSOR_SCRIPT = path.join(__dirname, '../python/qgls_processor.py');

// Cache for Python path
let cachedPythonPath = null;

/**
 * Find available Python executable
 */
async function findPython() {
  if (cachedPythonPath) {
    return cachedPythonPath;
  }

  for (const pythonPath of PYTHON_PATHS) {
    try {
      const exists = await checkPython(pythonPath);
      if (exists) {
        console.log(`[PyQGIS Bridge] Found Python at: ${pythonPath}`);
        cachedPythonPath = pythonPath;
        return pythonPath;
      }
    } catch {
      // Continue to next path
    }
  }

  throw new Error('Python not found. Please install Python 3.10+ or configure PYTHON_PATH environment variable.');
}

/**
 * Check if Python executable exists and works
 */
function checkPython(pythonPath) {
  return new Promise((resolve) => {
    const proc = spawn(pythonPath, ['--version'], {
      timeout: 5000,
      windowsHide: true
    });

    let output = '';
    proc.stdout.on('data', (data) => { output += data.toString(); });
    proc.stderr.on('data', (data) => { output += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0 && output.includes('Python 3')) {
        resolve(true);
      } else {
        resolve(false);
      }
    });

    proc.on('error', () => resolve(false));
  });
}

/**
 * Check if Python dependencies are installed
 */
async function checkDependencies() {
  const pythonPath = await findPython();

  return new Promise((resolve, reject) => {
    const proc = spawn(pythonPath, ['-c', 'import shapely; import numpy; print("OK")'], {
      timeout: 10000,
      windowsHide: true
    });

    let output = '';
    let error = '';

    proc.stdout.on('data', (data) => { output += data.toString(); });
    proc.stderr.on('data', (data) => { error += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0 && output.includes('OK')) {
        resolve({ installed: true });
      } else {
        resolve({
          installed: false,
          error: error || 'Dependencies not installed',
          hint: 'Run: pip install shapely numpy'
        });
      }
    });

    proc.on('error', (err) => {
      resolve({
        installed: false,
        error: err.message
      });
    });
  });
}

/**
 * Install Python dependencies
 */
async function installDependencies() {
  const pythonPath = await findPython();
  const requirementsPath = path.join(__dirname, '../python/requirements.txt');

  return new Promise((resolve, reject) => {
    const proc = spawn(pythonPath, ['-m', 'pip', 'install', '-r', requirementsPath], {
      timeout: 300000, // 5 minutes
      windowsHide: true
    });

    let output = '';
    let error = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
      console.log('[pip]', data.toString().trim());
    });

    proc.stderr.on('data', (data) => {
      error += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output });
      } else {
        reject(new Error(`pip install failed: ${error}`));
      }
    });

    proc.on('error', reject);
  });
}

/**
 * Run a Python geoprocessing algorithm
 *
 * @param {string} algorithm - Algorithm name
 * @param {Object} params - Algorithm parameters
 * @param {Object|null} inputGeoJSON - Input GeoJSON (optional)
 * @param {Object} options - Execution options
 * @returns {Promise<Object>} - Result with success, data/error
 */
async function runAlgorithm(algorithm, params = {}, inputGeoJSON = null, options = {}) {
  const pythonPath = await findPython();
  const timeout = options.timeout || 60000; // 1 minute default

  return new Promise((resolve, reject) => {
    const args = [PROCESSOR_SCRIPT, algorithm, JSON.stringify(params)];

    const proc = spawn(pythonPath, args, {
      timeout,
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8'
      }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error('[Python stderr]', data.toString().trim());
    });

    // Send input GeoJSON via stdin
    if (inputGeoJSON) {
      proc.stdin.write(JSON.stringify(inputGeoJSON));
    }
    proc.stdin.end();

    proc.on('close', (code) => {
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (parseError) {
        resolve({
          success: false,
          error: `Failed to parse Python output: ${parseError.message}`,
          stdout,
          stderr,
          exitCode: code
        });
      }
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        error: `Failed to spawn Python process: ${err.message}`
      });
    });
  });
}

/**
 * List available algorithms
 */
async function listAlgorithms() {
  const result = await runAlgorithm('__list__', {}, null, { timeout: 5000 });

  if (!result.success && result.available) {
    return result.available;
  }

  // Default list if Python fails
  return [
    'buffer',
    'dissolve',
    'simplify',
    'voronoi',
    'convex_hull',
    'centroid',
    'grid',
    'clip_raster'
  ];
}

/**
 * Get Python and dependency status
 */
async function getStatus() {
  try {
    const pythonPath = await findPython();

    // Get Python version
    const version = await new Promise((resolve) => {
      const proc = spawn(pythonPath, ['--version'], { windowsHide: true });
      let output = '';
      proc.stdout.on('data', (d) => { output += d.toString(); });
      proc.stderr.on('data', (d) => { output += d.toString(); });
      proc.on('close', () => resolve(output.trim()));
      proc.on('error', () => resolve('Unknown'));
    });

    const deps = await checkDependencies();
    const algorithms = await listAlgorithms();

    return {
      available: true,
      pythonPath,
      version,
      dependencies: deps,
      algorithms,
      processorScript: PROCESSOR_SCRIPT,
      processorExists: fs.existsSync(PROCESSOR_SCRIPT)
    };
  } catch (err) {
    return {
      available: false,
      error: err.message,
      searchedPaths: PYTHON_PATHS
    };
  }
}

module.exports = {
  findPython,
  checkDependencies,
  installDependencies,
  runAlgorithm,
  listAlgorithms,
  getStatus
};
