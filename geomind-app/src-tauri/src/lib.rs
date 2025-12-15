use tauri::Manager;
use std::sync::Mutex;
use std::process::{Command, Child, Stdio};
use std::io::{BufRead, BufReader};
use std::thread;

// Store the backend process handle
struct BackendProcess(Mutex<Option<Child>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            // Setup logging in debug mode
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Get path to server in resources
            let resource_path = app.path().resource_dir()
                .expect("Failed to get resource dir");
            let server_path = resource_path.join("server").join("index.js");

            println!("Starting backend server from: {:?}", server_path);

            // Start the backend server using node (std::process)
            let mut child = Command::new("node")
                .arg(server_path.to_string_lossy().to_string())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .expect("Failed to spawn backend server. Make sure Node.js is installed.");

            // Log stdout in a separate thread
            if let Some(stdout) = child.stdout.take() {
                thread::spawn(move || {
                    let reader = BufReader::new(stdout);
                    for line in reader.lines() {
                        if let Ok(line) = line {
                            println!("[Backend] {}", line);
                        }
                    }
                });
            }

            // Log stderr in a separate thread
            if let Some(stderr) = child.stderr.take() {
                thread::spawn(move || {
                    let reader = BufReader::new(stderr);
                    for line in reader.lines() {
                        if let Ok(line) = line {
                            eprintln!("[Backend Error] {}", line);
                        }
                    }
                });
            }

            // Store the child process handle
            let backend_state = app.state::<BackendProcess>();
            *backend_state.0.lock().unwrap() = Some(child);

            println!("GeoMind backend server started");
            Ok(())
        })
        .on_window_event(|window, event| {
            // Kill backend when app closes
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let app = window.app_handle();
                if let Some(backend_state) = app.try_state::<BackendProcess>() {
                    if let Ok(mut guard) = backend_state.0.lock() {
                        if let Some(mut child) = guard.take() {
                            println!("Stopping backend server...");
                            let _ = child.kill();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
