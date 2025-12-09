#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script pour afficher un pop-up avec du texte Lorem Ipsum
Auteur: GeoBrain pour Marc - SIT Bussigny
"""

import tkinter as tk
from tkinter import messagebox, scrolledtext

def show_simple_popup():
    """Affiche un pop-up simple avec Lorem Ipsum"""
    lorem_text = """Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."""
    
    messagebox.showinfo("Lorem Ipsum", lorem_text)

def show_detailed_popup():
    """Affiche une fenêtre détaillée avec plus de Lorem Ipsum"""
    # Créer la fenêtre principale
    root = tk.Tk()
    root.title("Lorem Ipsum - Pop-up détaillé")
    root.geometry("600x400")
    root.resizable(True, True)
    
    # Texte Lorem Ipsum plus long
    lorem_long = """Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.

Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur?

At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentibus voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga."""
    
    # Zone de texte avec scrollbar
    text_area = scrolledtext.ScrolledText(root, wrap=tk.WORD, width=70, height=20)
    text_area.pack(padx=10, pady=10, fill=tk.BOTH, expand=True)
    
    # Insérer le texte
    text_area.insert(tk.INSERT, lorem_long)
    text_area.config(state=tk.DISABLED)  # Lecture seule
    
    # Bouton pour fermer
    close_button = tk.Button(root, text="Fermer", command=root.destroy, 
                           bg="#d32f2f", fg="white", padx=20, pady=5)
    close_button.pack(pady=10)
    
    # Centrer la fenêtre
    root.update_idletasks()
    x = (root.winfo_screenwidth() // 2) - (root.winfo_width() // 2)
    y = (root.winfo_screenheight() // 2) - (root.winfo_height() // 2)
    root.geometry(f"+{x}+{y}")
    
    # Afficher la fenêtre
    root.mainloop()

def main():
    """Fonction principale"""
    print("Script Lorem Ipsum Pop-up")
    print("1. Pop-up simple (messagebox)")
    print("2. Pop-up détaillé (fenêtre avec scrollbar)")
    
    choice = input("\nChoisissez le type de pop-up (1 ou 2): ").strip()
    
    if choice == "1":
        show_simple_popup()
    elif choice == "2":
        show_detailed_popup()
    else:
        print("Choix invalide. Affichage du pop-up simple par défaut.")
        show_simple_popup()

if __name__ == "__main__":
    main()