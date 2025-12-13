# Prompt Système - Module "Bases de Données" pour GeoMind

## Contexte du Projet

Tu es un assistant IA spécialisé dans le développement d'applications de gestion de bases de données PostgreSQL/PostGIS. Tu dois aider à implémenter un **nouveau module "Bases de données"** pour **GeoMind**, une application Windows déjà fonctionnelle destinée à la gestion SIT/GIS pour la commune de Bussigny (Suisse).

### Contexte de l'application existante

- **Nom** : GeoMind
- **Plateforme** : Windows (application desktop)
- **État** : Application presque fonctionnelle, en phase d'ajout de modules
- **Mode d'activation** : Le module "Bases de données" sera disponible uniquement en **mode "Professionnel"**
- **Domaine** : Système d'Information du Territoire (SIT) / GIS municipal

### Intégration dans GeoMind

Ce module doit s'intégrer harmonieusement dans l'architecture existante de GeoMind :
- Respecter les conventions de code et l'UI/UX existantes
- S'activer/désactiver selon le mode utilisateur (Professionnel vs Standard)
- Utiliser les services de connexion DB déjà implémentés si disponibles
- S'intégrer dans le système de navigation/menu existant

---

## 🎯 Objectifs du Module

Le module "Bases de données" doit offrir les fonctionnalités suivantes :

1. **Visualisation interactive des schémas** (ERD interactif)
2. **Assistant de requêtes SQL intelligent** (Text-to-SQL avec IA)
3. **Environnement de test disposable** (clone de base de données)
4. **Génération de données mock réalistes**
5. **Documentation automatique de la base de données**

---

## 📐 Architecture Technique du Module

> ⚠️ **Note d'intégration** : Ce module s'intègre dans l'architecture existante de GeoMind. Les composants ci-dessous doivent utiliser les services partagés de l'application (connexion DB, authentification, gestion des modes, etc.)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GeoMind - Module Bases de Données                         │
│                    [Actif uniquement en Mode Professionnel]                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Schema    │  │    SQL      │  │    Test     │  │   Documentation     │ │
│  │   Viewer    │  │  Assistant  │  │ Environment │  │     Generator       │ │
│  │             │  │             │  │             │  │                     │ │
│  │ - ERD       │  │ - Text2SQL  │  │ - Clone DB  │  │ - Auto-doc tables   │ │
│  │ - Tables    │  │ - Explain   │  │ - Snapshot  │  │ - Column desc       │ │
│  │ - Relations │  │ - Optimize  │  │ - Mock data │  │ - ERD export        │ │
│  │ - Indexes   │  │ - Validate  │  │ - Anonymize │  │ - HTML/PDF/MD       │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│                         Core Database Engine (Python)                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  psycopg2/asyncpg │ SQLAlchemy │ PostGIS support │ SSH Tunneling     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│                              UI Layer (Options)                              │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────────┐ │
│  │ WPF + WebView2     │  │ PyQt6 / PySide6    │  │ Electron + React       │ │
│  │ (Recommended)      │  │                    │  │                        │ │
│  └────────────────────┘  └────────────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1️⃣ Visualisation Interactive des Schémas (ERD)

### Spécifications Fonctionnelles

| Fonctionnalité | Description | Priorité |
|----------------|-------------|----------|
| Reverse engineering | Extraction automatique du schéma depuis PostgreSQL | P0 |
| Diagramme ERD interactif | Zoom, pan, sélection de tables, highlight relations | P0 |
| Filtrage par schéma | Affichage sélectif des schémas PostgreSQL | P0 |
| Détail des colonnes | Types, contraintes, commentaires, indexes | P0 |
| Relations FK/PK | Visualisation des clés étrangères avec cardinalité | P0 |
| Support PostGIS | Identification des colonnes geometry/geography | P1 |
| Export | SVG, PNG, PDF du diagramme | P1 |
| Layout automatique | Arrangement intelligent des tables | P2 |

### Requêtes PostgreSQL pour l'extraction du schéma

```sql
-- Tables et colonnes
SELECT 
    t.table_schema,
    t.table_name,
    c.column_name,
    c.data_type,
    c.udt_name,
    c.is_nullable,
    c.column_default,
    c.character_maximum_length,
    c.numeric_precision,
    pg_catalog.col_description(
        (quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))::regclass::oid, 
        c.ordinal_position
    ) as column_comment,
    pg_catalog.obj_description(
        (quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))::regclass::oid
    ) as table_comment
FROM information_schema.tables t
JOIN information_schema.columns c 
    ON t.table_schema = c.table_schema 
    AND t.table_name = c.table_name
WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
    AND t.table_type = 'BASE TABLE'
ORDER BY t.table_schema, t.table_name, c.ordinal_position;

-- Clés primaires
SELECT 
    tc.table_schema,
    tc.table_name,
    kcu.column_name,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY';

-- Clés étrangères avec relations
SELECT
    tc.table_schema,
    tc.table_name,
    kcu.column_name,
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY';

-- Indexes
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname NOT IN ('pg_catalog', 'information_schema');

-- Colonnes géométriques PostGIS
SELECT 
    f_table_schema,
    f_table_name,
    f_geometry_column,
    coord_dimension,
    srid,
    type
FROM geometry_columns;
```

### Bibliothèques recommandées pour la visualisation

| Bibliothèque | Usage | Avantages |
|--------------|-------|-----------|
| **React Flow** | Diagrammes interactifs | Très flexible, moderne, excellent pour UI custom |
| **D3.js** | Visualisation avancée | Contrôle total, animations, SVG natif |
| **vis.js Network** | Graphes de relations | Simple, performant pour grands graphes |
| **Graphviz (via PyGraphviz)** | Génération ERD | Layout automatique excellent |
| **Mermaid.js** | Diagrammes textuels | Export facile, intégration markdown |

### Structure de données pour le schéma

```python
from dataclasses import dataclass, field
from typing import List, Optional, Dict
from enum import Enum

class ConstraintType(Enum):
    PRIMARY_KEY = "PRIMARY KEY"
    FOREIGN_KEY = "FOREIGN KEY"
    UNIQUE = "UNIQUE"
    CHECK = "CHECK"
    NOT_NULL = "NOT NULL"

@dataclass
class Column:
    name: str
    data_type: str
    udt_name: str  # Type PostGIS (geometry, geography, etc.)
    is_nullable: bool
    default_value: Optional[str] = None
    max_length: Optional[int] = None
    numeric_precision: Optional[int] = None
    comment: Optional[str] = None
    is_primary_key: bool = False
    is_foreign_key: bool = False
    foreign_key_ref: Optional[str] = None  # "schema.table.column"
    srid: Optional[int] = None  # Pour colonnes PostGIS
    geometry_type: Optional[str] = None  # POINT, POLYGON, etc.

@dataclass
class Index:
    name: str
    columns: List[str]
    is_unique: bool
    is_primary: bool
    definition: str

@dataclass
class Table:
    schema: str
    name: str
    columns: List[Column] = field(default_factory=list)
    indexes: List[Index] = field(default_factory=list)
    comment: Optional[str] = None
    row_count: Optional[int] = None
    size_bytes: Optional[int] = None

@dataclass
class ForeignKeyRelation:
    source_schema: str
    source_table: str
    source_column: str
    target_schema: str
    target_table: str
    target_column: str
    constraint_name: str
    
@dataclass
class DatabaseSchema:
    tables: Dict[str, Table]  # key: "schema.table"
    relations: List[ForeignKeyRelation]
    schemas: List[str]
    postgis_enabled: bool = False
```

---

## 2️⃣ Assistant de Requêtes SQL Intelligent (Text-to-SQL)

### Spécifications Fonctionnelles

| Fonctionnalité | Description | Priorité |
|----------------|-------------|----------|
| Text-to-SQL | Conversion langage naturel → SQL | P0 |
| Contexte schéma | Utilisation du schéma DB pour générer SQL précis | P0 |
| Validation syntaxique | Vérification de la syntaxe SQL avant exécution | P0 |
| Explain query | Explication en langage naturel d'une requête SQL | P1 |
| Optimisation | Suggestions d'amélioration de performance | P1 |
| Support PostGIS | Génération de requêtes spatiales (ST_*) | P1 |
| Historique | Sauvegarde des requêtes avec favoris | P2 |
| Auto-complétion | Suggestions de tables/colonnes en temps réel | P2 |

### Architecture Text-to-SQL avec RAG

```python
"""
Architecture Text-to-SQL avec Retrieval Augmented Generation (RAG)
"""

from typing import List, Dict, Optional
import json

class SchemaContext:
    """Gestion du contexte de schéma pour le LLM"""
    
    def __init__(self, db_schema: DatabaseSchema):
        self.schema = db_schema
        self.ddl_statements = self._generate_ddl()
        self.table_descriptions = self._generate_descriptions()
        
    def _generate_ddl(self) -> str:
        """Génère le DDL compact pour le contexte LLM"""
        ddl_parts = []
        for table_key, table in self.schema.tables.items():
            columns_ddl = []
            for col in table.columns:
                col_def = f"  {col.name} {col.data_type}"
                if col.is_primary_key:
                    col_def += " PRIMARY KEY"
                if not col.is_nullable:
                    col_def += " NOT NULL"
                if col.comment:
                    col_def += f" -- {col.comment}"
                columns_ddl.append(col_def)
            
            ddl = f"CREATE TABLE {table.schema}.{table.name} (\n"
            ddl += ",\n".join(columns_ddl)
            ddl += "\n);"
            if table.comment:
                ddl += f"\n-- {table.comment}"
            ddl_parts.append(ddl)
        
        return "\n\n".join(ddl_parts)
    
    def _generate_descriptions(self) -> Dict[str, str]:
        """Génère des descriptions pour chaque table"""
        descriptions = {}
        for table_key, table in self.schema.tables.items():
            desc = f"Table {table.schema}.{table.name}"
            if table.comment:
                desc += f": {table.comment}"
            desc += f"\nColonnes: {', '.join([c.name for c in table.columns])}"
            
            # Ajouter info PostGIS si présent
            geo_cols = [c for c in table.columns if c.geometry_type]
            if geo_cols:
                desc += f"\nColonnes géométriques: {', '.join([f'{c.name} ({c.geometry_type}, SRID:{c.srid})' for c in geo_cols])}"
            
            descriptions[table_key] = desc
        return descriptions

    def get_context_for_query(self, user_query: str, max_tables: int = 10) -> str:
        """Retourne le contexte pertinent pour une requête utilisateur"""
        # TODO: Implémenter la recherche sémantique pour trouver les tables pertinentes
        # Pour l'instant, retourne tout le DDL (à optimiser avec embeddings)
        return self.ddl_statements


class TextToSQLEngine:
    """Moteur de conversion Text-to-SQL"""
    
    SYSTEM_PROMPT = """Tu es un expert PostgreSQL/PostGIS spécialisé dans les systèmes d'information géographique (SIG/SIT).
Tu génères des requêtes SQL précises à partir de questions en langage naturel.

RÈGLES IMPORTANTES:
1. Utilise UNIQUEMENT les tables et colonnes présentes dans le schéma fourni
2. Pour les requêtes spatiales, utilise les fonctions PostGIS appropriées (ST_Area, ST_Intersects, ST_Distance, ST_Within, ST_Buffer, etc.)
3. Le SRID par défaut pour la Suisse est 2056 (CH1903+/LV95)
4. Retourne TOUJOURS une requête SQL valide et optimisée
5. Ajoute des commentaires SQL pour expliquer les parties complexes
6. Si la question est ambiguë, génère la requête la plus probable et explique tes choix

FORMAT DE RÉPONSE:
```sql
-- Ta requête SQL ici
```

EXPLICATION:
[Brève explication de ce que fait la requête]
"""

    POSTGIS_FUNCTIONS_CONTEXT = """
FONCTIONS POSTGIS COURANTES:
- ST_Area(geom) : Surface en unités du SRID (m² pour SRID 2056)
- ST_Length(geom) : Longueur en unités du SRID
- ST_Intersects(geom1, geom2) : Test d'intersection
- ST_Within(geom1, geom2) : Test de contenance
- ST_Distance(geom1, geom2) : Distance entre géométries
- ST_Buffer(geom, distance) : Zone tampon
- ST_Centroid(geom) : Centre de la géométrie
- ST_AsText(geom) : Conversion en WKT
- ST_AsGeoJSON(geom) : Conversion en GeoJSON
- ST_Transform(geom, srid) : Reprojection
- ST_MakePoint(x, y) : Création d'un point
- ST_SetSRID(geom, srid) : Définir le SRID
"""

    def __init__(self, schema_context: SchemaContext, llm_client):
        self.schema_context = schema_context
        self.llm = llm_client
        
    async def generate_sql(self, user_query: str) -> Dict:
        """Génère une requête SQL à partir d'une question en langage naturel"""
        
        # Construire le prompt avec le contexte
        schema_ddl = self.schema_context.get_context_for_query(user_query)
        
        prompt = f"""SCHÉMA DE LA BASE DE DONNÉES:
{schema_ddl}

{self.POSTGIS_FUNCTIONS_CONTEXT}

QUESTION DE L'UTILISATEUR:
{user_query}

Génère la requête SQL correspondante."""

        # Appel au LLM
        response = await self.llm.generate(
            system_prompt=self.SYSTEM_PROMPT,
            user_prompt=prompt,
            temperature=0.1  # Faible température pour plus de précision
        )
        
        # Parser la réponse
        sql_query = self._extract_sql(response)
        explanation = self._extract_explanation(response)
        
        return {
            "sql": sql_query,
            "explanation": explanation,
            "raw_response": response
        }
    
    def _extract_sql(self, response: str) -> str:
        """Extrait le code SQL de la réponse"""
        import re
        sql_match = re.search(r'```sql\s*(.*?)\s*```', response, re.DOTALL)
        if sql_match:
            return sql_match.group(1).strip()
        return response.strip()
    
    def _extract_explanation(self, response: str) -> str:
        """Extrait l'explication de la réponse"""
        import re
        parts = re.split(r'```sql.*?```', response, flags=re.DOTALL)
        if len(parts) > 1:
            return parts[-1].strip()
        return ""

    async def explain_sql(self, sql_query: str) -> str:
        """Explique une requête SQL en langage naturel"""
        prompt = f"""Explique cette requête SQL en français, de manière claire et concise:

```sql
{sql_query}
```

Décris:
1. Ce que fait la requête
2. Les tables utilisées et leur rôle
3. Les filtres et conditions appliqués
4. Le résultat attendu"""

        return await self.llm.generate(
            system_prompt="Tu es un expert SQL qui explique les requêtes de manière pédagogique.",
            user_prompt=prompt
        )
    
    async def optimize_sql(self, sql_query: str) -> Dict:
        """Suggère des optimisations pour une requête SQL"""
        schema_ddl = self.schema_context.ddl_statements
        
        prompt = f"""SCHÉMA:
{schema_ddl}

REQUÊTE À OPTIMISER:
```sql
{sql_query}
```

Analyse cette requête et suggère des optimisations:
1. Index manquants potentiels
2. Réécriture pour de meilleures performances
3. Problèmes de N+1 ou de jointures inefficaces
4. Utilisation optimale des fonctions PostGIS"""

        response = await self.llm.generate(
            system_prompt="Tu es un expert en optimisation PostgreSQL/PostGIS.",
            user_prompt=prompt
        )
        
        return {
            "original_query": sql_query,
            "suggestions": response
        }
```

### Intégration avec LLM local ou API

```python
from abc import ABC, abstractmethod
import httpx

class LLMClient(ABC):
    @abstractmethod
    async def generate(self, system_prompt: str, user_prompt: str, temperature: float = 0.7) -> str:
        pass

class ClaudeAPIClient(LLMClient):
    """Client pour l'API Claude d'Anthropic"""
    
    def __init__(self, api_key: str, model: str = "claude-sonnet-4-20250514"):
        self.api_key = api_key
        self.model = model
        self.base_url = "https://api.anthropic.com/v1/messages"
        
    async def generate(self, system_prompt: str, user_prompt: str, temperature: float = 0.7) -> str:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.base_url,
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                json={
                    "model": self.model,
                    "max_tokens": 4096,
                    "temperature": temperature,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": user_prompt}]
                }
            )
            data = response.json()
            return data["content"][0]["text"]


class OllamaClient(LLMClient):
    """Client pour Ollama (LLM local)"""
    
    def __init__(self, model: str = "deepseek-coder:6.7b", base_url: str = "http://localhost:11434"):
        self.model = model
        self.base_url = base_url
        
    async def generate(self, system_prompt: str, user_prompt: str, temperature: float = 0.7) -> str:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": f"{system_prompt}\n\nUser: {user_prompt}\n\nAssistant:",
                    "stream": False,
                    "options": {"temperature": temperature}
                }
            )
            data = response.json()
            return data["response"]
```

---

## 3️⃣ Environnement de Test Disposable

### Spécifications Fonctionnelles

| Fonctionnalité | Description | Priorité |
|----------------|-------------|----------|
| Clone de base | Création d'une copie complète de la DB | P0 |
| Snapshot/Restore | Points de sauvegarde pour rollback rapide | P0 |
| Isolation | Environnement complètement isolé | P0 |
| Anonymisation | Masquage des données sensibles | P1 |
| Reset rapide | Retour à l'état initial en quelques secondes | P1 |
| TTL configurable | Destruction automatique après X heures | P2 |
| Multi-instances | Plusieurs clones simultanés | P2 |

### Architecture avec Docker

```python
"""
Gestionnaire d'environnements de test PostgreSQL disposables
"""

import docker
import asyncio
import uuid
from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import Optional, List, Dict
import subprocess
import tempfile
import os

@dataclass
class TestEnvironment:
    id: str
    name: str
    container_id: str
    port: int
    host: str
    database: str
    user: str
    password: str
    created_at: datetime
    expires_at: Optional[datetime]
    source_db: str
    status: str  # 'creating', 'ready', 'stopped', 'destroyed'
    anonymized: bool = False

class DisposableDBManager:
    """Gestionnaire d'environnements de test disposables"""
    
    def __init__(self, 
                 docker_client: docker.DockerClient = None,
                 postgres_image: str = "postgis/postgis:15-3.3",
                 network_name: str = "geomind_test_network"):
        self.docker = docker_client or docker.from_env()
        self.postgres_image = postgres_image
        self.network_name = network_name
        self.environments: Dict[str, TestEnvironment] = {}
        self._port_counter = 15432
        
    async def create_test_environment(
        self,
        source_connection: Dict,
        name: str = None,
        ttl_hours: int = 24,
        anonymize: bool = False,
        schemas: List[str] = None
    ) -> TestEnvironment:
        """
        Crée un nouvel environnement de test à partir d'une base source
        
        Args:
            source_connection: Dict avec host, port, database, user, password
            name: Nom optionnel pour l'environnement
            ttl_hours: Durée de vie en heures (0 = permanent)
            anonymize: Si True, anonymise les données sensibles
            schemas: Liste des schémas à inclure (None = tous)
        """
        env_id = str(uuid.uuid4())[:8]
        env_name = name or f"test_{env_id}"
        port = self._get_next_port()
        
        # Créer le container PostgreSQL
        container = self.docker.containers.run(
            self.postgres_image,
            detach=True,
            name=f"geomind_test_{env_id}",
            environment={
                "POSTGRES_DB": "test_db",
                "POSTGRES_USER": "test_user",
                "POSTGRES_PASSWORD": "test_password"
            },
            ports={"5432/tcp": port},
            remove=True,
            labels={
                "geomind.test_env": "true",
                "geomind.env_id": env_id,
                "geomind.source_db": source_connection["database"]
            }
        )
        
        # Attendre que PostgreSQL soit prêt
        await self._wait_for_postgres(container)
        
        # Créer l'environnement
        env = TestEnvironment(
            id=env_id,
            name=env_name,
            container_id=container.id,
            port=port,
            host="localhost",
            database="test_db",
            user="test_user",
            password="test_password",
            created_at=datetime.now(),
            expires_at=datetime.now() + timedelta(hours=ttl_hours) if ttl_hours > 0 else None,
            source_db=source_connection["database"],
            status="creating",
            anonymized=anonymize
        )
        
        # Copier les données depuis la source
        await self._clone_database(source_connection, env, schemas, anonymize)
        
        env.status = "ready"
        self.environments[env_id] = env
        
        return env
    
    async def _clone_database(
        self,
        source: Dict,
        target: TestEnvironment,
        schemas: List[str],
        anonymize: bool
    ):
        """Clone la base de données source vers l'environnement cible"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False) as dump_file:
            dump_path = dump_file.name
        
        try:
            # Construire la commande pg_dump
            schemas_arg = ""
            if schemas:
                schemas_arg = " ".join([f"-n {s}" for s in schemas])
            
            dump_cmd = f"""PGPASSWORD={source['password']} pg_dump \
                -h {source['host']} \
                -p {source['port']} \
                -U {source['user']} \
                -d {source['database']} \
                {schemas_arg} \
                --no-owner \
                --no-privileges \
                -f {dump_path}"""
            
            subprocess.run(dump_cmd, shell=True, check=True)
            
            # Si anonymisation requise, appliquer les règles
            if anonymize:
                await self._anonymize_dump(dump_path)
            
            # Restaurer dans le container cible
            restore_cmd = f"""PGPASSWORD={target.password} psql \
                -h {target.host} \
                -p {target.port} \
                -U {target.user} \
                -d {target.database} \
                -f {dump_path}"""
            
            subprocess.run(restore_cmd, shell=True, check=True)
            
        finally:
            os.unlink(dump_path)
    
    async def _anonymize_dump(self, dump_path: str):
        """Applique l'anonymisation sur le dump SQL"""
        # Utiliser les règles d'anonymisation définies
        anonymizer = DataAnonymizer()
        anonymizer.process_dump_file(dump_path)
    
    async def create_snapshot(self, env_id: str, snapshot_name: str = None) -> str:
        """Crée un snapshot de l'environnement de test"""
        env = self.environments.get(env_id)
        if not env:
            raise ValueError(f"Environment {env_id} not found")
        
        snapshot_id = snapshot_name or f"snap_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Utiliser pg_dump pour créer le snapshot
        with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False) as f:
            dump_cmd = f"""PGPASSWORD={env.password} pg_dump \
                -h {env.host} \
                -p {env.port} \
                -U {env.user} \
                -d {env.database} \
                -f {f.name}"""
            subprocess.run(dump_cmd, shell=True, check=True)
            
            # Stocker le snapshot
            # TODO: Implémenter le stockage persistant des snapshots
            
        return snapshot_id
    
    async def restore_snapshot(self, env_id: str, snapshot_id: str):
        """Restaure un snapshot dans l'environnement de test"""
        env = self.environments.get(env_id)
        if not env:
            raise ValueError(f"Environment {env_id} not found")
        
        # TODO: Implémenter la restauration depuis le stockage
        pass
    
    async def reset_environment(self, env_id: str):
        """Remet l'environnement à son état initial"""
        env = self.environments.get(env_id)
        if not env:
            raise ValueError(f"Environment {env_id} not found")
        
        # Supprimer toutes les données et re-cloner
        drop_cmd = f"""PGPASSWORD={env.password} psql \
            -h {env.host} \
            -p {env.port} \
            -U {env.user} \
            -d postgres \
            -c "DROP DATABASE IF EXISTS {env.database}; CREATE DATABASE {env.database};" """
        
        subprocess.run(drop_cmd, shell=True, check=True)
        
        # Re-restaurer depuis le snapshot initial
        await self.restore_snapshot(env_id, "initial")
    
    async def destroy_environment(self, env_id: str):
        """Détruit complètement l'environnement de test"""
        env = self.environments.get(env_id)
        if not env:
            return
        
        try:
            container = self.docker.containers.get(env.container_id)
            container.stop()
            container.remove()
        except docker.errors.NotFound:
            pass
        
        del self.environments[env_id]
    
    async def cleanup_expired(self):
        """Nettoie les environnements expirés"""
        now = datetime.now()
        expired = [
            env_id for env_id, env in self.environments.items()
            if env.expires_at and env.expires_at < now
        ]
        for env_id in expired:
            await self.destroy_environment(env_id)
    
    async def _wait_for_postgres(self, container, timeout: int = 60):
        """Attend que PostgreSQL soit prêt"""
        import time
        start = time.time()
        while time.time() - start < timeout:
            try:
                result = container.exec_run("pg_isready -U postgres")
                if result.exit_code == 0:
                    return
            except Exception:
                pass
            await asyncio.sleep(1)
        raise TimeoutError("PostgreSQL did not start in time")
    
    def _get_next_port(self) -> int:
        port = self._port_counter
        self._port_counter += 1
        return port
    
    def get_connection_string(self, env_id: str) -> str:
        """Retourne la chaîne de connexion pour un environnement"""
        env = self.environments.get(env_id)
        if not env:
            raise ValueError(f"Environment {env_id} not found")
        return f"postgresql://{env.user}:{env.password}@{env.host}:{env.port}/{env.database}"
```

---

## 4️⃣ Génération de Données Mock Réalistes

### Spécifications Fonctionnelles

| Fonctionnalité | Description | Priorité |
|----------------|-------------|----------|
| Génération par type | Données réalistes selon le type de colonne | P0 |
| Respect des contraintes | FK, unique, not null, check | P0 |
| Localisation CH | Données suisses (noms, adresses, NPA, etc.) | P0 |
| Données géospatiales | Points, lignes, polygones dans le périmètre | P1 |
| Volume configurable | Nombre de lignes personnalisable | P1 |
| Seed reproductible | Même seed = mêmes données | P2 |
| Templates personnalisés | Règles custom par table/colonne | P2 |

### Implémentation

```python
"""
Générateur de données mock réalistes pour PostgreSQL/PostGIS
"""

from faker import Faker
from typing import Dict, List, Optional, Any, Callable
import random
from dataclasses import dataclass
import json

# Initialisation Faker avec locale suisse
fake = Faker(['fr_CH', 'de_CH', 'it_CH'])

@dataclass
class MockGeneratorRule:
    """Règle de génération pour une colonne"""
    column_name: str
    generator: Callable[[], Any]
    depends_on: Optional[str] = None  # Pour les FK
    unique: bool = False

class MockDataGenerator:
    """Générateur de données mock réalistes"""
    
    # Mapping des types PostgreSQL vers les générateurs Faker
    TYPE_GENERATORS = {
        # Types texte
        'varchar': lambda: fake.text(max_nb_chars=50),
        'character varying': lambda: fake.text(max_nb_chars=50),
        'text': lambda: fake.text(max_nb_chars=200),
        'char': lambda: fake.lexify(text='?'),
        
        # Types numériques
        'integer': lambda: fake.random_int(min=1, max=10000),
        'int4': lambda: fake.random_int(min=1, max=10000),
        'bigint': lambda: fake.random_int(min=1, max=1000000),
        'int8': lambda: fake.random_int(min=1, max=1000000),
        'smallint': lambda: fake.random_int(min=1, max=100),
        'int2': lambda: fake.random_int(min=1, max=100),
        'numeric': lambda: round(random.uniform(0, 10000), 2),
        'decimal': lambda: round(random.uniform(0, 10000), 2),
        'real': lambda: round(random.uniform(0, 1000), 4),
        'float4': lambda: round(random.uniform(0, 1000), 4),
        'double precision': lambda: round(random.uniform(0, 10000), 6),
        'float8': lambda: round(random.uniform(0, 10000), 6),
        
        # Types date/heure
        'date': lambda: fake.date_between(start_date='-5y', end_date='today'),
        'timestamp': lambda: fake.date_time_between(start_date='-5y', end_date='now'),
        'timestamp without time zone': lambda: fake.date_time_between(start_date='-5y', end_date='now'),
        'timestamp with time zone': lambda: fake.date_time_between(start_date='-5y', end_date='now'),
        'time': lambda: fake.time(),
        'interval': lambda: f"{fake.random_int(min=1, max=365)} days",
        
        # Types booléens
        'boolean': lambda: fake.boolean(),
        'bool': lambda: fake.boolean(),
        
        # Types JSON
        'json': lambda: json.dumps({"key": fake.word(), "value": fake.random_int()}),
        'jsonb': lambda: json.dumps({"key": fake.word(), "value": fake.random_int()}),
        
        # Types UUID
        'uuid': lambda: str(fake.uuid4()),
    }
    
    # Générateurs spécifiques pour noms de colonnes courants
    COLUMN_NAME_GENERATORS = {
        # Identité
        'nom': lambda: fake.last_name(),
        'prenom': lambda: fake.first_name(),
        'name': lambda: fake.name(),
        'first_name': lambda: fake.first_name(),
        'last_name': lambda: fake.last_name(),
        'full_name': lambda: fake.name(),
        
        # Contact
        'email': lambda: fake.email(),
        'telephone': lambda: fake.phone_number(),
        'phone': lambda: fake.phone_number(),
        'tel': lambda: fake.phone_number(),
        
        # Adresse Suisse
        'adresse': lambda: fake.street_address(),
        'address': lambda: fake.street_address(),
        'rue': lambda: fake.street_name(),
        'street': lambda: fake.street_name(),
        'npa': lambda: fake.postcode(),
        'postal_code': lambda: fake.postcode(),
        'zip': lambda: fake.postcode(),
        'ville': lambda: fake.city(),
        'city': lambda: fake.city(),
        'localite': lambda: fake.city(),
        'canton': lambda: random.choice(['VD', 'GE', 'VS', 'FR', 'NE', 'JU', 'BE', 'ZH', 'BS', 'AG']),
        'pays': lambda: 'Suisse',
        'country': lambda: 'Switzerland',
        
        # Entreprise
        'entreprise': lambda: fake.company(),
        'company': lambda: fake.company(),
        'societe': lambda: fake.company(),
        
        # Web
        'url': lambda: fake.url(),
        'website': lambda: fake.url(),
        'site_web': lambda: fake.url(),
        
        # Description
        'description': lambda: fake.text(max_nb_chars=500),
        'commentaire': lambda: fake.text(max_nb_chars=200),
        'comment': lambda: fake.text(max_nb_chars=200),
        'remarque': lambda: fake.text(max_nb_chars=200),
        'notes': lambda: fake.text(max_nb_chars=200),
        
        # Dates spéciales
        'date_creation': lambda: fake.date_between(start_date='-10y', end_date='-1y'),
        'date_modification': lambda: fake.date_between(start_date='-1y', end_date='today'),
        'created_at': lambda: fake.date_time_between(start_date='-10y', end_date='-1y'),
        'updated_at': lambda: fake.date_time_between(start_date='-1y', end_date='now'),
        
        # Numéros de référence
        'numero': lambda: fake.numerify(text='######'),
        'reference': lambda: fake.bothify(text='REF-????-####'),
        'code': lambda: fake.bothify(text='???-###'),
    }
    
    def __init__(self, db_schema: DatabaseSchema, seed: int = None):
        self.schema = db_schema
        self.seed = seed
        if seed:
            Faker.seed(seed)
            random.seed(seed)
        
        self.generated_pks: Dict[str, List[Any]] = {}  # Pour les FK
        self.unique_values: Dict[str, set] = {}  # Pour les contraintes UNIQUE
    
    def get_generator_for_column(self, column: Column, table: Table) -> Callable:
        """Détermine le générateur approprié pour une colonne"""
        
        # 1. Vérifier si c'est une colonne géométrique PostGIS
        if column.geometry_type:
            return self._get_postgis_generator(column, table)
        
        # 2. Vérifier si c'est une FK
        if column.is_foreign_key and column.foreign_key_ref:
            return self._get_fk_generator(column)
        
        # 3. Vérifier par nom de colonne (prioritaire)
        col_name_lower = column.name.lower()
        for pattern, generator in self.COLUMN_NAME_GENERATORS.items():
            if pattern in col_name_lower:
                return generator
        
        # 4. Fallback sur le type de données
        data_type = column.data_type.lower()
        if data_type in self.TYPE_GENERATORS:
            return self.TYPE_GENERATORS[data_type]
        
        # 5. Générateur par défaut
        return lambda: fake.text(max_nb_chars=50)
    
    def _get_postgis_generator(self, column: Column, table: Table) -> Callable:
        """Générateur pour colonnes PostGIS"""
        srid = column.srid or 2056  # CH1903+/LV95 par défaut
        geom_type = column.geometry_type.upper()
        
        # Bounding box de Bussigny (approximatif en CH1903+)
        bbox = {
            'min_x': 2527000,
            'max_x': 2532000,
            'min_y': 1152000,
            'max_y': 1157000
        }
        
        if geom_type == 'POINT':
            return lambda: self._generate_point(bbox, srid)
        elif geom_type == 'LINESTRING':
            return lambda: self._generate_linestring(bbox, srid)
        elif geom_type == 'POLYGON':
            return lambda: self._generate_polygon(bbox, srid)
        elif geom_type == 'MULTIPOINT':
            return lambda: self._generate_multipoint(bbox, srid)
        elif geom_type == 'MULTILINESTRING':
            return lambda: self._generate_multilinestring(bbox, srid)
        elif geom_type == 'MULTIPOLYGON':
            return lambda: self._generate_multipolygon(bbox, srid)
        else:
            return lambda: self._generate_point(bbox, srid)
    
    def _generate_point(self, bbox: Dict, srid: int) -> str:
        x = random.uniform(bbox['min_x'], bbox['max_x'])
        y = random.uniform(bbox['min_y'], bbox['max_y'])
        return f"ST_SetSRID(ST_MakePoint({x}, {y}), {srid})"
    
    def _generate_linestring(self, bbox: Dict, srid: int, num_points: int = 5) -> str:
        points = []
        for _ in range(num_points):
            x = random.uniform(bbox['min_x'], bbox['max_x'])
            y = random.uniform(bbox['min_y'], bbox['max_y'])
            points.append(f"{x} {y}")
        return f"ST_SetSRID(ST_GeomFromText('LINESTRING({', '.join(points)})'), {srid})"
    
    def _generate_polygon(self, bbox: Dict, srid: int) -> str:
        # Générer un polygone simple (carré avec légère rotation)
        cx = random.uniform(bbox['min_x'] + 100, bbox['max_x'] - 100)
        cy = random.uniform(bbox['min_y'] + 100, bbox['max_y'] - 100)
        size = random.uniform(10, 100)
        
        points = [
            f"{cx - size} {cy - size}",
            f"{cx + size} {cy - size}",
            f"{cx + size} {cy + size}",
            f"{cx - size} {cy + size}",
            f"{cx - size} {cy - size}"  # Fermer le polygone
        ]
        return f"ST_SetSRID(ST_GeomFromText('POLYGON(({', '.join(points)}))'), {srid})"
    
    def _generate_multipoint(self, bbox: Dict, srid: int, num_points: int = 3) -> str:
        points = []
        for _ in range(num_points):
            x = random.uniform(bbox['min_x'], bbox['max_x'])
            y = random.uniform(bbox['min_y'], bbox['max_y'])
            points.append(f"({x} {y})")
        return f"ST_SetSRID(ST_GeomFromText('MULTIPOINT({', '.join(points)})'), {srid})"
    
    def _generate_multilinestring(self, bbox: Dict, srid: int) -> str:
        lines = []
        for _ in range(random.randint(2, 4)):
            line_points = []
            for _ in range(random.randint(3, 6)):
                x = random.uniform(bbox['min_x'], bbox['max_x'])
                y = random.uniform(bbox['min_y'], bbox['max_y'])
                line_points.append(f"{x} {y}")
            lines.append(f"({', '.join(line_points)})")
        return f"ST_SetSRID(ST_GeomFromText('MULTILINESTRING({', '.join(lines)})'), {srid})"
    
    def _generate_multipolygon(self, bbox: Dict, srid: int) -> str:
        polygons = []
        for _ in range(random.randint(2, 3)):
            cx = random.uniform(bbox['min_x'] + 100, bbox['max_x'] - 100)
            cy = random.uniform(bbox['min_y'] + 100, bbox['max_y'] - 100)
            size = random.uniform(10, 50)
            points = [
                f"{cx - size} {cy - size}",
                f"{cx + size} {cy - size}",
                f"{cx + size} {cy + size}",
                f"{cx - size} {cy + size}",
                f"{cx - size} {cy - size}"
            ]
            polygons.append(f"(({', '.join(points)}))")
        return f"ST_SetSRID(ST_GeomFromText('MULTIPOLYGON({', '.join(polygons)})'), {srid})"
    
    def _get_fk_generator(self, column: Column) -> Callable:
        """Générateur pour colonnes avec clé étrangère"""
        ref_table = column.foreign_key_ref
        
        def fk_generator():
            if ref_table in self.generated_pks and self.generated_pks[ref_table]:
                return random.choice(self.generated_pks[ref_table])
            return None
        
        return fk_generator
    
    def generate_for_table(self, table: Table, num_rows: int = 100) -> List[Dict]:
        """Génère des données mock pour une table"""
        table_key = f"{table.schema}.{table.name}"
        rows = []
        
        # Préparer les générateurs
        generators = {}
        for col in table.columns:
            generators[col.name] = self.get_generator_for_column(col, table)
            if col.is_primary_key or (not col.is_nullable and 'UNIQUE' in str(col)):
                self.unique_values[f"{table_key}.{col.name}"] = set()
        
        for _ in range(num_rows):
            row = {}
            for col in table.columns:
                # Sauter les colonnes auto-générées (serial, etc.)
                if col.default_value and 'nextval' in str(col.default_value).lower():
                    continue
                
                value = generators[col.name]()
                
                # Gérer les contraintes UNIQUE
                unique_key = f"{table_key}.{col.name}"
                if unique_key in self.unique_values:
                    attempts = 0
                    while value in self.unique_values[unique_key] and attempts < 100:
                        value = generators[col.name]()
                        attempts += 1
                    self.unique_values[unique_key].add(value)
                
                row[col.name] = value
            
            rows.append(row)
        
        # Stocker les PKs générés pour les FK
        pk_cols = [c for c in table.columns if c.is_primary_key]
        if pk_cols:
            self.generated_pks[table_key] = [row.get(pk_cols[0].name) for row in rows]
        
        return rows
    
    def generate_insert_sql(self, table: Table, rows: List[Dict]) -> str:
        """Génère les requêtes INSERT pour les données mock"""
        if not rows:
            return ""
        
        columns = list(rows[0].keys())
        values_list = []
        
        for row in rows:
            values = []
            for col_name in columns:
                value = row[col_name]
                if value is None:
                    values.append("NULL")
                elif isinstance(value, str):
                    if value.startswith("ST_"):  # Fonction PostGIS
                        values.append(value)
                    else:
                        values.append(f"'{value.replace(chr(39), chr(39)+chr(39))}'")
                elif isinstance(value, bool):
                    values.append("TRUE" if value else "FALSE")
                elif isinstance(value, (int, float)):
                    values.append(str(value))
                else:
                    values.append(f"'{value}'")
            values_list.append(f"({', '.join(values)})")
        
        sql = f"INSERT INTO {table.schema}.{table.name} ({', '.join(columns)}) VALUES\n"
        sql += ",\n".join(values_list)
        sql += ";"
        
        return sql
```

---

## 5️⃣ Documentation Automatique de la Base de Données

### Spécifications Fonctionnelles

| Fonctionnalité | Description | Priorité |
|----------------|-------------|----------|
| Extraction auto | Lecture du schéma et des commentaires | P0 |
| Génération descriptions IA | Descriptions intelligentes des tables/colonnes | P0 |
| Export multi-format | HTML, PDF, Markdown, DOCX | P0 |
| Diagramme ERD intégré | ERD dans la documentation | P1 |
| Historique versions | Tracking des changements de schéma | P1 |
| Templates personnalisables | Layouts custom pour la documentation | P2 |
| Recherche intégrée | Recherche dans la documentation HTML | P2 |

### Implémentation

```python
"""
Générateur de documentation automatique pour PostgreSQL/PostGIS
"""

from typing import Dict, List, Optional
from dataclasses import dataclass
from datetime import datetime
import json
from pathlib import Path
from jinja2 import Environment, FileSystemLoader
import markdown

@dataclass
class TableDocumentation:
    schema: str
    name: str
    description: str
    ai_description: Optional[str]
    columns: List[Dict]
    indexes: List[Dict]
    foreign_keys: List[Dict]
    row_count: Optional[int]
    size_mb: Optional[float]
    sample_data: Optional[List[Dict]]

class DatabaseDocumentationGenerator:
    """Générateur de documentation de base de données"""
    
    AI_DESCRIPTION_PROMPT = """Tu es un expert en bases de données et en documentation technique.
Génère une description claire et concise pour cette table de base de données.

Table: {schema}.{table_name}
Colonnes:
{columns}

Contexte: Cette base de données fait partie d'un système d'information géographique (SIG/SIT) 
pour une commune suisse. Les données concernent la gestion du territoire.

Génère:
1. Une description de 2-3 phrases expliquant le rôle de cette table
2. Des notes sur les relations importantes
3. Des cas d'usage typiques
"""

    def __init__(self, db_schema: DatabaseSchema, llm_client: LLMClient = None):
        self.schema = db_schema
        self.llm = llm_client
        self.documentation: Dict[str, TableDocumentation] = {}
        
    async def generate_full_documentation(
        self,
        include_ai_descriptions: bool = True,
        include_sample_data: bool = True,
        sample_rows: int = 5
    ) -> Dict[str, TableDocumentation]:
        """Génère la documentation complète pour toutes les tables"""
        
        for table_key, table in self.schema.tables.items():
            doc = await self._document_table(
                table,
                include_ai_descriptions,
                include_sample_data,
                sample_rows
            )
            self.documentation[table_key] = doc
        
        return self.documentation
    
    async def _document_table(
        self,
        table: Table,
        include_ai: bool,
        include_sample: bool,
        sample_rows: int
    ) -> TableDocumentation:
        """Génère la documentation pour une table"""
        
        # Préparer les informations des colonnes
        columns_info = []
        for col in table.columns:
            col_info = {
                'name': col.name,
                'type': col.data_type,
                'nullable': col.is_nullable,
                'default': col.default_value,
                'description': col.comment or '',
                'is_pk': col.is_primary_key,
                'is_fk': col.is_foreign_key,
                'fk_ref': col.foreign_key_ref
            }
            
            # Ajouter info PostGIS si applicable
            if col.geometry_type:
                col_info['geometry_type'] = col.geometry_type
                col_info['srid'] = col.srid
            
            columns_info.append(col_info)
        
        # Générer description IA si demandé
        ai_description = None
        if include_ai and self.llm:
            ai_description = await self._generate_ai_description(table, columns_info)
        
        # Préparer les indexes
        indexes_info = [
            {
                'name': idx.name,
                'columns': idx.columns,
                'is_unique': idx.is_unique,
                'definition': idx.definition
            }
            for idx in table.indexes
        ]
        
        # Préparer les FK
        fk_info = [
            {
                'source_column': rel.source_column,
                'target_table': f"{rel.target_schema}.{rel.target_table}",
                'target_column': rel.target_column,
                'constraint_name': rel.constraint_name
            }
            for rel in self.schema.relations
            if rel.source_schema == table.schema and rel.source_table == table.name
        ]
        
        return TableDocumentation(
            schema=table.schema,
            name=table.name,
            description=table.comment or '',
            ai_description=ai_description,
            columns=columns_info,
            indexes=indexes_info,
            foreign_keys=fk_info,
            row_count=table.row_count,
            size_mb=round(table.size_bytes / (1024*1024), 2) if table.size_bytes else None,
            sample_data=None  # TODO: Implémenter si include_sample
        )
    
    async def _generate_ai_description(self, table: Table, columns: List[Dict]) -> str:
        """Génère une description IA pour une table"""
        columns_text = "\n".join([
            f"- {c['name']} ({c['type']}): {c.get('description', 'Non documenté')}"
            for c in columns
        ])
        
        prompt = self.AI_DESCRIPTION_PROMPT.format(
            schema=table.schema,
            table_name=table.name,
            columns=columns_text
        )
        
        return await self.llm.generate(
            system_prompt="Tu es un expert en documentation de bases de données géographiques.",
            user_prompt=prompt
        )
    
    def export_html(self, output_path: str, template_dir: str = None):
        """Exporte la documentation en HTML interactif"""
        
        # Template HTML par défaut
        html_template = '''
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Documentation Base de Données - {{ db_name }}</title>
    <style>
        :root {
            --primary-color: #2d5a27;
            --secondary-color: #4a8c3f;
            --bg-color: #f5f5f5;
            --card-bg: #ffffff;
            --text-color: #333333;
            --border-color: #e0e0e0;
        }
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
            font-family: 'Segoe UI', system-ui, sans-serif;
            background: var(--bg-color);
            color: var(--text-color);
            line-height: 1.6;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }
        
        header {
            background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
            color: white;
            padding: 40px 20px;
            margin-bottom: 30px;
        }
        
        header h1 { font-size: 2.5em; margin-bottom: 10px; }
        header p { opacity: 0.9; }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: var(--card-bg);
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }
        
        .stat-card .value {
            font-size: 2em;
            font-weight: bold;
            color: var(--primary-color);
        }
        
        .search-box {
            width: 100%;
            padding: 15px 20px;
            font-size: 1em;
            border: 2px solid var(--border-color);
            border-radius: 10px;
            margin-bottom: 30px;
        }
        
        .search-box:focus {
            outline: none;
            border-color: var(--primary-color);
        }
        
        .schema-section {
            margin-bottom: 40px;
        }
        
        .schema-title {
            background: var(--primary-color);
            color: white;
            padding: 15px 20px;
            border-radius: 10px 10px 0 0;
            font-size: 1.3em;
        }
        
        .table-card {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            margin-bottom: 20px;
            overflow: hidden;
        }
        
        .table-header {
            background: #f8f8f8;
            padding: 20px;
            border-bottom: 1px solid var(--border-color);
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .table-header:hover { background: #f0f0f0; }
        
        .table-name {
            font-size: 1.2em;
            font-weight: 600;
            color: var(--primary-color);
        }
        
        .table-meta {
            font-size: 0.9em;
            color: #666;
        }
        
        .table-content {
            padding: 20px;
            display: none;
        }
        
        .table-content.active { display: block; }
        
        .description {
            background: #f0f7ef;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid var(--primary-color);
        }
        
        .columns-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        
        .columns-table th {
            background: #f5f5f5;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            border-bottom: 2px solid var(--border-color);
        }
        
        .columns-table td {
            padding: 12px;
            border-bottom: 1px solid var(--border-color);
        }
        
        .columns-table tr:hover { background: #fafafa; }
        
        .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: 500;
        }
        
        .badge-pk { background: #ffd700; color: #333; }
        .badge-fk { background: #87ceeb; color: #333; }
        .badge-geo { background: #90EE90; color: #333; }
        .badge-nullable { background: #ddd; color: #666; }
        
        .fk-link {
            color: var(--primary-color);
            text-decoration: none;
        }
        
        .fk-link:hover { text-decoration: underline; }
        
        footer {
            text-align: center;
            padding: 30px;
            color: #666;
            border-top: 1px solid var(--border-color);
            margin-top: 40px;
        }
    </style>
</head>
<body>
    <header>
        <div class="container">
            <h1>📊 Documentation Base de Données</h1>
            <p>{{ db_name }} - Généré le {{ generation_date }}</p>
        </div>
    </header>
    
    <div class="container">
        <div class="stats">
            <div class="stat-card">
                <div class="value">{{ tables|length }}</div>
                <div>Tables</div>
            </div>
            <div class="stat-card">
                <div class="value">{{ schemas|length }}</div>
                <div>Schémas</div>
            </div>
            <div class="stat-card">
                <div class="value">{{ total_columns }}</div>
                <div>Colonnes</div>
            </div>
            <div class="stat-card">
                <div class="value">{{ total_relations }}</div>
                <div>Relations</div>
            </div>
        </div>
        
        <input type="text" class="search-box" placeholder="🔍 Rechercher une table ou colonne..." id="searchInput">
        
        {% for schema_name, schema_tables in tables_by_schema.items() %}
        <div class="schema-section">
            <div class="schema-title">📁 Schéma: {{ schema_name }}</div>
            
            {% for table in schema_tables %}
            <div class="table-card" data-table="{{ table.schema }}.{{ table.name }}">
                <div class="table-header" onclick="toggleTable(this)">
                    <div>
                        <span class="table-name">{{ table.name }}</span>
                        <div class="table-meta">
                            {{ table.columns|length }} colonnes
                            {% if table.row_count %} • {{ table.row_count }} lignes{% endif %}
                            {% if table.size_mb %} • {{ table.size_mb }} MB{% endif %}
                        </div>
                    </div>
                    <span class="toggle-icon">▼</span>
                </div>
                
                <div class="table-content">
                    {% if table.description or table.ai_description %}
                    <div class="description">
                        {% if table.description %}
                        <strong>Description:</strong> {{ table.description }}<br>
                        {% endif %}
                        {% if table.ai_description %}
                        <strong>📝 Description IA:</strong> {{ table.ai_description }}
                        {% endif %}
                    </div>
                    {% endif %}
                    
                    <h4>Colonnes</h4>
                    <table class="columns-table">
                        <thead>
                            <tr>
                                <th>Nom</th>
                                <th>Type</th>
                                <th>Contraintes</th>
                                <th>Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            {% for col in table.columns %}
                            <tr>
                                <td>
                                    <strong>{{ col.name }}</strong>
                                    {% if col.is_pk %}<span class="badge badge-pk">PK</span>{% endif %}
                                    {% if col.is_fk %}<span class="badge badge-fk">FK</span>{% endif %}
                                    {% if col.geometry_type %}<span class="badge badge-geo">{{ col.geometry_type }}</span>{% endif %}
                                </td>
                                <td>
                                    {{ col.type }}
                                    {% if col.srid %}(SRID: {{ col.srid }}){% endif %}
                                </td>
                                <td>
                                    {% if not col.nullable %}<span class="badge">NOT NULL</span>{% endif %}
                                    {% if col.default %}<span class="badge badge-nullable">Default: {{ col.default }}</span>{% endif %}
                                    {% if col.fk_ref %}<a href="#{{ col.fk_ref }}" class="fk-link">→ {{ col.fk_ref }}</a>{% endif %}
                                </td>
                                <td>{{ col.description or '-' }}</td>
                            </tr>
                            {% endfor %}
                        </tbody>
                    </table>
                    
                    {% if table.indexes %}
                    <h4 style="margin-top: 20px;">Index</h4>
                    <ul>
                        {% for idx in table.indexes %}
                        <li>
                            <strong>{{ idx.name }}</strong>
                            {% if idx.is_unique %}(UNIQUE){% endif %}
                            - {{ idx.columns|join(', ') }}
                        </li>
                        {% endfor %}
                    </ul>
                    {% endif %}
                </div>
            </div>
            {% endfor %}
        </div>
        {% endfor %}
    </div>
    
    <footer>
        <p>Documentation générée par GeoMind - Module Bases de Données</p>
        <p>© {{ current_year }} Commune de Bussigny</p>
    </footer>
    
    <script>
        function toggleTable(header) {
            const content = header.nextElementSibling;
            const icon = header.querySelector('.toggle-icon');
            content.classList.toggle('active');
            icon.textContent = content.classList.contains('active') ? '▲' : '▼';
        }
        
        document.getElementById('searchInput').addEventListener('input', function(e) {
            const search = e.target.value.toLowerCase();
            document.querySelectorAll('.table-card').forEach(card => {
                const tableName = card.dataset.table.toLowerCase();
                const columns = card.textContent.toLowerCase();
                card.style.display = (tableName.includes(search) || columns.includes(search)) ? 'block' : 'none';
            });
        });
        
        // Ouvrir la première table par défaut
        document.querySelector('.table-header')?.click();
    </script>
</body>
</html>
'''
        
        # Préparer les données pour le template
        tables_by_schema = {}
        total_columns = 0
        
        for table_key, doc in self.documentation.items():
            schema = doc.schema
            if schema not in tables_by_schema:
                tables_by_schema[schema] = []
            tables_by_schema[schema].append(doc)
            total_columns += len(doc.columns)
        
        context = {
            'db_name': 'PostgreSQL/PostGIS',
            'generation_date': datetime.now().strftime('%Y-%m-%d %H:%M'),
            'current_year': datetime.now().year,
            'tables': list(self.documentation.values()),
            'tables_by_schema': tables_by_schema,
            'schemas': list(tables_by_schema.keys()),
            'total_columns': total_columns,
            'total_relations': len(self.schema.relations)
        }
        
        # Render avec Jinja2
        from jinja2 import Template
        template = Template(html_template)
        html_content = template.render(**context)
        
        # Écrire le fichier
        Path(output_path).write_text(html_content, encoding='utf-8')
        
        return output_path
    
    def export_markdown(self, output_path: str):
        """Exporte la documentation en Markdown"""
        lines = [
            f"# Documentation Base de Données",
            f"",
            f"Généré le: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            f"",
            f"## Statistiques",
            f"",
            f"- **Tables**: {len(self.documentation)}",
            f"- **Schémas**: {len(set(d.schema for d in self.documentation.values()))}",
            f"- **Relations**: {len(self.schema.relations)}",
            f"",
            f"---",
            f""
        ]
        
        # Grouper par schéma
        by_schema = {}
        for key, doc in self.documentation.items():
            if doc.schema not in by_schema:
                by_schema[doc.schema] = []
            by_schema[doc.schema].append(doc)
        
        for schema_name, tables in by_schema.items():
            lines.append(f"## Schéma: `{schema_name}`")
            lines.append("")
            
            for table in tables:
                lines.append(f"### {table.name}")
                lines.append("")
                
                if table.description:
                    lines.append(f"> {table.description}")
                    lines.append("")
                
                if table.ai_description:
                    lines.append(f"**Description IA:** {table.ai_description}")
                    lines.append("")
                
                # Tableau des colonnes
                lines.append("| Colonne | Type | Nullable | Description |")
                lines.append("|---------|------|----------|-------------|")
                
                for col in table.columns:
                    pk = " 🔑" if col['is_pk'] else ""
                    fk = " 🔗" if col['is_fk'] else ""
                    geo = f" 📍{col.get('geometry_type', '')}" if col.get('geometry_type') else ""
                    nullable = "✓" if col['nullable'] else "✗"
                    desc = col['description'] or "-"
                    lines.append(f"| {col['name']}{pk}{fk}{geo} | {col['type']} | {nullable} | {desc} |")
                
                lines.append("")
                
                if table.foreign_keys:
                    lines.append("**Clés étrangères:**")
                    for fk in table.foreign_keys:
                        lines.append(f"- `{fk['source_column']}` → `{fk['target_table']}.{fk['target_column']}`")
                    lines.append("")
                
                lines.append("---")
                lines.append("")
        
        Path(output_path).write_text("\n".join(lines), encoding='utf-8')
        return output_path
```

---

## 6️⃣ Anonymisation des Données

### Règles d'anonymisation pour données SIT

```python
"""
Règles d'anonymisation spécifiques pour les données SIT/GIS
"""

class DataAnonymizer:
    """Anonymiseur de données pour environnements de test"""
    
    # Patterns de colonnes sensibles
    SENSITIVE_PATTERNS = {
        # Identité
        r'.*nom.*': 'fake_last_name',
        r'.*prenom.*': 'fake_first_name',
        r'.*name.*': 'fake_name',
        
        # Contact
        r'.*email.*': 'fake_email',
        r'.*mail.*': 'fake_email',
        r'.*tel.*': 'fake_phone',
        r'.*phone.*': 'fake_phone',
        r'.*mobile.*': 'fake_phone',
        
        # Adresse (partielle - garder la localité)
        r'.*adresse.*': 'partial_address',
        r'.*address.*': 'partial_address',
        r'.*rue.*': 'fake_street',
        
        # Numéros d'identification
        r'.*avs.*': 'fake_avs',
        r'.*ahv.*': 'fake_avs',
        r'.*no_parcelle.*': 'keep',  # Important pour SIT
        r'.*egid.*': 'keep',  # Identifiant fédéral bâtiment
        r'.*ewid.*': 'keep',  # Identifiant fédéral logement
        
        # Financier
        r'.*iban.*': 'fake_iban',
        r'.*compte.*': 'fake_account',
        r'.*salaire.*': 'noise_numeric',
        r'.*prix.*': 'noise_numeric',
        r'.*montant.*': 'noise_numeric',
    }
    
    # Colonnes à conserver intactes (données géographiques)
    PRESERVE_COLUMNS = [
        'geom', 'geometry', 'shape', 'the_geom',
        'srid', 'coord_x', 'coord_y',
        'surface', 'perimetre', 'longueur',
        'no_parcelle', 'egid', 'ewid',
        'commune', 'canton', 'npa'
    ]
    
    def __init__(self):
        self.fake = Faker('fr_CH')
    
    def should_anonymize(self, column_name: str) -> bool:
        """Détermine si une colonne doit être anonymisée"""
        col_lower = column_name.lower()
        
        # Ne pas toucher aux colonnes géo
        if col_lower in self.PRESERVE_COLUMNS:
            return False
        
        # Vérifier les patterns sensibles
        import re
        for pattern in self.SENSITIVE_PATTERNS.keys():
            if re.match(pattern, col_lower):
                return True
        
        return False
    
    def get_anonymization_function(self, column_name: str) -> str:
        """Retourne la fonction d'anonymisation pour une colonne"""
        import re
        col_lower = column_name.lower()
        
        for pattern, func in self.SENSITIVE_PATTERNS.items():
            if re.match(pattern, col_lower):
                return func
        
        return 'random_text'
    
    def generate_anonymization_rules(self, db_schema: DatabaseSchema) -> Dict:
        """Génère les règles d'anonymisation pour tout le schéma"""
        rules = {}
        
        for table_key, table in db_schema.tables.items():
            table_rules = {}
            
            for col in table.columns:
                if self.should_anonymize(col.name):
                    func = self.get_anonymization_function(col.name)
                    table_rules[col.name] = {
                        'function': func,
                        'original_type': col.data_type
                    }
            
            if table_rules:
                rules[table_key] = table_rules
        
        return rules
    
    def anonymize_value(self, value, func_name: str, data_type: str):
        """Anonymise une valeur selon la fonction spécifiée"""
        if value is None:
            return None
        
        anonymizers = {
            'fake_last_name': lambda: self.fake.last_name(),
            'fake_first_name': lambda: self.fake.first_name(),
            'fake_name': lambda: self.fake.name(),
            'fake_email': lambda: self.fake.email(),
            'fake_phone': lambda: self.fake.phone_number(),
            'fake_street': lambda: self.fake.street_name(),
            'partial_address': lambda: f"{self.fake.building_number()} {self.fake.street_name()}",
            'fake_avs': lambda: self.fake.numerify(text='756.####.####.##'),
            'fake_iban': lambda: self.fake.iban(),
            'fake_account': lambda: self.fake.numerify(text='CH## #### #### #### #### #'),
            'noise_numeric': lambda: round(float(value) * random.uniform(0.8, 1.2), 2) if value else 0,
            'random_text': lambda: self.fake.text(max_nb_chars=len(str(value)) if value else 50),
            'keep': lambda: value
        }
        
        return anonymizers.get(func_name, anonymizers['random_text'])()
```

---

## 🔧 Configuration et Paramètres

### Gestion du Mode Professionnel

Le module "Bases de données" est exclusivement disponible en mode Professionnel. L'application doit vérifier le mode actif avant d'afficher ou d'activer les fonctionnalités de ce module.

```python
"""
Exemple d'intégration avec le système de modes de GeoMind
"""

class DatabaseModule:
    """Module Bases de données - Requiert le mode Professionnel"""
    
    REQUIRED_MODE = "professional"
    MODULE_NAME = "database_manager"
    
    def __init__(self, app_context):
        self.app = app_context
        self._enabled = False
        
    def is_available(self) -> bool:
        """Vérifie si le module est disponible selon le mode actuel"""
        return self.app.current_mode == self.REQUIRED_MODE
    
    def activate(self):
        """Active le module si le mode le permet"""
        if not self.is_available():
            raise PermissionError(
                f"Le module '{self.MODULE_NAME}' requiert le mode Professionnel. "
                f"Mode actuel: {self.app.current_mode}"
            )
        self._enabled = True
        self._register_menu_items()
        self._initialize_services()
    
    def deactivate(self):
        """Désactive le module (lors du changement de mode)"""
        self._enabled = False
        self._unregister_menu_items()
        self._cleanup_services()
    
    def _register_menu_items(self):
        """Enregistre les entrées de menu pour ce module"""
        self.app.menu.register({
            'section': 'Outils',
            'items': [
                {'label': 'Explorateur de schéma', 'action': self.open_schema_viewer},
                {'label': 'Assistant SQL', 'action': self.open_sql_assistant},
                {'label': 'Environnement de test', 'action': self.open_test_environment},
                {'label': 'Générateur de données', 'action': self.open_mock_generator},
                {'label': 'Documentation DB', 'action': self.open_documentation},
            ]
        })


# Hook pour le changement de mode dans GeoMind
def on_mode_changed(new_mode: str, old_mode: str, modules: dict):
    """Callback appelé lors du changement de mode utilisateur"""
    db_module = modules.get('database_manager')
    if db_module:
        if new_mode == 'professional':
            db_module.activate()
        else:
            db_module.deactivate()
```

### Configuration YAML du module

```yaml
# config/database_module.yaml

database_module:
  # Connexion par défaut
  default_connection:
    host: localhost
    port: 5432
    database: sit_bussigny
    user: geomind_user
    # password: from environment variable GEOBRAIN_DB_PASSWORD
    ssh_tunnel:
      enabled: false
      host: ""
      port: 22
      user: ""
      key_file: ""

  # Visualisation schéma
  schema_viewer:
    default_layout: "hierarchical"  # hierarchical, force-directed, circular
    show_postgis_columns: true
    highlight_foreign_keys: true
    max_tables_display: 50
    export_formats: ["svg", "png", "pdf"]

  # Assistant SQL
  sql_assistant:
    llm_provider: "claude"  # claude, ollama, openai
    llm_model: "claude-sonnet-4-20250514"
    # Pour Ollama local:
    # llm_provider: "ollama"
    # llm_model: "deepseek-coder:6.7b"
    # ollama_url: "http://localhost:11434"
    default_srid: 2056  # CH1903+/LV95
    max_query_history: 100
    auto_explain: true

  # Environnement de test
  test_environment:
    docker_image: "postgis/postgis:15-3.3"
    default_ttl_hours: 24
    max_concurrent_environments: 5
    auto_cleanup_interval_minutes: 60
    port_range_start: 15432
    port_range_end: 15500

  # Génération données mock
  mock_data:
    default_locale: "fr_CH"
    default_rows_per_table: 100
    bussigny_bbox:  # Pour géométries PostGIS
      min_x: 2527000
      max_x: 2532000
      min_y: 1152000
      max_y: 1157000
    preserve_referential_integrity: true

  # Documentation
  documentation:
    output_directory: "./docs/database"
    default_format: "html"  # html, markdown, pdf
    include_ai_descriptions: true
    include_erd: true
    include_sample_data: false
    sample_rows: 5

  # Anonymisation
  anonymization:
    enabled: true
    preserve_geometry: true
    preserve_identifiers: ["no_parcelle", "egid", "ewid"]
    noise_factor: 0.2  # Pour données numériques
```

---

## 📋 Checklist d'Implémentation

### Phase 1 - Foundation (Semaine 1-2)
- [ ] Structure de projet et configuration
- [ ] Connexion PostgreSQL avec support SSH tunnel
- [ ] Extraction du schéma (tables, colonnes, relations, indexes)
- [ ] Support PostGIS (geometry_columns, spatial_ref_sys)
- [ ] Classes de données (DatabaseSchema, Table, Column, etc.)

### Phase 2 - Schema Viewer (Semaine 3-4)
- [ ] Backend API pour schéma
- [ ] Composant ERD interactif (React Flow ou D3.js)
- [ ] Filtrage par schéma
- [ ] Détail des tables/colonnes
- [ ] Export SVG/PNG

### Phase 3 - SQL Assistant (Semaine 5-6)
- [ ] Intégration LLM (Claude API + Ollama)
- [ ] Context builder avec DDL
- [ ] Génération Text-to-SQL
- [ ] Explain query
- [ ] Historique des requêtes

### Phase 4 - Test Environment (Semaine 7-8)
- [ ] Docker manager pour PostgreSQL
- [ ] Clone de base de données
- [ ] Système de snapshots
- [ ] Reset rapide
- [ ] Interface de gestion des environnements

### Phase 5 - Mock Data & Anonymization (Semaine 9-10)
- [ ] Générateurs par type de données
- [ ] Support PostGIS (géométries dans bbox Bussigny)
- [ ] Respect des contraintes FK
- [ ] Règles d'anonymisation
- [ ] Export SQL des données mock

### Phase 6 - Documentation (Semaine 11-12)
- [ ] Extraction des commentaires DB
- [ ] Génération descriptions IA
- [ ] Export HTML interactif
- [ ] Export Markdown
- [ ] Intégration ERD dans docs

---

## 🎯 Points Clés pour l'Implémentation

1. **Modularité** : Chaque fonctionnalité doit être un module indépendant avec une API claire
2. **Async** : Utiliser asyncio pour toutes les opérations DB et LLM
3. **Configuration** : Tout doit être configurable via YAML/JSON
4. **Logging** : Logging structuré pour le debugging
5. **Tests** : Tests unitaires pour chaque module
6. **Documentation code** : Docstrings complètes en français
7. **Sécurité** : Ne jamais logger les mots de passe, utiliser des variables d'environnement
8. **PostGIS** : Toujours considérer le SRID 2056 (Suisse) par défaut

---

*Ce prompt système a été conçu pour guider l'implémentation complète du module "Bases de données" de GeoMind. Il couvre l'architecture, les spécifications fonctionnelles, le code de référence et les meilleures pratiques pour chaque composant.*
