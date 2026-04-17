# Mission 1 — Instructions de déploiement et test

## Fichiers à modifier dans ton projet

### 1. Remplacer docker-compose.yml
Copie le `docker-compose.yml` fourni à la racine du projet.

### 2. Remplacer docker/Dockerfile.backend
Copie le `Dockerfile.backend` fourni dans le dossier `docker/`.

### 3. Ajouter api/routes/backup.py
Copie le fichier `backup.py` dans `api/routes/`.

### 4. Enregistrer la route dans api/server.py
Ajoute ces 2 lignes dans `api/server.py` :

```python
# Dans les imports en haut :
from api.routes import backup

# Dans la section "Routeurs" (après les autres app.include_router) :
app.include_router(backup.router)
```

### 5. Mettre à jour .env
Ajoute ces variables dans ton `.env` :

```env
SQLSERVER_BACKUP_MOUNT_DIR=/var/opt/mssql/backup
SQLSERVER_DATA_DIR=/var/opt/mssql/data
BAK_UPLOAD_DIR=/app/uploads/bak
```

---

## Lancement

```bash
# Build et démarrage (depuis la racine du projet)
docker-compose up -d --build

# Vérifier que SQL Server est healthy (attends ~30 secondes)
docker-compose ps

# Voir les logs SQL Server
docker logs agent_dw_sqlserver --tail 30

# Voir les logs Backend
docker logs agent_dw_backend --tail 30
```

---

## Test de l'endpoint avec curl

```bash
# Test basique de santé
curl http://localhost:8000/health

# Upload d'un fichier .bak (remplace mon_fichier.bak par ton vrai fichier)
curl -X POST http://localhost:8000/api/upload-backup \
  -F "file=@/chemin/vers/mon_fichier.bak" \
  -F "restore_db_name=ma_base_test"

# Réponse attendue si succès :
# {
#   "filename": "mon_fichier.bak",
#   "size_mb": 42.5,
#   "restore_success": true,
#   "restored_db": "ma_base_test",
#   "tables": ["dbo.clients", "dbo.commandes", ...],
#   "message": "Base [ma_base_test] restaurée. 12 table(s) disponible(s)."
# }
```

---

## Swagger UI (test interactif)
Ouvre : http://localhost:8000/api/docs
Route : POST /api/upload-backup

---

## Diagnostic des erreurs courantes

### "Cannot open backup device"
→ Le .bak n'est pas visible par SQL Server.
→ Vérifie que le volume `bak_transit` est bien monté dans les deux conteneurs :
```bash
docker exec agent_dw_sqlserver ls -la /var/opt/mssql/backup/
docker exec agent_dw_backend ls -la /app/uploads/bak/
```

### "Login failed for user 'sa'"
→ Le mot de passe dans .env ne correspond pas.
→ Vérifie : DB_PASSWORD dans .env = MSSQL_SA_PASSWORD dans docker-compose.yml

### "ODBC Driver 18 not found" au démarrage du backend
→ Le build Docker ne s'est pas terminé correctement.
→ Relance : `docker-compose build --no-cache backend`

### SQL Server healthcheck échoue en boucle
→ Attends 45 secondes, SQL Server est lent à démarrer.
→ Si ça persiste : `docker logs agent_dw_sqlserver | grep -i error`
