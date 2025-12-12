import os
import subprocess
import tempfile

# Texte à écrire
message = "Hello World!"

# Créer un fichier temporaire
with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as fichier:
    fichier.write(message)
    chemin_fichier = fichier.name

# Ouvrir le fichier avec Notepad
subprocess.Popen(['notepad.exe', chemin_fichier])

print(f"Fichier créé : {chemin_fichier}")
print("Notepad ouvert avec le message 'Hello World!' 📝")