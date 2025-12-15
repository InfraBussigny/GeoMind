use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use std::sync::Mutex;

// Store the backend process handle
struct BackendProcess(Mutex<Option<tauri_plugin_shell::process::CommandChild>>);

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

            // Start the backend server using node
            let shell = app.shell();
            let node_command = shell.command("node")
                .arg(server_path.to_string_lossy().to_string());

            let (mut rx, child) = node_command.spawn().expect("Failed to spawn backend server. Make sure Node.js is installed.");

            // Store the child process handle
            let backend_state = app.state::<BackendProcess>();
            *backend_state.0.lock().unwrap() = Some(child);

            // Log backend output in a separate thread
            tauri::async_runtime::spawn(async move {
                use tauri_plugin_shell::process::CommandEvent;
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            let line_str = String::from_utf8_lossy(&line);
                            println!("[Backend] {}", line_str);
                        }
                        CommandEvent::Stderr(line) => {
                            let line_str = String::from_utf8_lossy(&line);
                            eprintln!("[Backend Error] {}", line_str);
                        }
                        CommandEvent::Error(err) => {
                            eprintln!("[Backend] Error: {}", err);
                        }
                        CommandEvent::Terminated(payload) => {
                            println!("[Backend] Process terminated with code: {:?}", payload.code);
                            break;
                        }
                        _ => {}
                    }
                }
            });

            println!("GeoMind backend server started");
            Ok(())
        })
        .on_window_event(|window, event| {
            // Kill backend when app closes
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let app = window.app_handle();
                if let Some(backend_state) = app.try_state::<BackendProcess>() {
                    if let Ok(mut guard) = backend_state.0.lock() {
                        if let Some(child) = guard.take() {
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
