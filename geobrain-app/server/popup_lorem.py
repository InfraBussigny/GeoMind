import tkinter as tk
from tkinter import messagebox

def popup_simple():
    """Affiche un pop-up simple avec Lorem Ipsum"""
    root = tk.Tk()
    root.withdraw()  # Cache la fenêtre principale
    
    lorem_text = """Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris 
nisi ut aliquip ex ea commodo consequat."""
    
    messagebox.showinfo("Lorem Ipsum", lorem_text)
    root.destroy()

def popup_detaille():
    """Affiche un pop-up détaillé avec plus de Lorem Ipsum"""
    root = tk.Tk()
    root.title("Lorem Ipsum - Pop-up détaillé")
    root.geometry("600x400")
    
    # Centrer la fenêtre
    root.update_idletasks()
    x = (root.winfo_screenwidth() // 2) - (600 // 2)
    y = (root.winfo_screenheight() // 2) - (400 // 2)
    root.geometry(f"600x400+{x}+{y}")
    
    # Texte Lorem Ipsum étendu
    lorem_long = """Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.

Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur?

At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentibus voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga."""
    
    # Frame principal
    main_frame = tk.Frame(root, bg='white', padx=20, pady=20)
    main_frame.pack(fill=tk.BOTH, expand=True)
    
    # Titre
    title_label = tk.Label(main_frame, text="Lorem Ipsum Generator", 
                          font=("Arial", 16, "bold"), bg='white')
    title_label.pack(pady=(0, 15))
    
    # Zone de texte avec scrollbar
    text_frame = tk.Frame(main_frame, bg='white')
    text_frame.pack(fill=tk.BOTH, expand=True)
    
    text_widget = tk.Text(text_frame, wrap=tk.WORD, font=("Arial", 11), 
                         bg='#f9f9f9', relief=tk.GROOVE, borderwidth=2)
    scrollbar = tk.Scrollbar(text_frame, orient=tk.VERTICAL, command=text_widget.yview)
    text_widget.configure(yscrollcommand=scrollbar.set)
    
    # Insérer le texte
    text_widget.insert(tk.END, lorem_long)
    text_widget.config(state=tk.DISABLED)  # Rendre le texte en lecture seule
    
    # Pack des widgets
    scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    text_widget.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
    
    # Bouton fermer
    close_button = tk.Button(main_frame, text="Fermer", command=root.destroy,
                           bg='#007acc', fg='white', font=("Arial", 12, "bold"),
                           padx=20, pady=8, relief=tk.RAISED)
    close_button.pack(pady=(15, 0))
    
    root.mainloop()

def main():
    """Fonction principale pour choisir le type de pop-up"""
    print("=== GÉNÉRATEUR DE POP-UP LOREM IPSUM ===")
    print("1. Pop-up simple (messagebox)")
    print("2. Pop-up détaillé (fenêtre complète)")
    
    choix = input("\nVotre choix (1 ou 2) : ").strip()
    
    if choix == "1":
        popup_simple()
    elif choix == "2":
        popup_detaille()
    else:
        print("Choix invalide. Veuillez sélectionner 1 ou 2.")
        main()

if __name__ == "__main__":
    main()