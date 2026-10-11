=== DOSSIER MODÈLES 3D — GUIDE DE LIAISON HTML ===

Comment relier un modèle 3D à une page du site ?
------------------------------------------------
1. Déposez votre fichier 3D dans ce dossier (ex: models/Sofa 1.glb, models/MaTable.glb, etc.).
   Formats pris en charge : .GLB, .GLTF, .OBJ, .FBX (.glb est le format le plus rapide et recommandé).

2. Ouvrez le fichier index.html et repérez la page souhaitée :
   Exemple pour la première page (Canapé) :
   
   <!-- 📦 FICHIER 3D DU DOSSIER MODELS/ : Indiquez votre fichier dans data-model="..." -->
   <div id="asset-unique-01" class="page-view fab-product-view" data-model="models/Sofa 1.glb" style="display: none;">

3. Écrivez simplement le chemin vers votre fichier dans l'attribut data-model :
   data-model="models/NomDeVotreFichier.glb"

4. Si l'attribut data-model est vide (""), le visualiseur 3D affiche automatiquement un modèle procédural de démonstration. Dès que vous écrivez votre nom de fichier, le vrai modèle 3D est chargé en direct avec ses textures, ses ombres et son nombre de polygones calculé !

Exemples :
- data-model="models/Sofa 1.glb"
- data-model="models/Table_Haute.glb"
- data-model="models/Fauteuil.obj"
- data-model="models/Lampe.fbx"
