import tkinter as tk
from tkinter import messagebox

# Créer la fenêtre racine (cachée)
root = tk.Tk()
root.withdraw()

# Texte Lorem Ipsum
lorem_text = """Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris 
nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse 
cillum dolore eu fugiat nulla pariatur."""

# Afficher le pop-up
messagebox.showinfo("Lorem Ipsum", lorem_text)

# Fermer l'application
root.destroy()